"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import {
  CATEGORY_EMOJI, CATEGORY_HEBREW, CATEGORY_DIFFICULTY, type Difficulty, type VocabItem,
  buildSmartSession, sortCategoriesByLevel, suggestGameMode, getGameModeLabel, getGameModeIcon, getGameModeRoute,
} from "@/lib/vocab-utils";
import { useUserProfile } from "@/lib/useUserProfile";
import DashboardSkeleton from "./dashboard-skeleton";

interface CategoryStats {
  name: string;
  emoji: string;
  hebrew: string;
  total: number;
  known: number;
  needsPractice: number;
  percentage: number;
  difficulty: Difficulty;
}

function useAnimatedCounter(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    let start = 0;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      start = Math.round(eased * target);
      setValue(start);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return value;
}

function CircularProgress({ percentage, size = 120, stroke = 10, color = "text-primary" }: { percentage: number; size?: number; stroke?: number; color?: string }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(circumference - (percentage / 100) * circumference);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage, circumference]);

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-surface-container-highest" />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className={`${color} transition-all duration-1000 ease-out`} />
    </svg>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "בוקר טוב";
  if (hour < 17) return "צהריים טובים";
  if (hour < 21) return "ערב טוב";
  return "לילה טוב";
}

export default function DashboardPage() {
  const router = useRouter();
  const profile = useUserProfile();
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState("תלמיד");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [totalVocab, setTotalVocab] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [knownWords, setKnownWords] = useState<Set<string>>(new Set());
  const [needsPracticeWords, setNeedsPracticeWords] = useState<Set<string>>(new Set());
  const [vocabByCategory, setVocabByCategory] = useState<Record<string, string[]>>({});
  const [allVocabItems, setAllVocabItems] = useState<VocabItem[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { router.push("/"); return; }

      setUser(currentUser);
      setUserName(currentUser.displayName || "תלמיד");

      try {
        const [vocabSnap, questionsSnap, userSnap] = await Promise.all([
          getDocs(collection(db, "vocabulary")),
          getDocs(collection(db, "questions")),
          getDoc(doc(db, "users", currentUser.uid)),
        ]);

        setTotalVocab(vocabSnap.size);
        setTotalQuestions(questionsSnap.size);

        const catMap: Record<string, string[]> = {};
        const vocabItems: VocabItem[] = [];
        vocabSnap.forEach((d) => {
          const data = d.data();
          const cat = data.category || "Other";
          if (!catMap[cat]) catMap[cat] = [];
          catMap[cat].push(d.id);
          vocabItems.push({ id: d.id, ...data } as VocabItem);
        });
        setVocabByCategory(catMap);
        setAllVocabItems(vocabItems);

        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data.knownWords) setKnownWords(new Set(data.knownWords));
          if (data.needsPracticeWords) setNeedsPracticeWords(new Set(data.needsPracticeWords));
        }
      } catch (err) {
        console.error("Dashboard data fetch error:", err);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const categoryStats = useMemo<CategoryStats[]>(() => {
    return Object.entries(vocabByCategory)
      .map(([name, ids]) => {
        const known = ids.filter((id) => knownWords.has(id)).length;
        const needsPractice = ids.filter((id) => needsPracticeWords.has(id)).length;
        return {
          name,
          emoji: CATEGORY_EMOJI[name] || "📚",
          hebrew: CATEGORY_HEBREW[name] || name,
          total: ids.length,
          known,
          needsPractice,
          percentage: ids.length > 0 ? Math.round((known / ids.length) * 100) : 0,
          difficulty: (CATEGORY_DIFFICULTY[name] || "medium") as Difficulty,
        };
      })
      .sort((a, b) => {
        const sorted = sortCategoriesByLevel([a.name, b.name], profile.level);
        return sorted.indexOf(a.name) - sorted.indexOf(b.name);
      });
  }, [vocabByCategory, knownWords, needsPracticeWords, profile.level]);

  const smartSession = useMemo(() => {
    if (allVocabItems.length === 0) return [];
    return buildSmartSession({
      level: profile.level,
      dailyMinutes: profile.dailyMinutes,
      allItems: allVocabItems,
      knownWords,
      needsPracticeWords,
    });
  }, [allVocabItems, profile.level, profile.dailyMinutes, knownWords, needsPracticeWords]);

  const todayMode = useMemo(() => suggestGameMode(knownWords.size), [knownWords.size]);

  const masteredCategories = categoryStats.filter((c) => c.percentage === 100);
  const weakCategories = categoryStats.filter((c) => c.needsPractice > 0).sort((a, b) => b.needsPractice - a.needsPractice);
  const untouchedCategories = categoryStats.filter((c) => c.known === 0 && c.needsPractice === 0);
  const inProgressCategories = categoryStats.filter((c) => c.percentage > 0 && c.percentage < 100).sort((a, b) => b.percentage - a.percentage);

  const overallPercentage = totalVocab > 0 ? Math.round((knownWords.size / totalVocab) * 100) : 0;
  const notTestedCount = totalVocab - knownWords.size - needsPracticeWords.size;

  const animatedKnown = useAnimatedCounter(knownWords.size);
  const animatedPractice = useAnimatedCounter(needsPracticeWords.size);
  const animatedTotal = useAnimatedCounter(totalVocab);
  const animatedMastered = useAnimatedCounter(masteredCategories.length);

  const handleLogout = async () => {
    try { await signOut(auth); } catch (err) { console.error(err); }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  const navLinks = [
    { href: "/dashboard", icon: "dashboard", label: "לוח בקרה", active: true },
    { href: "/practice", icon: "school", label: "תרגול", active: false },
    { href: "/practice/vocab", icon: "translate", label: "אוצר מילים", active: false },
    { href: "/search", icon: "search", label: "חיפוש", active: false },
    { href: "/settings", icon: "settings", label: "הגדרות", active: false },
  ];

  return (
    <div className="bg-surface text-on-surface antialiased overflow-x-hidden min-h-screen flex text-right font-hebrew">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Mobile Top Bar */}
      <header className="fixed top-0 right-0 left-0 h-14 bg-surface-container-low/95 backdrop-blur-md border-b border-outline-variant/20 flex items-center justify-between px-4 z-30 lg:hidden">
        <button onClick={() => setSidebarOpen(true)} className="p-2 -mr-2 rounded-xl hover:bg-surface-container-highest transition-colors">
          <span className="material-symbols-outlined text-on-surface">menu</span>
        </button>
        <h1 className="text-base font-bold text-on-surface font-headline">Atlas</h1>
        <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center">
          <span className="material-symbols-outlined text-outline text-lg">person</span>
        </div>
      </header>

      {/* SideNavBar - hidden on mobile, slide-in drawer */}
      <aside className={`
        h-screen w-64 fixed right-0 top-0 bg-surface-container-low flex flex-col py-6 pr-4 pl-0 text-right z-50
        transition-transform duration-300 ease-out
        ${sidebarOpen ? "translate-x-0" : "translate-x-full"}
        lg:translate-x-0
      `}>
        {/* Close button - mobile only */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-4 left-3 p-1.5 rounded-lg hover:bg-surface-container-highest transition-colors lg:hidden"
        >
          <span className="material-symbols-outlined text-outline text-xl">close</span>
        </button>

        <div className="mb-8 pr-4">
          <h2 className="text-lg font-bold text-on-surface font-headline mb-1">Atlas</h2>
          {/* Mini progress bar in sidebar */}
          <div className="h-1.5 rounded-full bg-surface-container-highest mt-2 overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${overallPercentage}%` }} />
          </div>
        </div>

        <nav className="flex flex-col gap-1 w-full">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setSidebarOpen(false)}
              className={`
                flex items-center gap-3 py-3 px-4 rounded-l-full transition-all duration-200 group relative
                ${link.active
                  ? "bg-primary-fixed text-primary font-bold translate-x-1"
                  : "text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface hover:translate-x-0.5"
                }
              `}
            >
              <span
                className={`material-symbols-outlined shrink-0 transition-transform duration-200 group-hover:scale-110 ${link.active ? "" : "group-hover:text-primary"}`}
                style={link.active ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {link.icon}
              </span>
              <span className="font-assistant text-base font-medium">{link.label}</span>
              {link.active && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-l-full" />
              )}
            </Link>
          ))}
          <div className="h-px bg-outline-variant/20 mx-4 my-2" />
          <button
            onClick={() => { handleLogout(); setSidebarOpen(false); }}
            className="flex items-center gap-3 py-3 px-4 text-error hover:bg-error-container/50 transition-all rounded-l-full w-full text-right group"
          >
            <span className="material-symbols-outlined shrink-0 group-hover:scale-110 transition-transform">logout</span>
            <span className="font-assistant text-base font-medium">התנתק</span>
          </button>
        </nav>

        <div className="mt-auto pr-4 pt-4 border-t border-outline-variant/20 mr-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-xl">person</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-on-surface whitespace-nowrap overflow-hidden text-ellipsis">{userName}</p>
            <p className="text-[10px] text-outline uppercase tracking-wider font-body">PREMIUM PLAN</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area - responsive margin */}
      <main className="flex-1 flex flex-col min-h-screen lg:mr-64 pt-14 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6 lg:space-y-8">

          {/* Hero Section */}
          <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl p-5 sm:p-8 bg-linear-to-l from-primary-fixed/40 via-surface-container-low to-surface-container-low">
            <div className="flex items-center justify-between gap-4 sm:gap-8">
              <div className="space-y-3 flex-1">
                <h2 className="text-xl sm:text-3xl font-bold font-assistant text-on-surface leading-tight">
                  {getGreeting()}, {userName} 👋
                </h2>
                <p className="text-sm sm:text-lg text-on-surface-variant font-assistant max-w-lg">
                  {knownWords.size === 0
                    ? profile.focus === "amiram"
                      ? "בוא נתחיל להתכונן לאמיר\"ם! התחל לתרגל כדי לראות את ההתקדמות שלך."
                      : "בוא נתחיל! התחל לתרגל כדי לראות את ההתקדמות שלך כאן."
                    : needsPracticeWords.size > 0
                      ? `יש לך ${needsPracticeWords.size} מילים שצריך לחזור עליהן. בוא נתרגל!`
                      : `כל הכבוד! כבר למדת ${knownWords.size} מילים. המשך כך!`
                  }
                </p>
              </div>

              {/* Circular progress */}
              <div className="relative shrink-0 hidden md:flex items-center justify-center">
                <CircularProgress percentage={overallPercentage} size={140} stroke={12} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black font-body text-primary">{overallPercentage}%</span>
                  <span className="text-xs text-on-surface-variant font-bold">שליטה כללית</span>
                </div>
              </div>
            </div>
          </section>

          {/* Smart Daily Practice Card */}
          {smartSession.length > 0 && (
            <section
              onClick={() => router.push(getGameModeRoute(todayMode))}
              className="relative overflow-hidden rounded-2xl sm:rounded-3xl p-5 sm:p-7 bg-linear-to-l from-primary to-primary-container cursor-pointer group hover:shadow-xl transition-all active:scale-[0.99]"
            >
              <div className="absolute inset-0 bg-white/5 group-hover:bg-white/10 transition-colors" />
              <div className="relative flex items-center gap-5">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-white text-3xl sm:text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {getGameModeIcon(todayMode)}
                  </span>
                </div>
                <div className="flex-1 text-white">
                  <p className="text-xs sm:text-sm font-medium text-white/70 mb-1">התרגול שלך להיום</p>
                  <h3 className="text-lg sm:text-2xl font-extrabold mb-1">{getGameModeLabel(todayMode)}</h3>
                  <div className="flex items-center gap-3 text-sm text-white/80">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-base">dictionary</span>
                      {smartSession.length} מילים
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-base">timer</span>
                      ~{profile.dailyMinutes} דק&apos;
                    </span>
                    {needsPracticeWords.size > 0 && (
                      <span className="flex items-center gap-1 text-amber-200">
                        <span className="material-symbols-outlined text-base">replay</span>
                        {Math.min(needsPracticeWords.size, smartSession.length)} לחזרה
                      </span>
                    )}
                  </div>
                </div>
                <span className="material-symbols-outlined text-white/60 text-3xl group-hover:text-white transition-colors rotate-180">
                  arrow_forward
                </span>
              </div>
            </section>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10 hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 text-green-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                </div>
                <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  {overallPercentage}%
                </span>
              </div>
              <p className="text-3xl font-black font-body text-on-surface">{animatedKnown}</p>
              <p className="text-sm text-on-surface-variant mt-1">מילים שאני יודע</p>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10 hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>replay</span>
                </div>
                {needsPracticeWords.size > 0 && (
                  <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full animate-pulse">
                    צריך חזרה
                  </span>
                )}
              </div>
              <p className="text-3xl font-black font-body text-on-surface">{animatedPractice}</p>
              <p className="text-sm text-on-surface-variant mt-1">מילים לתרגול</p>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10 hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>dictionary</span>
                </div>
                <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                  {categoryStats.length} קטגוריות
                </span>
              </div>
              <p className="text-3xl font-black font-body text-on-surface">{animatedTotal}</p>
              <p className="text-sm text-on-surface-variant mt-1">סה"כ מילים במאגר</p>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10 hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
                </div>
                {masteredCategories.length > 0 && (
                  <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    🏆
                  </span>
                )}
              </div>
              <p className="text-3xl font-black font-body text-on-surface">{animatedMastered}</p>
              <p className="text-sm text-on-surface-variant mt-1">קטגוריות שהושלמו</p>
            </div>
          </div>

          {/* Overall Progress Bar */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold font-assistant">התקדמות כללית</h3>
              <Link href="/practice/vocab" className="text-primary font-bold text-sm hover:underline flex items-center gap-1">
                צפה בכל המילים
                <span className="material-symbols-outlined text-sm">arrow_back</span>
              </Link>
            </div>
            <div className="flex h-4 rounded-full overflow-hidden bg-surface-container-highest">
              {knownWords.size > 0 && (
                <div className="bg-green-500 transition-all duration-1000 ease-out relative group" style={{ width: `${(knownWords.size / totalVocab) * 100}%` }}>
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    {knownWords.size}
                  </span>
                </div>
              )}
              {needsPracticeWords.size > 0 && (
                <div className="bg-red-400 transition-all duration-1000 ease-out relative group" style={{ width: `${(needsPracticeWords.size / totalVocab) * 100}%` }}>
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    {needsPracticeWords.size}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-6 mt-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-on-surface"><strong>{knownWords.size}</strong> יודע</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-400" />
                <span className="text-on-surface"><strong>{needsPracticeWords.size}</strong> לתרגול</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-surface-container-highest" />
                <span className="text-on-surface-variant"><strong>{notTestedCount}</strong> טרם נבדקו</span>
              </div>
            </div>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

            {/* Category Progress */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold font-assistant">התקדמות לפי קטגוריה</h3>
                <span className="text-sm text-on-surface-variant">{categoryStats.length} קטגוריות</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {categoryStats.slice(0, 12).map((cat) => (
                  <Link
                    key={cat.name}
                    href={`/practice/vocab?cat=${encodeURIComponent(cat.name)}`}
                    className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/10 hover:border-primary/30 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xl">{cat.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-on-surface truncate" dir="ltr">{cat.name}</p>
                        <p className="text-xs text-on-surface-variant truncate">{cat.hebrew}</p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        cat.percentage === 100 ? "bg-green-100 text-green-700" :
                        cat.percentage > 0 ? "bg-primary-fixed text-primary" :
                        "bg-surface-container-highest text-on-surface-variant"
                      }`}>
                        {cat.known}/{cat.total}
                      </span>
                    </div>
                    <div className="flex h-2 rounded-full overflow-hidden bg-surface-container-highest">
                      {cat.known > 0 && (
                        <div className="bg-green-500 transition-all duration-700" style={{ width: `${(cat.known / cat.total) * 100}%` }} />
                      )}
                      {cat.needsPractice > 0 && (
                        <div className="bg-red-400 transition-all duration-700" style={{ width: `${(cat.needsPractice / cat.total) * 100}%` }} />
                      )}
                    </div>
                    {cat.percentage === 100 && (
                      <div className="flex items-center gap-1 mt-2">
                        <span className="material-symbols-outlined text-green-600 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                        <span className="text-xs text-green-600 font-bold">הושלם!</span>
                      </div>
                    )}
                  </Link>
                ))}
              </div>

              {categoryStats.length > 12 && (
                <Link href="/practice/vocab" className="block text-center text-primary font-bold text-sm hover:underline py-2">
                  צפה בכל {categoryStats.length} הקטגוריות →
                </Link>
              )}
            </div>

            {/* Right Column: Quick Actions + Recommendations */}
            <div className="space-y-6">

              {/* Quick Actions */}
              <div>
                <h3 className="text-xl font-bold font-assistant mb-4">תרגול מהיר</h3>
                <div className="space-y-3">
                  <Link
                    href="/practice/vocab"
                    className="flex items-center gap-4 p-4 rounded-xl bg-violet-50 border border-violet-200 hover:border-violet-400 hover:shadow-md transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>translate</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-on-surface text-sm">בחר תרגום נכון</p>
                      <p className="text-xs text-on-surface-variant">4 אפשרויות לכל מילה</p>
                    </div>
                    <span className="material-symbols-outlined text-violet-400 group-hover:text-violet-600 text-xl">arrow_back</span>
                  </Link>

                  <Link
                    href="/practice/vocab/flashcard?cat=all"
                    className="flex items-center gap-4 p-4 rounded-xl bg-blue-50 border border-blue-200 hover:border-blue-400 hover:shadow-md transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform text-xl">
                      🃏
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-on-surface text-sm">כרטיסיות (Flashcards)</p>
                      <p className="text-xs text-on-surface-variant">הפוך וסמן אם אתה יודע</p>
                    </div>
                    <span className="material-symbols-outlined text-blue-400 group-hover:text-blue-600 text-xl">arrow_back</span>
                  </Link>

                  <Link
                    href="/practice/vocab/match?cat=all"
                    className="flex items-center gap-4 p-4 rounded-xl bg-amber-50 border border-amber-200 hover:border-amber-400 hover:shadow-md transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform text-xl">
                      🔗
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-on-surface text-sm">משחק התאמה</p>
                      <p className="text-xs text-on-surface-variant">חבר מילה לתרגום</p>
                    </div>
                    <span className="material-symbols-outlined text-amber-400 group-hover:text-amber-600 text-xl">arrow_back</span>
                  </Link>

                  <Link
                    href="/practice"
                    className="flex items-center gap-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 hover:border-emerald-400 hover:shadow-md transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>quiz</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-on-surface text-sm">שאלות אמיר"ם</p>
                      <p className="text-xs text-on-surface-variant">{totalQuestions} שאלות ב-5 רמות</p>
                    </div>
                    <span className="material-symbols-outlined text-emerald-400 group-hover:text-emerald-600 text-xl">arrow_back</span>
                  </Link>
                </div>
              </div>

              {/* Smart Recommendations */}
              <div>
                <h3 className="text-xl font-bold font-assistant mb-4">המלצות</h3>
                <div className="space-y-3">
                  {/* Weak categories recommendation */}
                  {weakCategories.length > 0 && (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-red-600 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>priority_high</span>
                        <p className="font-bold text-red-800 text-sm">מילים שצריך לחזור</p>
                      </div>
                      <div className="space-y-1.5">
                        {weakCategories.slice(0, 3).map((cat) => (
                          <div key={cat.name} className="flex items-center gap-2 text-sm">
                            <span>{cat.emoji}</span>
                            <span className="text-on-surface-variant flex-1 truncate">{cat.hebrew}</span>
                            <span className="text-red-600 font-bold">{cat.needsPractice} מילים</span>
                          </div>
                        ))}
                      </div>
                      <Link
                        href="/practice/vocab"
                        className="mt-3 flex items-center justify-center gap-1 text-red-700 font-bold text-xs hover:underline"
                      >
                        תרגל עכשיו
                        <span className="material-symbols-outlined text-sm">arrow_back</span>
                      </Link>
                    </div>
                  )}

                  {/* In-progress categories */}
                  {inProgressCategories.length > 0 && (
                    <div className="bg-primary-fixed/50 border border-primary/10 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>trending_up</span>
                        <p className="font-bold text-primary text-sm">בתהליך למידה</p>
                      </div>
                      <div className="space-y-1.5">
                        {inProgressCategories.slice(0, 3).map((cat) => (
                          <div key={cat.name} className="flex items-center gap-2 text-sm">
                            <span>{cat.emoji}</span>
                            <span className="text-on-surface-variant flex-1 truncate">{cat.hebrew}</span>
                            <span className="text-primary font-bold">{cat.percentage}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Untouched categories */}
                  {untouchedCategories.length > 0 && (
                    <div className="bg-surface-container-low border border-outline-variant/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-on-surface-variant text-lg">explore</span>
                        <p className="font-bold text-on-surface text-sm">קטגוריות חדשות לגלות</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {untouchedCategories.slice(0, 6).map((cat) => (
                          <span key={cat.name} className="text-xs bg-surface-container-highest px-2 py-1 rounded-full text-on-surface-variant">
                            {cat.emoji} {cat.hebrew}
                          </span>
                        ))}
                        {untouchedCategories.length > 6 && (
                          <span className="text-xs bg-surface-container-highest px-2 py-1 rounded-full text-on-surface-variant">
                            +{untouchedCategories.length - 6} עוד
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Mastered celebration */}
                  {masteredCategories.length > 0 && (
                    <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-green-600 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
                        <p className="font-bold text-green-800 text-sm">קטגוריות שהשלמת 🎉</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {masteredCategories.map((cat) => (
                          <span key={cat.name} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">
                            {cat.emoji} {cat.hebrew}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Difficulty Breakdown */}
              <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/10">
                <h4 className="font-bold text-on-surface mb-4 text-sm">פילוח לפי רמת קושי</h4>
                {(["easy", "medium", "hard"] as Difficulty[]).map((diff) => {
                  const cats = categoryStats.filter((c) => c.difficulty === diff);
                  const total = cats.reduce((s, c) => s + c.total, 0);
                  const known = cats.reduce((s, c) => s + c.known, 0);
                  const pct = total > 0 ? Math.round((known / total) * 100) : 0;
                  const label = diff === "easy" ? "קל" : diff === "medium" ? "בינוני" : "קשה";
                  const color = diff === "easy" ? "bg-emerald-500" : diff === "medium" ? "bg-amber-500" : "bg-red-500";

                  return (
                    <div key={diff} className="mb-3 last:mb-0">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-on-surface-variant">{label}</span>
                        <span className="font-bold text-on-surface">{known}/{total} ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-container-highest overflow-hidden">
                        <div className={`h-full ${color} transition-all duration-700 rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="pt-12 pb-8 border-t border-surface-container flex flex-col sm:flex-row-reverse justify-between items-center gap-4">
            <div className="flex items-center gap-6 sm:gap-8 text-sm text-outline font-assistant">
              <Link className="hover:text-primary transition-colors" href="#">תנאי שימוש</Link>
              <Link className="hover:text-primary transition-colors" href="#">מדיניות פרטיות</Link>
              <Link className="hover:text-primary transition-colors" href="#">צור קשר</Link>
            </div>
            <p className="text-xs sm:text-sm text-outline font-body">© 2025 Atlas. All rights reserved.</p>
          </footer>
        </div>
      </main>
    </div>
  );
}
