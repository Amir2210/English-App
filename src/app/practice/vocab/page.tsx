"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, updateDoc, setDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { type VocabItem, shuffleArray, CATEGORY_EMOJI, CATEGORY_HEBREW, sortCategoriesByLevel, getRecommendedCategories } from "@/lib/vocab-utils";
import { useUserProfile } from "@/lib/useUserProfile";

type PageStatus = "picking" | "wordlists" | "idle" | "correct" | "incorrect" | "completed";

function speakWord(word: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  const voices = window.speechSynthesis.getVoices();
  const enVoice = voices.find((v) => v.lang.startsWith("en"));
  if (enVoice) utterance.voice = enVoice;
  window.speechSynthesis.speak(utterance);
}

function VocabPracticePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoStartCat = searchParams.get("cat");
  const profile = useUserProfile();

  const [user, setUser] = useState<User | null>(null);
  const [allItems, setAllItems] = useState<VocabItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [knownWords, setKnownWords] = useState<Set<string>>(new Set());
  const [needsPracticeWords, setNeedsPracticeWords] = useState<Set<string>>(new Set());

  const [questions, setQuestions] = useState<VocabItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [status, setStatus] = useState<PageStatus>("picking");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [learnedThisSession, setLearnedThisSession] = useState(0);

  const [wordListTab, setWordListTab] = useState<"needs_practice" | "known">("needs_practice");
  const [movePromptWordId, setMovePromptWordId] = useState<string | null>(null);
  const [pendingCategory, setPendingCategory] = useState<string | null>(null);
  const [catSearch, setCatSearch] = useState("");

  const userDocRef = useRef<ReturnType<typeof doc> | null>(null);

  // Auth + data fetch
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      try {
        const snapshot = await getDocs(collection(db, "vocabulary"));
        const items: VocabItem[] = [];
        snapshot.forEach((d) => {
          items.push({ id: d.id, ...d.data() } as VocabItem);
        });
        setAllItems(items);
        setCategories([...new Set(items.map(i => i.category))].sort());
        // categories will be re-sorted by level once profile loads

        if (currentUser) {
          const uRef = doc(db, "users", currentUser.uid);
          userDocRef.current = uRef;
          const userSnap = await getDoc(uRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.knownWords) setKnownWords(new Set(data.knownWords));
            if (data.needsPracticeWords) setNeedsPracticeWords(new Set(data.needsPracticeWords));
          }
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const persistWordCorrect = useCallback(async (vocabId: string) => {
    if (!userDocRef.current) return;
    try {
      await updateDoc(userDocRef.current, {
        knownWords: arrayUnion(vocabId),
        needsPracticeWords: arrayRemove(vocabId),
      });
    } catch {
      await setDoc(userDocRef.current, { knownWords: [vocabId], needsPracticeWords: [] }, { merge: true });
    }
    setKnownWords(prev => new Set(prev).add(vocabId));
    setNeedsPracticeWords(prev => { const s = new Set(prev); s.delete(vocabId); return s; });
  }, []);

  const persistWordIncorrect = useCallback(async (vocabId: string) => {
    if (!userDocRef.current) return;
    try {
      await updateDoc(userDocRef.current, {
        needsPracticeWords: arrayUnion(vocabId),
        knownWords: arrayRemove(vocabId),
      });
    } catch {
      await setDoc(userDocRef.current, { knownWords: [], needsPracticeWords: [vocabId] }, { merge: true });
    }
    setNeedsPracticeWords(prev => new Set(prev).add(vocabId));
    setKnownWords(prev => { const s = new Set(prev); s.delete(vocabId); return s; });
  }, []);

  const moveWordManually = useCallback(async (vocabId: string, to: "known" | "needs_practice") => {
    if (!userDocRef.current) return;
    if (to === "known") {
      await persistWordCorrect(vocabId);
    } else {
      await persistWordIncorrect(vocabId);
    }
  }, [persistWordCorrect, persistWordIncorrect]);

  const startCategory = useCallback((cat: string | "all" | "needs_practice", onlyUnknown?: boolean) => {
    let filtered: VocabItem[];
    if (cat === "needs_practice") {
      filtered = allItems.filter(i => needsPracticeWords.has(i.id));
      setSelectedCategory("מילים לתרגול");
    } else if (cat === "known") {
      filtered = allItems.filter(i => knownWords.has(i.id));
      setSelectedCategory("מילים שאני יודע");
    } else if (cat === "all") {
      filtered = onlyUnknown
        ? allItems.filter(i => !knownWords.has(i.id))
        : allItems;
      setSelectedCategory("כל הקטגוריות");
    } else {
      filtered = allItems.filter(i => i.category === cat);
      if (onlyUnknown) {
        filtered = filtered.filter(i => !knownWords.has(i.id));
      }
      setSelectedCategory(cat);
    }
    setPendingCategory(null);
    setQuestions(shuffleArray(filtered));
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setStatus("idle");
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setLearnedThisSession(0);
  }, [allItems, needsPracticeWords, knownWords]);

  const handleCategoryClick = useCallback((cat: string | "all") => {
    const catItems = cat === "all" ? allItems : allItems.filter(i => i.category === cat);
    const catKnownCount = catItems.filter(i => knownWords.has(i.id)).length;
    if (catKnownCount > 0 && catKnownCount < catItems.length) {
      setPendingCategory(cat);
    } else {
      startCategory(cat);
    }
  }, [allItems, knownWords, startCategory]);

  const autoStartTriggered = useRef(false);
  useEffect(() => {
    if (autoStartTriggered.current || loading || allItems.length === 0 || !autoStartCat) return;
    autoStartTriggered.current = true;
    handleCategoryClick(autoStartCat);
  }, [loading, allItems, autoStartCat, handleCategoryClick]);

  // Loading
  if (loading) {
    return (
      <div className="flex bg-surface min-h-screen items-center justify-center font-hebrew text-primary flex-col gap-4">
        <span className="material-symbols-outlined animate-spin text-5xl">sync</span>
        <span className="font-semibold text-lg animate-pulse">טוען אוצר מילים...</span>
      </div>
    );
  }

  if (allItems.length === 0) {
    return (
      <div className="flex bg-surface min-h-screen items-center justify-center font-hebrew text-on-surface flex-col gap-4" dir="rtl">
        <span className="material-symbols-outlined text-5xl text-outline">search_off</span>
        <p className="text-xl font-bold">לא נמצאו מילים במאגר.</p>
        <button onClick={() => router.push("/practice")} className="mt-4 bg-primary text-white px-8 py-3 rounded-full font-bold">חזור</button>
      </div>
    );
  }

  // ============ WORD LISTS VIEW ============
  if (status === "wordlists") {
    const needsItems = allItems.filter(i => needsPracticeWords.has(i.id));
    const knownItems = allItems.filter(i => knownWords.has(i.id));
    const activeList = wordListTab === "needs_practice" ? needsItems : knownItems;

    return (
      <div className="bg-surface text-on-surface min-h-screen flex flex-col items-center font-hebrew antialiased" dir="rtl">
        <header className="w-full max-w-4xl px-6 pt-8 pb-4 flex items-center gap-4">
          <button
            onClick={() => setStatus("picking")}
            className="material-symbols-outlined text-outline hover:text-on-surface-variant transition-colors p-2 -mr-2 cursor-pointer"
          >
            arrow_forward
          </button>
          <div>
            <h1 className="text-2xl font-bold font-headline text-on-surface">המילים שלי</h1>
            <p className="text-on-surface-variant text-sm mt-1">צפה במילים שאתה יודע ובמילים שצריך לתרגל</p>
          </div>
        </header>

        <main className="w-full max-w-4xl px-6 py-6 flex-1">
          {/* Tabs */}
          <div className="flex gap-2 mb-6 bg-surface-container-highest rounded-xl p-1.5">
            <button
              onClick={() => setWordListTab("needs_practice")}
              className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${
                wordListTab === "needs_practice"
                  ? "bg-red-100 text-red-700 shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-base align-middle ml-1">close</span>
              לא יודע ({needsItems.length})
            </button>
            <button
              onClick={() => setWordListTab("known")}
              className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${
                wordListTab === "known"
                  ? "bg-green-100 text-green-700 shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-base align-middle ml-1" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              יודע ({knownItems.length})
            </button>
          </div>

          {activeList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant gap-3">
              <span className="material-symbols-outlined text-5xl opacity-30">
                {wordListTab === "needs_practice" ? "sentiment_very_satisfied" : "hourglass_empty"}
              </span>
              <p className="font-bold text-lg">
                {wordListTab === "needs_practice" ? "אין מילים לתרגול! כל הכבוד." : "עוד לא סימנת מילים שאתה יודע."}
              </p>
              <p className="text-sm">התחל תרגול כדי למלא את הרשימה.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeList.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    wordListTab === "needs_practice"
                      ? "bg-red-50/50 border-red-100"
                      : "bg-green-50/50 border-green-100"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold font-body text-on-surface">{item.word}</span>
                    <span className="text-sm text-on-surface-variant">—</span>
                    <span className="text-sm text-on-surface-variant font-medium">{item.correctAnswer}</span>
                  </div>
                  <button
                    onClick={() => moveWordManually(
                      item.id,
                      wordListTab === "needs_practice" ? "known" : "needs_practice"
                    )}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-all hover:scale-105 active:scale-95 ${
                      wordListTab === "needs_practice"
                        ? "text-green-600 hover:bg-green-100"
                        : "text-red-500 hover:bg-red-100"
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {wordListTab === "needs_practice" ? "check_circle" : "delete"}
                    </span>
                    <span className="hidden sm:inline">
                      {wordListTab === "needs_practice" ? "סמן כיודע" : "העבר לתרגול"}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Practice button for current tab */}
          {wordListTab === "needs_practice" && needsItems.length > 0 && (
            <div className="sticky bottom-0 mt-8 pb-6">
              <button
                onClick={() => startCategory("needs_practice")}
                className="w-full py-4 bg-red-600 text-white rounded-full font-bold text-lg hover:bg-red-700 active:scale-95 transition-all shadow-lg"
              >
                תרגל {needsItems.length} מילים שאני לא יודע
              </button>
            </div>
          )}
          {wordListTab === "known" && knownItems.length > 0 && (
            <div className="sticky bottom-0 mt-8 pb-6">
              <button
                onClick={() => startCategory("known")}
                className="w-full py-4 bg-green-600 text-white rounded-full font-bold text-lg hover:bg-green-700 active:scale-95 transition-all shadow-lg"
              >
                תרגל {knownItems.length} מילים שאני יודע
              </button>
            </div>
          )}
        </main>
      </div>
    );
  }

  // ============ CATEGORY PICKER ============
  if (status === "picking") {
    const [searchQuery, setSearchQuery] = [catSearch, setCatSearch];
    const overallPct = allItems.length > 0 ? Math.round((knownWords.size / allItems.length) * 100) : 0;

    const sortedCategories = sortCategoriesByLevel(categories, profile.level);
    const recommended = getRecommendedCategories(categories, profile.level);
    const filteredCategories = searchQuery
      ? sortedCategories.filter((cat) => {
          const q = searchQuery.toLowerCase();
          return cat.toLowerCase().includes(q) || (CATEGORY_HEBREW[cat] || "").includes(q);
        })
      : sortedCategories;

    return (
      <div className="bg-surface text-on-surface min-h-screen flex flex-col items-center font-hebrew antialiased" dir="rtl">
        {/* Compact Header */}
        <header className="w-full max-w-5xl px-6 pt-6 pb-3 flex items-center gap-4">
          <button
            onClick={() => router.push("/practice")}
            className="material-symbols-outlined text-outline hover:text-on-surface-variant transition-colors p-2 -mr-2 cursor-pointer"
          >
            arrow_forward
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold font-headline text-on-surface">תרגול אוצר מילים</h1>
          </div>
          {user && (knownWords.size > 0 || needsPracticeWords.size > 0) && (
            <button
              onClick={() => setStatus("wordlists")}
              className="flex items-center gap-1 pl-3 pr-1.5 py-1.5 rounded-full bg-surface-container-lowest border border-outline-variant/20 hover:border-primary/40 hover:shadow-md transition-all active:scale-95 group"
            >
              <div className="flex items-center gap-0.5 bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-xs font-bold">
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                {knownWords.size}
              </div>
              <div className="flex items-center gap-0.5 bg-red-100 text-red-600 px-2.5 py-1 rounded-full text-xs font-bold">
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
                {needsPracticeWords.size}
              </div>
              <div className="w-px h-5 bg-outline-variant/30 mx-1" />
              <span className="text-xs font-black text-primary font-body">{overallPct}%</span>
              <span className="material-symbols-outlined text-base text-primary group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
            </button>
          )}
        </header>

        <main className="w-full max-w-5xl px-6 py-4 flex-1">

          {/* Progress bar — thin and compact */}
          {user && (knownWords.size > 0 || needsPracticeWords.size > 0) && (
            <div className="flex h-2 rounded-full overflow-hidden mb-5 bg-surface-container-highest">
              {knownWords.size > 0 && (
                <div className="bg-green-500 transition-all" style={{ width: `${(knownWords.size / allItems.length) * 100}%` }} />
              )}
              {needsPracticeWords.size > 0 && (
                <div className="bg-red-400 transition-all" style={{ width: `${(needsPracticeWords.size / allItems.length) * 100}%` }} />
              )}
            </div>
          )}

          {/* Game Modes + Quick Actions — compact row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-5">
            <button
              onClick={() => handleCategoryClick("all")}
              className="flex items-center gap-2.5 p-3.5 rounded-xl bg-primary-fixed border border-primary/20 hover:border-primary hover:shadow-md transition-all active:scale-[0.97] group"
            >
              <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>shuffle</span>
              <div className="text-right flex-1 min-w-0">
                <p className="text-sm font-bold text-on-surface truncate">כל המילים</p>
                <p className="text-[11px] text-on-surface-variant">{allItems.length} מילים</p>
              </div>
            </button>
            <button
              onClick={() => router.push("/practice/vocab/match?cat=all")}
              className="flex items-center gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 hover:border-amber-400 hover:shadow-md transition-all active:scale-[0.97] group"
            >
              <span className="text-lg">🔗</span>
              <div className="text-right flex-1 min-w-0">
                <p className="text-sm font-bold text-on-surface truncate">משחק התאמה</p>
                <p className="text-[11px] text-on-surface-variant">חבר מילה לתרגום</p>
              </div>
            </button>
            <button
              onClick={() => router.push("/practice/vocab/flashcard?cat=all")}
              className="flex items-center gap-2.5 p-3.5 rounded-xl bg-violet-50 border border-violet-200 hover:border-violet-400 hover:shadow-md transition-all active:scale-[0.97] group"
            >
              <span className="text-lg">🃏</span>
              <div className="text-right flex-1 min-w-0">
                <p className="text-sm font-bold text-on-surface truncate">כרטיסיות</p>
                <p className="text-[11px] text-on-surface-variant">Flashcards</p>
              </div>
            </button>
            {needsPracticeWords.size > 0 && (
              <button
                onClick={() => startCategory("needs_practice")}
                className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 hover:border-red-400 hover:shadow-md transition-all active:scale-[0.97] group"
              >
                <span className="material-symbols-outlined text-red-600 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>replay</span>
                <div className="text-right flex-1 min-w-0">
                  <p className="text-sm font-bold text-on-surface truncate">לתרגול</p>
                  <p className="text-[11px] text-red-600 font-bold">{needsPracticeWords.size} מילים</p>
                </div>
              </button>
            )}
            {knownWords.size > 0 && (
              <button
                onClick={() => startCategory("known")}
                className="flex items-center gap-2.5 p-3.5 rounded-xl bg-green-50 border border-green-200 hover:border-green-400 hover:shadow-md transition-all active:scale-[0.97] group"
              >
                <span className="material-symbols-outlined text-green-600 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
                <div className="text-right flex-1 min-w-0">
                  <p className="text-sm font-bold text-on-surface truncate">יודע</p>
                  <p className="text-[11px] text-green-600 font-bold">{knownWords.size} מילים</p>
                </div>
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-xl">search</span>
            <input
              type="text"
              placeholder="חפש קטגוריה..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20 focus:border-primary focus:outline-none text-sm transition-colors placeholder:text-on-surface-variant/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface text-lg cursor-pointer"
              >
                close
              </button>
            )}
          </div>

          {/* Category Grid — tighter */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {filteredCategories.map((cat) => {
              const catItems = allItems.filter(i => i.category === cat);
              const catKnown = catItems.filter(i => knownWords.has(i.id)).length;
              const pct = catItems.length > 0 ? Math.round((catKnown / catItems.length) * 100) : 0;
              return (
                <button
                  key={cat}
                  onClick={() => handleCategoryClick(cat)}
                  className="text-right p-4 rounded-xl border border-outline-variant/10 bg-surface-container-lowest hover:border-primary/30 hover:shadow-md transition-all active:scale-[0.97] group relative overflow-hidden"
                >
                  {recommended.has(cat) && pct < 100 && (
                    <div className="absolute top-0 left-0 bg-primary text-white text-[9px] font-bold px-2 py-0.5 rounded-br-lg rounded-tl-lg">
                      מומלץ
                    </div>
                  )}
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="text-2xl shrink-0">{CATEGORY_EMOJI[cat] || "📚"}</span>
                    <span className="text-xs font-bold text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded-full mr-auto shrink-0">
                      {catItems.length}
                    </span>
                    {pct === 100 && (
                      <span className="material-symbols-outlined text-green-500 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-on-surface truncate" dir="ltr">{cat}</p>
                  {CATEGORY_HEBREW[cat] && (
                    <p className="text-xs text-on-surface-variant truncate mt-0.5">{CATEGORY_HEBREW[cat]}</p>
                  )}
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-green-600 font-bold">{catKnown}/{catItems.length}</span>
                      {catKnown > 0 && <span className="text-on-surface-variant">{pct}%</span>}
                    </div>
                    <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-container-highest">
                      <div className="bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {filteredCategories.length === 0 && searchQuery && (
            <div className="flex flex-col items-center py-12 text-on-surface-variant gap-2">
              <span className="material-symbols-outlined text-4xl opacity-30">search_off</span>
              <p className="font-bold">לא נמצאו קטגוריות עבור "{searchQuery}"</p>
            </div>
          )}

          {/* Category practice mode prompt */}
          {pendingCategory && (() => {
            const catItems = pendingCategory === "all"
              ? allItems
              : allItems.filter(i => i.category === pendingCategory);
            const catKnown = catItems.filter(i => knownWords.has(i.id)).length;
            const catUnknown = catItems.length - catKnown;
            const catLabel = pendingCategory === "all" ? "כל הקטגוריות" : pendingCategory;
            const catEmoji = pendingCategory === "all" ? "🔀" : (CATEGORY_EMOJI[pendingCategory] || "📚");

            return (
              <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4" onClick={() => setPendingCategory(null)}>
                <div
                  className="bg-surface-container-lowest max-w-md w-full rounded-3xl p-8 shadow-2xl border border-outline-variant/20 text-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-4xl mb-4">{catEmoji}</div>
                  <h3 className="text-xl font-bold mb-1" dir="ltr">{catLabel}</h3>
                  <p className="text-on-surface-variant text-sm mb-6">
                    {catKnown} מילים ידועות · {catUnknown} מילים חדשות
                  </p>

                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => startCategory(pendingCategory, true)}
                      className="w-full py-4 rounded-2xl bg-primary text-on-primary font-bold text-base hover:bg-primary/90 active:scale-[0.98] transition-all"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-xl">school</span>
                        תרגל רק מילים שאני לא יודע ({catUnknown})
                      </span>
                    </button>
                    <button
                      onClick={() => startCategory(pendingCategory, false)}
                      className="w-full py-4 rounded-2xl bg-surface-container-highest text-on-surface font-bold text-base hover:bg-surface-container-high active:scale-[0.98] transition-all"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-xl">replay</span>
                        תרגל את כל המילים ({catItems.length})
                      </span>
                    </button>
                    <button
                      onClick={() => setPendingCategory(null)}
                      className="w-full py-3 text-on-surface-variant font-medium text-sm hover:text-on-surface transition-colors"
                    >
                      ביטול
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </main>
      </div>
    );
  }

  // ============ COMPLETED SCREEN ============
  if (status === "completed") {
    const percentage = Math.round((score / questions.length) * 100);
    const wrongThisSession = questions.length - score;

    return (
      <div className="bg-surface text-on-surface min-h-screen flex flex-col items-center justify-center font-hebrew text-right" dir="rtl">
        <div className="bg-surface-container-lowest max-w-lg w-full p-12 rounded-3xl shadow-[0px_10px_40px_rgba(25,28,29,0.05)] flex flex-col items-center gap-6 animate-fade-in-up text-center border border-outline-variant/20">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-2 ${percentage >= 70 ? "bg-green-100 text-green-600" : percentage >= 40 ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600"}`}>
            <span className="material-symbols-outlined text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              {percentage >= 70 ? "emoji_events" : percentage >= 40 ? "sentiment_neutral" : "mood_bad"}
            </span>
          </div>
          <h2 className="text-3xl font-bold font-headline">{percentage >= 70 ? "מעולה!" : percentage >= 40 ? "לא רע!" : "המשך לתרגל!"}</h2>
          <p className="text-5xl font-black font-body text-primary">{percentage}%</p>
          <p className="text-on-surface-variant text-lg">
            <strong>{score}</strong> מתוך <strong>{questions.length}</strong> נכונות
          </p>

          {/* Session summary */}
          {user && (
            <div className="flex gap-4 w-full">
              <div className="flex-1 bg-green-50 border border-green-100 rounded-xl p-3 flex flex-col items-center gap-1">
                <span className="material-symbols-outlined text-green-600" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <span className="text-2xl font-black font-body text-green-700">{learnedThisSession}</span>
                <span className="text-xs text-green-600 font-bold">נכנסו ל"יודע"</span>
              </div>
              <div className="flex-1 bg-red-50 border border-red-100 rounded-xl p-3 flex flex-col items-center gap-1">
                <span className="material-symbols-outlined text-red-500" style={{ fontVariationSettings: "'FILL' 1" }}>replay</span>
                <span className="text-2xl font-black font-body text-red-600">{wrongThisSession}</span>
                <span className="text-xs text-red-500 font-bold">לתרגול נוסף</span>
              </div>
            </div>
          )}

          {bestStreak > 1 && (
            <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-full font-bold text-sm">
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
              רצף הכי ארוך: {bestStreak}
            </div>
          )}

          <div className="flex flex-col gap-3 w-full mt-4">
            {wrongThisSession > 0 && (
              <button
                onClick={() => startCategory("needs_practice")}
                className="bg-red-600 text-white w-full py-4 rounded-full font-bold text-lg hover:bg-red-700 active:scale-95 transition-all"
              >
                תרגל שוב את המילים שטעיתי ({wrongThisSession})
              </button>
            )}
            <button
              onClick={() => {
                setQuestions(shuffleArray(questions));
                setCurrentIndex(0);
                setSelectedAnswer(null);
                setStatus("idle");
                setScore(0);
                setStreak(0);
                setBestStreak(0);
                setLearnedThisSession(0);
              }}
              className="bg-primary text-white w-full py-4 rounded-full font-bold text-lg hover:opacity-90 active:scale-95 transition-all"
            >
              נסה שוב
            </button>
            <button
              onClick={() => setStatus("picking")}
              className="bg-surface-container-highest text-on-surface w-full py-4 rounded-full font-bold text-lg hover:opacity-90 active:scale-95 transition-all"
            >
              בחר קטגוריה אחרת
            </button>
            <button
              onClick={() => router.push("/practice")}
              className="text-on-surface-variant w-full py-3 rounded-full font-medium hover:underline"
            >
              חזור לתפריט הראשי
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============ ACTIVE QUIZ ============
  const current = questions[currentIndex];
  const progressPercent = ((currentIndex + (status !== "idle" ? 1 : 0)) / questions.length) * 100;

  const handlePick = (answer: string) => {
    if (status !== "idle") return;
    setSelectedAnswer(answer);

    const vocabId = current.id;

    if (answer === current.correctAnswer) {
      setStatus("correct");
      setScore(prev => prev + 1);
      setStreak(prev => {
        const next = prev + 1;
        setBestStreak(best => Math.max(best, next));
        return next;
      });
      if (!knownWords.has(vocabId)) {
        setLearnedThisSession(prev => prev + 1);
      }
      persistWordCorrect(vocabId);
    } else {
      setStatus("incorrect");
      setStreak(0);
      if (knownWords.has(vocabId)) {
        setMovePromptWordId(vocabId);
      } else {
        persistWordIncorrect(vocabId);
      }
    }
  };

  const handleMovePromptResponse = (move: boolean) => {
    if (move && movePromptWordId) {
      persistWordIncorrect(movePromptWordId);
    }
    setMovePromptWordId(null);
  };

  const handleNext = () => {
    setMovePromptWordId(null);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setStatus("idle");
    } else {
      setStatus("completed");
    }
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col items-center font-hebrew antialiased" dir="rtl">

      {/* Header */}
      <header className="w-full max-w-3xl px-6 py-6 flex items-center gap-4">
        <button
          onClick={() => setStatus("picking")}
          className="material-symbols-outlined text-outline hover:text-on-surface-variant transition-colors p-2 -mr-2 cursor-pointer"
        >
          close
        </button>
        <div className="flex-1 h-3 bg-surface-container-highest rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="text-sm font-bold text-on-surface-variant font-body whitespace-nowrap">
          {currentIndex + 1}/{questions.length}
        </span>
      </header>

      {/* Streak indicator */}
      {streak >= 2 && status === "idle" && (
        <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-full font-bold text-sm mb-2 animate-fade-in-up">
          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
          רצף של {streak}!
        </div>
      )}

      {/* Main Card */}
      <main className="w-full max-w-3xl px-6 flex-1 flex flex-col items-center">
        <div className="mt-4 mb-2 text-center">
          <span className="text-xs font-bold text-on-surface-variant bg-surface-container-highest px-3 py-1 rounded-full font-body uppercase tracking-wider">
            {CATEGORY_EMOJI[current.category] || "📚"} {current.category}
          </span>
        </div>

        {/* Word Display */}
        <div className="my-10 text-center flex flex-col items-center">
          <p className="text-sm text-on-surface-variant mb-3">מהו התרגום של המילה:</p>
          <h1 className="text-5xl md:text-7xl font-black font-body text-on-surface tracking-tight leading-none">
            {current.word}
          </h1>
          <button
            onClick={() => speakWord(current.word)}
            className="mt-4 w-11 h-11 rounded-full bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            title="שמע הגייה"
          >
            <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>volume_up</span>
          </button>
        </div>

        {/* Hebrew Options — 2x2 Grid */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-xl pb-48">
          {current.options.map((option, idx) => {
            const letter = ["א", "ב", "ג", "ד"][idx];
            let styles = "bg-surface-container-lowest border-2 border-outline-variant/20 hover:border-primary/40 hover:bg-surface-container-high";
            let textColor = "text-on-surface";

            if (status !== "idle") {
              if (option === current.correctAnswer) {
                styles = "bg-green-50 border-2 border-green-500 shadow-sm";
                textColor = "text-green-700 font-bold";
              } else if (selectedAnswer === option) {
                styles = "bg-red-50 border-2 border-red-500 shadow-sm opacity-80";
                textColor = "text-red-700 font-bold";
              } else {
                styles = "bg-surface-container-lowest border-2 border-transparent opacity-40";
              }
            }

            return (
              <button
                key={idx}
                onClick={() => handlePick(option)}
                disabled={status !== "idle"}
                className={`p-6 rounded-2xl transition-all duration-300 active:scale-[0.96] flex flex-col items-center gap-3 text-center ${styles}`}
              >
                <span className={`text-xs font-bold font-body px-2.5 py-1 rounded-full ${
                  status !== "idle" && option === current.correctAnswer ? "bg-green-100 text-green-700" :
                  status !== "idle" && selectedAnswer === option ? "bg-red-100 text-red-700" :
                  "bg-surface-container-highest text-on-surface-variant"
                }`}>
                  {letter}
                </span>
                <span className={`text-xl md:text-2xl font-bold ${textColor}`}>
                  {option}
                </span>
                {status !== "idle" && option === current.correctAnswer && (
                  <span className="material-symbols-outlined text-green-500" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                )}
                {status === "incorrect" && selectedAnswer === option && (
                  <span className="material-symbols-outlined text-red-500" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
                )}
              </button>
            );
          })}
        </div>
      </main>

      {/* Bottom Bar */}
      <div className={`fixed bottom-0 left-0 w-full p-6 flex justify-center transition-all min-h-[100px] ${
        status === "correct" ? "bg-green-100 border-t border-green-200" :
        status === "incorrect" ? "bg-red-100 border-t border-red-200" :
        "bg-white/80 backdrop-blur-xl border-t border-outline-variant/20"
      }`}>
        <div className="w-full max-w-3xl flex items-center justify-between gap-4">
          <div className="flex-1 text-right">
            {status === "correct" && (
              <div className="animate-fade-in-up">
                <p className="text-green-800 font-bold text-xl">
                  <span className="material-symbols-outlined align-middle ml-1" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  נכון!
                </p>
                <p className="text-green-700 text-sm mt-1">{current.word} = {current.correctAnswer}</p>
              </div>
            )}
            {status === "incorrect" && (
              <div className="animate-fade-in-up">
                <p className="text-red-800 font-bold text-xl">
                  <span className="material-symbols-outlined align-middle ml-1" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
                  לא נכון
                </p>
                <p className="text-red-700 text-sm mt-1">התשובה הנכונה: <strong>{current.correctAnswer}</strong></p>
              </div>
            )}
          </div>

          {status !== "idle" && !movePromptWordId && (
            <button
              onClick={handleNext}
              className={`py-4 px-10 rounded-full font-bold text-lg text-white transition-all active:scale-95 shadow-md ${
                status === "correct" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
              }`}
            >
              המשך
            </button>
          )}

          {movePromptWordId && (
            <div className="flex flex-col items-center gap-3 animate-fade-in-up">
              <p className="text-red-800 font-bold text-sm text-center">להעביר לרשימת התרגול?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleMovePromptResponse(true)}
                  className="py-3 px-6 rounded-full font-bold text-sm bg-red-600 text-white hover:bg-red-700 active:scale-95 transition-all shadow-md"
                >
                  כן, העבר לתרגול
                </button>
                <button
                  onClick={() => handleMovePromptResponse(false)}
                  className="py-3 px-6 rounded-full font-bold text-sm bg-surface-container-highest text-on-surface hover:bg-surface-container-high active:scale-95 transition-all shadow-md"
                >
                  לא, השאר ביודע
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VocabPracticePage() {
  return (
    <Suspense fallback={
      <div className="flex bg-surface min-h-screen items-center justify-center font-hebrew text-primary flex-col gap-4">
        <span className="material-symbols-outlined animate-spin text-5xl">sync</span>
        <span className="font-semibold text-lg animate-pulse">טוען אוצר מילים...</span>
      </div>
    }>
      <VocabPracticePageInner />
    </Suspense>
  );
}
