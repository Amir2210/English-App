"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { type UserLevel, type UserFocus, type DailyMinutes, invalidateProfileCache } from "@/lib/useUserProfile";
import { CATEGORY_DIFFICULTY, type VocabItem } from "@/lib/vocab-utils";

const TOTAL_STEPS = 4;

const LEVEL_OPTIONS: { key: UserLevel; label: string; sub: string; icon: string }[] = [
  { key: "beginner", label: "מתחיל", sub: "Beginner (A1-A2)", icon: "school" },
  { key: "intermediate", label: "בינוני", sub: "Intermediate (B1-B2)", icon: "menu_book" },
  { key: "advanced", label: "מתקדם", sub: "Advanced (C1-C2)", icon: "workspace_premium" },
];

const FOCUS_OPTIONS: { key: UserFocus; label: string; desc: string; icon: string }[] = [
  { key: "amiram", label: "הכנה לאמיר\"ם", desc: "דגש על מבחני מיון אקדמיים", icon: "history_edu" },
  { key: "general", label: "שיפור אנגלית כללי", desc: "אוצר מילים, קריאה ושיחה", icon: "translate" },
  { key: "both", label: "שניהם ביחד", desc: "גם מבחנים וגם אנגלית כללית", icon: "auto_awesome" },
];

const TIME_OPTIONS: { key: DailyMinutes; label: string; words: string; icon: string }[] = [
  { key: 5, label: "5 דקות", words: "~10 מילים ביום", icon: "bolt" },
  { key: 15, label: "15 דקות", words: "~25 מילים ביום", icon: "timer" },
  { key: 30, label: "30 דקות", words: "~50 מילים ביום", icon: "local_fire_department" },
];

function pickAssessmentWords(allItems: VocabItem[]): VocabItem[] {
  const byDifficulty: Record<string, VocabItem[]> = { easy: [], medium: [], hard: [] };
  for (const item of allItems) {
    const d = CATEGORY_DIFFICULTY[item.category] || "medium";
    byDifficulty[d].push(item);
  }
  const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
  return [
    ...shuffle(byDifficulty.easy).slice(0, 3),
    ...shuffle(byDifficulty.medium).slice(0, 3),
    ...shuffle(byDifficulty.hard).slice(0, 2),
  ];
}

export default function SettingsPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const [level, setLevel] = useState<UserLevel>("intermediate");
  const [focus, setFocus] = useState<UserFocus>("both");
  const [dailyMinutes, setDailyMinutes] = useState<DailyMinutes>(15);

  const [assessmentWords, setAssessmentWords] = useState<VocabItem[]>([]);
  const [assessmentAnswers, setAssessmentAnswers] = useState<Record<string, boolean>>({});
  const [assessmentIdx, setAssessmentIdx] = useState(0);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [suggestedLevel, setSuggestedLevel] = useState<UserLevel | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { router.push("/"); return; }
      setUser(currentUser);

      try {
        const [userSnap, vocabSnap] = await Promise.all([
          getDoc(doc(db, "users", currentUser.uid)),
          getDocs(collection(db, "vocabulary")),
        ]);

        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data.level) setLevel(data.level);
          if (data.focus) setFocus(data.focus);
          if (data.dailyMinutes) setDailyMinutes(data.dailyMinutes);
        }

        const items: VocabItem[] = [];
        vocabSnap.forEach((d) => items.push({ id: d.id, ...d.data() } as VocabItem));
        setAssessmentWords(pickAssessmentWords(items));
      } catch (err) {
        console.error("Error loading settings:", err);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const assessmentScore = () => {
    const total = assessmentWords.length;
    if (total === 0) return 0;
    const known = Object.values(assessmentAnswers).filter(Boolean).length;
    return Math.round((known / total) * 100);
  };

  const computeSuggestedLevel = (): UserLevel | null => {
    const score = assessmentScore();
    if (score >= 75 && level !== "advanced") return "advanced";
    if (score >= 38 && score < 75 && level === "beginner") return "intermediate";
    if (score < 38 && level === "advanced") return "intermediate";
    if (score < 25 && level !== "beginner") return "beginner";
    return null;
  };

  const handleAssessmentAnswer = (knows: boolean) => {
    const word = assessmentWords[assessmentIdx];
    const updated = { ...assessmentAnswers, [word.id]: knows };
    setAssessmentAnswers(updated);

    if (assessmentIdx < assessmentWords.length - 1) {
      setAssessmentIdx(assessmentIdx + 1);
    } else {
      const total = assessmentWords.length;
      const known = Object.values(updated).filter(Boolean).length;
      const score = Math.round((known / total) * 100);

      let suggested: UserLevel | null = null;
      if (score >= 75 && level !== "advanced") suggested = "advanced";
      else if (score >= 38 && score < 75 && level === "beginner") suggested = "intermediate";
      else if (score < 38 && level === "advanced") suggested = "intermediate";
      else if (score < 25 && level !== "beginner") suggested = "beginner";

      if (suggested) {
        setSuggestedLevel(suggested);
        setShowSuggestion(true);
      }
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid), {
        level,
        focus,
        dailyMinutes,
        selfAssessmentScore: assessmentScore(),
        onboardingComplete: true,
        updatedAt: new Date(),
      }, { merge: true });
      invalidateProfileCache();
      router.push("/dashboard");
    } catch {
      alert("שגיאה בשמירת הנתונים. נסה שוב.");
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    if (step === 4) {
      return Object.keys(assessmentAnswers).length === assessmentWords.length;
    }
    return true;
  };

  const next = () => {
    if (step < TOTAL_STEPS) setStep(step + 1);
    else handleSave();
  };
  const back = () => { if (step > 1) setStep(step - 1); };

  if (loading) {
    return (
      <div className="flex bg-surface min-h-screen items-center justify-center font-hebrew text-primary flex-col gap-4">
        <span className="material-symbols-outlined animate-spin text-5xl">sync</span>
        <span className="font-semibold text-lg animate-pulse">טוען הגדרות...</span>
      </div>
    );
  }

  const progressPercent = (step / TOTAL_STEPS) * 100;

  const renderOptionCard = (
    selected: boolean,
    onClick: () => void,
    icon: string,
    label: string,
    sub: string,
  ) => (
    <button
      onClick={onClick}
      className={`group relative flex flex-col items-center text-center rounded-3xl p-7 transition-all duration-300 cursor-pointer ${
        selected
          ? "bg-primary-fixed border-2 border-primary shadow-lg shadow-primary/10"
          : "bg-surface-container-lowest border border-outline-variant/20 hover:bg-surface-container-high hover:border-outline-variant/40 active:scale-[0.97]"
      }`}
    >
      {selected && (
        <div className="absolute -top-2 -left-2 bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center shadow-md">
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
        </div>
      )}
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all ${
        selected ? "bg-white text-primary shadow-sm" : "bg-primary-fixed/60 text-primary"
      }`}>
        <span className="material-symbols-outlined text-2xl">{icon}</span>
      </div>
      <h4 className={`font-bold text-lg mb-1 ${selected ? "text-primary" : "text-on-surface"}`}>{label}</h4>
      <p className={`text-sm ${selected ? "text-primary/70" : "text-on-surface-variant"}`}>{sub}</p>
    </button>
  );

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col items-center antialiased overflow-x-hidden font-hebrew" dir="rtl">

      {/* Header */}
      <header className="w-full max-w-2xl px-6 pt-8 pb-4 flex items-center justify-between">
        {step > 1 ? (
          <button onClick={back} className="flex items-center gap-1 text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined text-xl">arrow_forward</span>
            <span className="text-sm font-medium">חזרה</span>
          </button>
        ) : (
          <div />
        )}
        <span className="text-sm text-on-surface-variant font-medium">שלב {step} מתוך {TOTAL_STEPS}</span>
      </header>

      {/* Progress bar */}
      <div className="w-full max-w-2xl px-6 mb-8">
        <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <main className="w-full max-w-2xl px-6 flex-1 pb-32">

        {/* STEP 1: English Level */}
        {step === 1 && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-primary-fixed rounded-2xl flex items-center justify-center mx-auto mb-5">
                <span className="material-symbols-outlined text-primary text-3xl">school</span>
              </div>
              <h2 className="text-3xl font-extrabold font-headline mb-3">מה הרמה שלך באנגלית?</h2>
              <p className="text-on-surface-variant text-lg">נתאים את התוכן לרמה שלך</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {LEVEL_OPTIONS.map((opt) => renderOptionCard(level === opt.key, () => setLevel(opt.key), opt.icon, opt.label, opt.sub))}
            </div>
          </div>
        )}

        {/* STEP 2: Learning Focus */}
        {step === 2 && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-primary-fixed rounded-2xl flex items-center justify-center mx-auto mb-5">
                <span className="material-symbols-outlined text-primary text-3xl">target</span>
              </div>
              <h2 className="text-3xl font-extrabold font-headline mb-3">מה המטרה שלך?</h2>
              <p className="text-on-surface-variant text-lg">נדע איזה תוכן לתעדף</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {FOCUS_OPTIONS.map((opt) => renderOptionCard(focus === opt.key, () => setFocus(opt.key), opt.icon, opt.label, opt.desc))}
            </div>
          </div>
        )}

        {/* STEP 3: Daily Commitment */}
        {step === 3 && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-primary-fixed rounded-2xl flex items-center justify-center mx-auto mb-5">
                <span className="material-symbols-outlined text-primary text-3xl">schedule</span>
              </div>
              <h2 className="text-3xl font-extrabold font-headline mb-3">כמה זמן ביום?</h2>
              <p className="text-on-surface-variant text-lg">גם 5 דקות ביום עושות את ההבדל</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {TIME_OPTIONS.map((opt) => renderOptionCard(dailyMinutes === opt.key, () => setDailyMinutes(opt.key), opt.icon, opt.label, opt.words))}
            </div>
          </div>
        )}

        {/* STEP 4: Quick Level Check */}
        {step === 4 && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-primary-fixed rounded-2xl flex items-center justify-center mx-auto mb-5">
                <span className="material-symbols-outlined text-primary text-3xl">quiz</span>
              </div>
              <h2 className="text-3xl font-extrabold font-headline mb-3">בדיקת רמה מהירה</h2>
              <p className="text-on-surface-variant text-lg">לחץ על &quot;מכיר&quot; אם אתה יודע את המילה</p>
            </div>

            {/* Progress dots */}
            <div className="flex justify-center gap-2 mb-8">
              {assessmentWords.map((w, i) => (
                <div
                  key={w.id}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    i < assessmentIdx || (i === assessmentIdx && assessmentAnswers[w.id] !== undefined)
                      ? assessmentAnswers[w.id]
                        ? "bg-green-500 scale-110"
                        : "bg-red-400 scale-110"
                      : i === assessmentIdx
                        ? "bg-primary scale-125"
                        : "bg-surface-container-highest"
                  }`}
                />
              ))}
            </div>

            {/* Current word card */}
            {assessmentIdx < assessmentWords.length && !assessmentAnswers[assessmentWords[assessmentIdx].id] && assessmentAnswers[assessmentWords[assessmentIdx]?.id] === undefined ? (
              <div className="flex flex-col items-center">
                <div className="bg-surface-container-lowest rounded-3xl p-10 shadow-lg border border-outline-variant/10 w-full max-w-sm text-center mb-8">
                  <p className="text-xs text-on-surface-variant mb-3 font-medium">
                    {assessmentIdx + 1} / {assessmentWords.length}
                  </p>
                  <h3 className="text-4xl font-black font-body text-on-surface mb-2" dir="ltr">
                    {assessmentWords[assessmentIdx].word}
                  </h3>
                  <p className="text-sm text-on-surface-variant" dir="ltr">
                    {CATEGORY_DIFFICULTY[assessmentWords[assessmentIdx].category] === "easy" ? "Basic" : CATEGORY_DIFFICULTY[assessmentWords[assessmentIdx].category] === "hard" ? "Advanced" : "Intermediate"}
                  </p>
                </div>
                <div className="flex gap-4 w-full max-w-sm">
                  <button
                    onClick={() => handleAssessmentAnswer(false)}
                    className="flex-1 py-4 rounded-2xl bg-surface-container-highest text-on-surface-variant font-bold text-lg hover:bg-red-50 hover:text-red-600 transition-all active:scale-95 cursor-pointer"
                  >
                    לא מכיר 🤔
                  </button>
                  <button
                    onClick={() => handleAssessmentAnswer(true)}
                    className="flex-1 py-4 rounded-2xl bg-primary text-white font-bold text-lg hover:bg-primary/90 transition-all active:scale-95 cursor-pointer"
                  >
                    מכיר! ✓
                  </button>
                </div>
              </div>
            ) : (
              /* Assessment complete summary */
              <div className="flex flex-col items-center">
                <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-lg border border-outline-variant/10 w-full max-w-sm text-center">
                  <div className="w-20 h-20 rounded-full bg-primary-fixed flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl font-black text-primary font-body">{assessmentScore()}%</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">
                    {assessmentScore() >= 75 ? "מצוין! רמה גבוהה" : assessmentScore() >= 38 ? "רמה טובה!" : "יש מקום לצמוח!"}
                  </h3>
                  <p className="text-sm text-on-surface-variant mb-4">
                    הכרת {Object.values(assessmentAnswers).filter(Boolean).length} מתוך {assessmentWords.length} מילים
                  </p>

                  {showSuggestion && suggestedLevel && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mt-4">
                      <p className="text-sm text-amber-800 mb-3">
                        💡 לפי התוצאות, אנחנו ממליצים על רמת <strong>{suggestedLevel === "beginner" ? "מתחיל" : suggestedLevel === "intermediate" ? "בינוני" : "מתקדם"}</strong>
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => { setLevel(suggestedLevel); setShowSuggestion(false); }}
                          className="flex-1 py-2 rounded-xl bg-amber-600 text-white font-bold text-sm hover:bg-amber-700 transition-all cursor-pointer"
                        >
                          עדכן רמה
                        </button>
                        <button
                          onClick={() => setShowSuggestion(false)}
                          className="flex-1 py-2 rounded-xl bg-white text-amber-700 font-bold text-sm border border-amber-300 hover:bg-amber-50 transition-all cursor-pointer"
                        >
                          השאר כמו שזה
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 w-full bg-surface/80 backdrop-blur-lg border-t border-outline-variant/10 p-4 flex justify-center z-30">
        <div className="w-full max-w-2xl flex gap-3">
          {step > 1 && (
            <button
              onClick={back}
              className="px-6 py-4 rounded-2xl bg-surface-container-highest text-on-surface font-bold hover:bg-surface-container-high transition-all active:scale-95 cursor-pointer"
            >
              חזרה
            </button>
          )}
          <button
            onClick={next}
            disabled={!canProceed() || saving}
            className="flex-1 py-4 rounded-2xl bg-primary text-white font-bold text-lg shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
          >
            {saving ? (
              <span className="material-symbols-outlined animate-spin">sync</span>
            ) : step === TOTAL_STEPS ? (
              <>
                <span>סיום והתחלת למידה</span>
                <span className="material-symbols-outlined rotate-180">arrow_forward</span>
              </>
            ) : (
              <>
                <span>המשך</span>
                <span className="material-symbols-outlined rotate-180">arrow_forward</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
