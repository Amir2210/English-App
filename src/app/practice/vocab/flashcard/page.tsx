"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, updateDoc, setDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { type VocabItem, type Difficulty, shuffleArray, CATEGORY_EMOJI, getDifficulty } from "@/lib/vocab-utils";

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

function FlashcardPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("cat");

  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState<VocabItem[]>([]);
  const [allItems, setAllItems] = useState<VocabItem[]>([]);
  const [level, setLevel] = useState<Difficulty | "mix" | null>(null);
  const [cards, setCards] = useState<VocabItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);

  const [knownCount, setKnownCount] = useState(0);
  const [needsPracticeCount, setNeedsPracticeCount] = useState(0);

  const [knownWords, setKnownWords] = useState<Set<string>>(new Set());
  const [needsPracticeWords, setNeedsPracticeWords] = useState<Set<string>>(new Set());
  const userDocRef = useRef<ReturnType<typeof doc> | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        const snapshot = await getDocs(collection(db, "vocabulary"));
        const items: VocabItem[] = [];
        snapshot.forEach((d) => {
          items.push({ id: d.id, ...d.data() } as VocabItem);
        });

        let pool = items;
        if (categoryParam && categoryParam !== "all") {
          pool = items.filter((i) => i.category === categoryParam);
        }

        let known = new Set<string>();
        let needsPractice = new Set<string>();

        if (currentUser) {
          const uRef = doc(db, "users", currentUser.uid);
          userDocRef.current = uRef;
          const userSnap = await getDoc(uRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.knownWords) known = new Set(data.knownWords);
            if (data.needsPracticeWords) needsPractice = new Set(data.needsPracticeWords);
            setKnownWords(known);
            setNeedsPracticeWords(needsPractice);
          }
        }

        setTotalItems(pool);
        const notKnown = pool.filter((i) => !known.has(i.id));
        setAllItems(notKnown);
      } catch (err) {
        console.error("Failed to load vocabulary:", err);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [categoryParam]);

  const startWithLevel = (chosen: Difficulty | "mix") => {
    setLevel(chosen);
    let pool = totalItems.filter((i) => !knownWords.has(i.id));
    if (chosen !== "mix") {
      pool = pool.filter((i) => getDifficulty(i.category) === chosen);
    }
    setAllItems(totalItems.filter((i) => !knownWords.has(i.id)));
    setCards(shuffleArray(pool));
    setCurrentIndex(0);
    setFlipped(false);
    setAnswered(false);
    setDirection(null);
    setKnownCount(0);
    setNeedsPracticeCount(0);
  };

  const persistKnown = useCallback(async (vocabId: string) => {
    if (!userDocRef.current) return;
    try {
      await updateDoc(userDocRef.current, {
        knownWords: arrayUnion(vocabId),
        needsPracticeWords: arrayRemove(vocabId),
      });
    } catch {
      await setDoc(userDocRef.current!, { knownWords: [vocabId], needsPracticeWords: [] }, { merge: true });
    }
    setKnownWords((prev) => new Set(prev).add(vocabId));
    setNeedsPracticeWords((prev) => { const s = new Set(prev); s.delete(vocabId); return s; });
  }, []);

  const persistNeedsPractice = useCallback(async (vocabId: string) => {
    if (!userDocRef.current) return;
    try {
      await updateDoc(userDocRef.current, {
        needsPracticeWords: arrayUnion(vocabId),
        knownWords: arrayRemove(vocabId),
      });
    } catch {
      await setDoc(userDocRef.current!, { knownWords: [], needsPracticeWords: [vocabId] }, { merge: true });
    }
    setNeedsPracticeWords((prev) => new Set(prev).add(vocabId));
    setKnownWords((prev) => { const s = new Set(prev); s.delete(vocabId); return s; });
  }, []);

  const handleMark = async (type: "known" | "needs_practice") => {
    if (!cards[currentIndex]) return;
    setAnswered(true);

    const vocabId = cards[currentIndex].id;
    if (type === "known") {
      setDirection("right");
      setKnownCount((p) => p + 1);
      await persistKnown(vocabId);
    } else {
      setDirection("left");
      setNeedsPracticeCount((p) => p + 1);
      await persistNeedsPractice(vocabId);
    }

    setTimeout(() => {
      setDirection(null);
      setFlipped(false);
      setAnswered(false);
      setCurrentIndex((prev) => prev + 1);
    }, 500);
  };

  const isFinished = currentIndex >= cards.length && cards.length > 0;

  if (loading) {
    return (
      <div className="flex bg-surface min-h-screen items-center justify-center font-hebrew text-primary flex-col gap-4">
        <span className="material-symbols-outlined animate-spin text-5xl">sync</span>
        <span className="font-semibold text-lg animate-pulse">טוען כרטיסיות...</span>
      </div>
    );
  }

  if (level === null) {
    const totalCounts: Record<Difficulty | "mix", number> = { easy: 0, medium: 0, hard: 0, mix: totalItems.length };
    const knownCounts: Record<Difficulty | "mix", number> = { easy: 0, medium: 0, hard: 0, mix: 0 };
    const unseenCounts: Record<Difficulty | "mix", number> = { easy: 0, medium: 0, hard: 0, mix: allItems.length };
    totalItems.forEach((i) => {
      const d = getDifficulty(i.category);
      totalCounts[d]++;
      if (knownWords.has(i.id)) {
        knownCounts[d]++;
        knownCounts.mix++;
      }
    });
    allItems.forEach((i) => { unseenCounts[getDifficulty(i.category)]++; });

    const LEVEL_META: {
      key: Difficulty | "mix";
      label: string;
      desc: string;
      dotBg: string;
      dotGlow: string;
      iconBg: string;
      isShuffle?: boolean;
    }[] = [
        { key: "easy", label: "קל", desc: "מילים בסיסיות ויומיומיות", dotBg: "bg-emerald-500", dotGlow: "shadow-[0_0_15px_rgba(16,185,129,0.4)]", iconBg: "bg-emerald-100" },
        { key: "medium", label: "בינוני", desc: "מילים ברמה בינונית", dotBg: "bg-orange-500", dotGlow: "shadow-[0_0_15px_rgba(249,115,22,0.4)]", iconBg: "bg-orange-100" },
        { key: "hard", label: "קשה", desc: "מילים מתקדמות ואקדמיות", dotBg: "bg-rose-500", dotGlow: "shadow-[0_0_15px_rgba(244,63,94,0.4)]", iconBg: "bg-rose-100" },
        { key: "mix", label: "מיקס", desc: "כל הרמות ביחד", dotBg: "", dotGlow: "", iconBg: "bg-purple-100", isShuffle: true },
      ];

    return (
      <div className="bg-surface text-on-surface min-h-screen font-hebrew" dir="rtl">
        <div className="max-w-7xl mx-auto px-4 py-12 md:py-20 w-full">
          <button
            onClick={() => router.push("/practice/vocab")}
            className="flex items-center gap-1 text-primary mb-8 hover:underline font-medium"
          >
            <span className="material-symbols-outlined text-xl">arrow_forward</span>
            חזור
          </button>

          <div className="w-full mb-12 text-center md:text-right">
            <h1 className="font-headline text-4xl md:text-5xl font-extrabold text-on-surface mb-4 tracking-tight">כרטיסיות</h1>
            <p className="text-on-surface-variant text-lg max-w-2xl font-medium">בחר את רמת הקושי המתאימה לך כדי להתחיל בתרגול ממוקד</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
            {LEVEL_META.map(({ key, label, desc, dotBg, dotGlow, iconBg, isShuffle }) => {
              const total = totalCounts[key];
              const known = knownCounts[key];
              const unseen = unseenCounts[key];
              const remaining = total - known;
              const pct = total > 0 ? Math.round((known / total) * 100) : 0;
              const allDone = remaining === 0;
              return (
                <button
                  key={key}
                  disabled={unseen === 0}
                  onClick={() => startWithLevel(key)}
                  className="group bg-surface-container-lowest rounded-4xl p-8 flex flex-col h-80 md:h-[420px] lg:h-[480px] justify-between cursor-pointer text-right shadow-[0px_10px_40px_rgba(25,28,29,0.05)] transition-all duration-200 hover:bg-surface-container-high hover:-translate-y-1 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
                >
                  <div className="space-y-6">
                    <div className={`w-16 h-16 rounded-3xl ${iconBg} flex items-center justify-center shadow-inner`}>
                      {isShuffle ? (
                        <span className="material-symbols-outlined text-purple-600 text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>shuffle</span>
                      ) : (
                        <div className={`w-8 h-8 rounded-full ${dotBg} ${dotGlow}`} />
                      )}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold mb-2">{label}</h3>
                      <p className="text-on-surface-variant leading-relaxed">{desc}</p>
                    </div>
                  </div>
                  <div className="mt-auto space-y-3">
                    <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-on-surface font-bold text-lg">{known}/{total}</span>
                        {allDone ? (
                          <span className="text-green-600 text-xs font-semibold">סיימת הכל! 🎉</span>
                        ) : (
                          <span className="text-on-surface-variant text-xs">{total - known} מילים נותרו ללמוד</span>
                        )}
                      </div>
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-primary group-hover:bg-primary-fixed transition-colors">
                        <span className="material-symbols-outlined">arrow_back</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-20 w-full bg-primary-fixed/30 rounded-4xl p-10 flex flex-col md:flex-row items-center gap-8 border border-outline-variant/20">
            <div className="shrink-0">
              <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
              </div>
            </div>
            <div className="text-center md:text-right">
              <h4 className="text-xl font-bold text-primary mb-2">טיפ מהמומחים</h4>
              <p className="text-on-surface-variant font-medium">מומלץ להתחיל ברמה ה&quot;בינונית&quot; כדי להעריך את הידע הקיים שלך לפני המעבר למילים האקדמיות המורכבות יותר.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex bg-surface min-h-screen items-center justify-center font-hebrew flex-col gap-4 text-center px-6" dir="rtl">
        <span className="text-5xl">😕</span>
        <h2 className="text-2xl font-bold">אין מילים לתרגול</h2>
        <button onClick={() => router.push("/practice/vocab")} className="mt-4 px-8 py-3 bg-primary text-on-primary rounded-full font-bold">
          חזור
        </button>
      </div>
    );
  }

  const categoryLabel = categoryParam && categoryParam !== "all"
    ? `${CATEGORY_EMOJI[categoryParam] || "📚"} ${categoryParam}`
    : "כל הקטגוריות";

  if (isFinished) {
    const total = knownCount + needsPracticeCount;
    const percentage = total > 0 ? Math.round((knownCount / total) * 100) : 0;
    return (
      <div className="bg-surface text-on-surface min-h-screen flex flex-col items-center justify-center font-hebrew text-right px-6" dir="rtl">
        <div className="bg-surface-container-lowest max-w-lg w-full p-12 rounded-3xl shadow-[0px_10px_40px_rgba(25,28,29,0.05)] flex flex-col items-center gap-6 animate-fade-in-up text-center border border-outline-variant/20">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-2 ${percentage >= 70 ? "bg-green-100 text-green-600" : percentage >= 40 ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600"}`}>
            <span className="material-symbols-outlined text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              {percentage >= 70 ? "emoji_events" : percentage >= 40 ? "sentiment_neutral" : "mood_bad"}
            </span>
          </div>
          <h2 className="text-3xl font-bold font-headline">סיימת!</h2>
          <p className="text-5xl font-black font-body text-primary">{percentage}%</p>

          <div className="flex gap-8 text-center">
            <div>
              <p className="text-3xl font-black text-green-600">{knownCount}</p>
              <p className="text-sm text-on-surface-variant">יודע ✓</p>
            </div>
            <div>
              <p className="text-3xl font-black text-red-600">{needsPracticeCount}</p>
              <p className="text-sm text-on-surface-variant">לתרגול ✗</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full mt-4">
            <button
              onClick={() => {
                setCards(shuffleArray([...cards]));
                setCurrentIndex(0);
                setKnownCount(0);
                setNeedsPracticeCount(0);
                setFlipped(false);
                setAnswered(false);
              }}
              className="bg-primary text-on-primary w-full py-4 rounded-full font-bold text-lg hover:bg-primary/90 active:scale-95 transition-all"
            >
              שחק שוב
            </button>
            <button
              onClick={() => { setLevel(null); setCards([]); setCurrentIndex(0); setKnownCount(0); setNeedsPracticeCount(0); setAllItems(totalItems.filter((i) => !knownWords.has(i.id))); }}
              className="bg-surface-container-highest text-on-surface w-full py-4 rounded-full font-bold text-lg hover:bg-surface-container-high active:scale-95 transition-all"
            >
              בחר רמה אחרת
            </button>
            <button
              onClick={() => router.push("/practice/vocab")}
              className="text-on-surface-variant w-full py-3 rounded-full font-bold text-base hover:bg-surface-container-highest active:scale-95 transition-all"
            >
              חזור לתפריט
            </button>
          </div>
        </div>
      </div>
    );
  }

  const current = cards[currentIndex];
  const sentence = current.exampleSentence || `This is an example of "${current.word}" in context.`;
  const progressPercent = (currentIndex / cards.length) * 100;

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col items-center font-hebrew antialiased" dir="rtl">
      {/* Header */}
      <header className="w-full max-w-3xl px-6 py-5 flex items-center gap-4">
        <button
          onClick={() => { setLevel(null); setCards([]); setCurrentIndex(0); setKnownCount(0); setNeedsPracticeCount(0); setAllItems(totalItems.filter((i) => !knownWords.has(i.id))); }}
          className="material-symbols-outlined text-outline hover:text-on-surface-variant transition-colors p-2 -mr-2 cursor-pointer"
        >
          arrow_forward
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold font-headline">כרטיסיות</h1>
          <p className="text-sm text-on-surface-variant">{categoryLabel}</p>
        </div>
        <div className="text-left text-sm font-bold">
          <span className="text-on-surface">{currentIndex + 1} / {cards.length}</span>
          <p className="text-xs text-on-surface-variant font-medium">{cards.length - currentIndex - 1} נותרו</p>
        </div>
      </header>

      {/* Progress bar */}
      <div className="w-full max-w-3xl px-6 mb-6">
        <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Counters */}
      <div className="flex gap-6 mb-6">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-green-600 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          <span className="font-bold text-green-700">{knownCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-red-500 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
          <span className="font-bold text-red-600">{needsPracticeCount}</span>
        </div>
      </div>

      {/* Card */}
      <main className="w-full max-w-3xl px-6 flex-1 flex flex-col items-center">
        <div
          className="w-full max-w-md relative"
          style={{ perspective: "1000px" }}
        >
          {/* Stack card 3 (deepest) */}
          {currentIndex + 2 < cards.length && (
            <div
              className="absolute inset-0 rounded-3xl bg-surface-container-highest border-2 border-outline-variant/10 aspect-3/4"
              style={{ transform: "scale(0.9) translateY(16px)", opacity: 0.4, zIndex: 1 }}
            />
          )}
          {/* Stack card 2 (middle) */}
          {currentIndex + 1 < cards.length && (
            <div
              className="absolute inset-0 rounded-3xl bg-surface-container-high border-2 border-outline-variant/15 aspect-3/4"
              style={{ transform: "scale(0.95) translateY(8px)", opacity: 0.6, zIndex: 2 }}
            />
          )}
          {/* Active card */}
          <div
            key={currentIndex}
            onClick={() => { if (!flipped && !answered) setFlipped(true); }}
            className="relative w-full aspect-3/4 cursor-pointer"
            style={{
              transformStyle: "preserve-3d",
              zIndex: 3,
              transform: direction === "right"
                ? "rotateY(180deg) translateX(-120%) rotate(8deg)"
                : direction === "left"
                  ? "rotateY(180deg) translateX(120%) rotate(-8deg)"
                  : flipped
                    ? "rotateY(180deg)"
                    : "rotateY(0deg)",
              opacity: direction ? 0 : 1,
              transition: direction
                ? "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1)"
                : "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
              animation: !direction && !flipped ? "cardIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)" : undefined,
            }}
          >
            {/* Front — English word */}
            <div
              className="absolute inset-0 rounded-3xl bg-surface-container-lowest border-2 border-outline-variant/20 shadow-[0px_8px_30px_rgba(25,28,29,0.08)] flex flex-col items-center justify-center p-8"
              style={{ backfaceVisibility: "hidden" }}
            >
              <h2 className="text-4xl md:text-5xl font-black font-body text-primary" dir="ltr">
                {current.word}
              </h2>
              <button
                onClick={(e) => { e.stopPropagation(); speakWord(current.word); }}
                className="mt-4 w-12 h-12 rounded-full bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                title="שמע הגייה"
              >
                <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>volume_up</span>
              </button>
              <p className="mt-4 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-base align-middle ml-1">touch_app</span>
                לחץ כדי להפוך
              </p>
              <span className="absolute top-5 left-5 text-xs font-bold text-on-surface-variant bg-surface-container-highest px-3 py-1 rounded-full font-body" dir="ltr">
                {current.category}
              </span>
            </div>

            {/* Back — Hebrew + sentence */}
            <div
              className="absolute inset-0 rounded-3xl bg-primary text-on-primary shadow-[0px_8px_30px_rgba(25,28,29,0.12)] flex flex-col items-center justify-center p-8"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              <h2 className="text-4xl md:text-5xl font-black mb-4">
                {current.correctAnswer}
              </h2>
              <div className="w-16 h-0.5 bg-on-primary/30 rounded-full mb-4" />
              <div className="flex items-center gap-3">
                <p className="text-xl font-body font-bold opacity-90" dir="ltr">
                  {current.word}
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); speakWord(current.word); }}
                  className="w-9 h-9 rounded-full bg-on-primary/15 hover:bg-on-primary/25 text-on-primary flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                  title="שמע הגייה"
                >
                  <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>volume_up</span>
                </button>
              </div>
              <div className="mt-6 bg-on-primary/10 rounded-2xl px-5 py-4 w-full">
                <p className="text-base font-body text-center leading-relaxed opacity-90" dir="ltr">
                  &ldquo;{sentence}&rdquo;
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons — only after flip */}
        {flipped && !answered && (
          <div className="flex gap-4 mt-8 animate-fade-in-up w-full max-w-md">
            <button
              onClick={() => handleMark("needs_practice")}
              className="flex-1 py-4 rounded-2xl bg-red-500 text-white font-bold text-lg flex items-center justify-center gap-2 hover:bg-red-600 active:scale-95 transition-all shadow-md"
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>close</span>
              לא יודע
            </button>
            <button
              onClick={() => handleMark("known")}
              className="flex-1 py-4 rounded-2xl bg-green-500 text-white font-bold text-lg flex items-center justify-center gap-2 hover:bg-green-600 active:scale-95 transition-all shadow-md"
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
              יודע
            </button>
          </div>
        )}

        {/* Tap hint when not flipped */}
        {!flipped && !answered && (
          <div className="mt-8 text-on-surface-variant text-sm animate-pulse text-center">
            👆 לחץ על הכרטיסייה כדי לגלות את התרגום
          </div>
        )}
      </main>
    </div>
  );
}

export default function FlashcardPage() {
  return (
    <Suspense fallback={
      <div className="flex bg-surface min-h-screen items-center justify-center font-hebrew text-primary flex-col gap-4">
        <span className="material-symbols-outlined animate-spin text-5xl">sync</span>
        <span className="font-semibold text-lg animate-pulse">טוען כרטיסיות...</span>
      </div>
    }>
      <FlashcardPageInner />
    </Suspense>
  );
}
