"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, updateDoc, setDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { type VocabItem, type Difficulty, shuffleArray, CATEGORY_EMOJI, getDifficulty } from "@/lib/vocab-utils";

const PAIR_COLORS = [
  { bg: "bg-[#5E7AC4]", border: "border-[#3d5a9e]", text: "text-white" },
  { bg: "bg-[#F3BE7A]", border: "border-[#c9953a]", text: "text-[#1a1a1a]" },
  { bg: "bg-[#D5E7B5]", border: "border-[#a3c471]", text: "text-[#1a1a1a]" },
  { bg: "bg-[#F9D0CD]", border: "border-[#e09d97]", text: "text-[#1a1a1a]" },
  { bg: "bg-[#BD114A]", border: "border-[#8e0c37]", text: "text-white" },
  { bg: "bg-[#BFA28C]", border: "border-[#8f7560]", text: "text-[#1a1a1a]" },
  { bg: "bg-[#612D53]", border: "border-[#401936]", text: "text-white" },
  { bg: "bg-[#8100D1]", border: "border-[#5c0096]", text: "text-white" },
  { bg: "bg-[#BFC9D1]", border: "border-[#8a99a5]", text: "text-[#1a1a1a]" },
  { bg: "bg-[#84994F]", border: "border-[#5e6e38]", text: "text-white" },
];

function nextAvailableColorIdx(matches: Map<string, { hebId: string; colorIdx: number }>): number {
  const used = new Set([...matches.values()].map((v) => v.colorIdx));
  let i = 0;
  while (used.has(i) && i < PAIR_COLORS.length) i++;
  return i % PAIR_COLORS.length;
}

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

const ROUND_SIZE = 10;

type MatchStatus = "picking" | "playing" | "results";

interface MatchPair {
  vocabId: string;
  word: string;
  correctHebrew: string;
}

function VocabMatchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("cat");

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<MatchStatus>("picking");

  const [totalItems, setTotalItems] = useState<VocabItem[]>([]);
  const [allItems, setAllItems] = useState<VocabItem[]>([]);
  const [level, setLevel] = useState<Difficulty | "mix" | null>(null);

  const [pairs, setPairs] = useState<MatchPair[]>([]);
  const [shuffledEnglish, setShuffledEnglish] = useState<MatchPair[]>([]);
  const [shuffledHebrew, setShuffledHebrew] = useState<MatchPair[]>([]);

  const [selectedSide, setSelectedSide] = useState<"eng" | "heb" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingColorIdx, setPendingColorIdx] = useState<number | null>(null);

  const [matches, setMatches] = useState<Map<string, { hebId: string; colorIdx: number }>>(new Map());

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

        if (currentUser) {
          const uRef = doc(db, "users", currentUser.uid);
          userDocRef.current = uRef;
          const userSnap = await getDoc(uRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.knownWords) known = new Set(data.knownWords);
            if (data.needsPracticeWords) setNeedsPracticeWords(new Set(data.needsPracticeWords));
            setKnownWords(known);
          }
        }

        setTotalItems(pool);
        setAllItems(pool.filter((i) => !known.has(i.id)));
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
    const count = Math.min(pool.length, ROUND_SIZE);
    const selected = shuffleArray(pool).slice(0, count);
    const matchPairs: MatchPair[] = selected.map((v) => ({
      vocabId: v.id,
      word: v.word,
      correctHebrew: v.correctAnswer,
    }));
    setPairs(matchPairs);
    setShuffledEnglish(shuffleArray([...matchPairs]));
    setShuffledHebrew(shuffleArray([...matchPairs]));
    setMatches(new Map());
    setSelectedSide(null);
    setSelectedId(null);
    setPendingColorIdx(null);
    setStatus("playing");
  };

  const goBackToPicker = () => {
    setLevel(null);
    setStatus("picking");
    setPairs([]);
    setMatches(new Map());
    setSelectedSide(null);
    setSelectedId(null);
    setPendingColorIdx(null);
    setAllItems(totalItems.filter((i) => !knownWords.has(i.id)));
  };

  const getColorForEng = (engId: string): typeof PAIR_COLORS[0] | null => {
    const m = matches.get(engId);
    return m ? PAIR_COLORS[m.colorIdx % PAIR_COLORS.length] : null;
  };

  const getColorForHeb = (hebId: string): typeof PAIR_COLORS[0] | null => {
    const entry = [...matches.entries()].find(([, v]) => v.hebId === hebId);
    return entry ? PAIR_COLORS[entry[1].colorIdx % PAIR_COLORS.length] : null;
  };

  const getEngForHeb = (hebId: string): string | undefined => {
    return [...matches.entries()].find(([, v]) => v.hebId === hebId)?.[0];
  };

  const handleCardClick = (side: "eng" | "heb", vocabId: string) => {
    if (status === "results") return;

    // If clicking a matched card, unmatch it
    if (side === "eng" && matches.has(vocabId)) {
      setMatches((prev) => {
        const next = new Map(prev);
        next.delete(vocabId);
        return next;
      });
      setSelectedSide(null);
      setSelectedId(null);
      setPendingColorIdx(null);
      return;
    }
    if (side === "heb") {
      const engKey = getEngForHeb(vocabId);
      if (engKey) {
        setMatches((prev) => {
          const next = new Map(prev);
          next.delete(engKey);
          return next;
        });
        setSelectedSide(null);
        setSelectedId(null);
        setPendingColorIdx(null);
        return;
      }
    }

    // Nothing selected yet — select this card
    if (!selectedSide || !selectedId) {
      setPendingColorIdx(nextAvailableColorIdx(matches));
      setSelectedSide(side);
      setSelectedId(vocabId);
      return;
    }

    // Same side clicked — switch selection
    if (selectedSide === side) {
      setSelectedSide(side);
      setSelectedId(vocabId);
      return;
    }

    // Different sides — create a match
    const engId = side === "eng" ? vocabId : selectedId;
    const hebId = side === "heb" ? vocabId : selectedId;

    setMatches((prev) => {
      const next = new Map(prev);
      if (next.has(engId)) next.delete(engId);
      const existingEngForHeb = [...next.entries()].find(([, v]) => v.hebId === hebId);
      if (existingEngForHeb) next.delete(existingEngForHeb[0]);

      const colorIdx =
        pendingColorIdx !== null ? pendingColorIdx : nextAvailableColorIdx(next);
      next.set(engId, { hebId, colorIdx });
      return next;
    });
    setSelectedSide(null);
    setSelectedId(null);
    setPendingColorIdx(null);
  };

  const allMatched = matches.size === pairs.length && pairs.length > 0;

  const getResult = (engId: string): "correct" | "incorrect" | null => {
    if (status !== "results") return null;
    const m = matches.get(engId);
    if (!m) return null;
    return engId === m.hebId ? "correct" : "incorrect";
  };

  const [wordDecisions, setWordDecisions] = useState<Map<string, "known" | "practice">>(new Map());

  const toggleWordDecision = (vocabId: string) => {
    setWordDecisions((prev) => {
      const next = new Map(prev);
      const current = next.get(vocabId);
      next.set(vocabId, current === "known" ? "practice" : "known");
      return next;
    });
  };

  const persistDecisions = useCallback(async () => {
    if (!userDocRef.current) return;
    const toKnown: string[] = [];
    const toPractice: string[] = [];

    wordDecisions.forEach((decision, id) => {
      if (decision === "known") toKnown.push(id);
      else toPractice.push(id);
    });

    for (const id of toKnown) {
      try {
        await updateDoc(userDocRef.current!, {
          knownWords: arrayUnion(id),
          needsPracticeWords: arrayRemove(id),
        });
      } catch {
        await setDoc(userDocRef.current!, { knownWords: [id], needsPracticeWords: [] }, { merge: true });
      }
    }

    for (const id of toPractice) {
      try {
        await updateDoc(userDocRef.current!, {
          needsPracticeWords: arrayUnion(id),
          knownWords: arrayRemove(id),
        });
      } catch {
        await setDoc(userDocRef.current!, { knownWords: [], needsPracticeWords: [id] }, { merge: true });
      }
    }

    setKnownWords((prev) => {
      const s = new Set(prev);
      toKnown.forEach((id) => s.add(id));
      toPractice.forEach((id) => s.delete(id));
      return s;
    });
    setNeedsPracticeWords((prev) => {
      const s = new Set(prev);
      toPractice.forEach((id) => s.add(id));
      toKnown.forEach((id) => s.delete(id));
      return s;
    });
  }, [wordDecisions]);

  const handleFinish = () => {
    const decisions = new Map<string, "known" | "practice">();
    matches.forEach(({ hebId }, engId) => {
      decisions.set(engId, engId === hebId ? "known" : "practice");
    });
    setWordDecisions(decisions);
    setStatus("results");
  };

  const handlePlayAgain = () => {
    setShuffledEnglish(shuffleArray([...pairs]));
    setShuffledHebrew(shuffleArray([...pairs]));
    setMatches(new Map());
    setSelectedSide(null);
    setSelectedId(null);
    setPendingColorIdx(null);
    setStatus("playing");
  };

  const correctCount = status === "results"
    ? [...matches.entries()].filter(([e, { hebId }]) => e === hebId).length
    : 0;

  if (loading) {
    return (
      <div className="flex bg-surface min-h-screen items-center justify-center font-hebrew text-primary flex-col gap-4">
        <span className="material-symbols-outlined animate-spin text-5xl">sync</span>
        <span className="font-semibold text-lg animate-pulse">טוען משחק התאמה...</span>
      </div>
    );
  }

  if (status === "picking") {
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
            <h1 className="font-headline text-4xl md:text-5xl font-extrabold text-on-surface mb-4 tracking-tight">משחק התאמה</h1>
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
                  disabled={unseen < 2}
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
                        ) : unseen < 2 ? (
                          <span className="text-on-surface-variant text-xs">צריך לפחות 2 מילים</span>
                        ) : (
                          <span className="text-on-surface-variant text-xs">{remaining} מילים נותרו ללמוד</span>
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
              <p className="text-on-surface-variant font-medium">חבר בין המילה באנגלית לתרגום הנכון בעברית. רק אחרי שתסיים את כל הזוגות תוכל לראות את התוצאות.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (pairs.length === 0) {
    return (
      <div className="flex bg-surface min-h-screen items-center justify-center font-hebrew flex-col gap-4 text-center px-6" dir="rtl">
        <span className="text-5xl">😕</span>
        <h2 className="text-2xl font-bold">אין מספיק מילים</h2>
        <p className="text-on-surface-variant">צריך לפחות {ROUND_SIZE} מילים בקטגוריה הזו</p>
        <button onClick={() => goBackToPicker()} className="mt-4 px-8 py-3 bg-primary text-on-primary rounded-full font-bold">
          חזור
        </button>
      </div>
    );
  }

  const categoryLabel = categoryParam && categoryParam !== "all"
    ? `${CATEGORY_EMOJI[categoryParam] || "📚"} ${categoryParam}`
    : "כל הקטגוריות";

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col items-center font-hebrew antialiased" dir="rtl">
      {/* Header */}
      <header className="w-full max-w-4xl px-6 py-5 flex items-center gap-4">
        <button
          onClick={() => goBackToPicker()}
          className="material-symbols-outlined text-outline hover:text-on-surface-variant transition-colors p-2 -mr-2 cursor-pointer"
        >
          arrow_forward
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold font-headline">משחק התאמה</h1>
          <p className="text-sm text-on-surface-variant">{categoryLabel}</p>
        </div>
        {status === "results" && (
          <div className="text-left">
            <span className={`text-2xl font-black ${correctCount >= 7 ? "text-green-600" : correctCount >= 4 ? "text-amber-600" : "text-red-600"}`}>
              {correctCount}/{pairs.length}
            </span>
          </div>
        )}
      </header>

      {/* Instructions */}
      {status === "playing" && (
        <div className="max-w-4xl w-full px-6 mb-4">
          <p className="text-sm text-on-surface-variant text-center bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-4 py-3">
            <span className="material-symbols-outlined text-base align-middle ml-1">info</span>
            לחץ על מילה באנגלית ועל התרגום בעברית — הזוג יסומן באותו צבע. לחץ על זוג צבעוני כדי לבטל בחירה.
          </p>
        </div>
      )}

      {/* Main matching area */}
      <main className="w-full max-w-4xl px-6 flex-1 pb-32">
        <div className="flex justify-between gap-3 sm:gap-6">

          {/* English column */}
          <div className="flex flex-col gap-2.5 flex-1 max-w-[48%]">
            <div className="text-center mb-2">
              <span className="text-xs font-bold text-on-surface-variant bg-surface-container-highest px-3 py-1 rounded-full">
                English
              </span>
            </div>
            {shuffledEnglish.map((pair) => {
              const color = getColorForEng(pair.vocabId);
              const isSelected = selectedSide === "eng" && selectedId === pair.vocabId;
              const pendingColor =
                isSelected && pendingColorIdx !== null ? PAIR_COLORS[pendingColorIdx % PAIR_COLORS.length] : null;
              const result = getResult(pair.vocabId);

              let cardClass: string;
              let textClass = "text-on-surface";
              if (result === "correct") {
                cardClass = "bg-green-500 border-2 border-green-700 ring-2 ring-green-300";
                textClass = "text-white";
              } else if (result === "incorrect") {
                cardClass = "bg-red-500 border-2 border-red-700 ring-2 ring-red-300";
                textClass = "text-white";
              } else if (color) {
                cardClass = `${color.bg} border-2 ${color.border} shadow-md`;
                textClass = color.text;
              } else if (pendingColor) {
                cardClass = `${pendingColor.bg} border-2 ${pendingColor.border} shadow-md scale-[1.03] ring-2 ring-black/10`;
                textClass = pendingColor.text;
              } else {
                cardClass = "bg-surface-container-lowest border-2 border-outline-variant/20 hover:border-primary/40 hover:shadow-sm";
              }

              return (
                <button
                  key={pair.vocabId}
                  onClick={() => handleCardClick("eng", pair.vocabId)}
                  disabled={status === "results"}
                  className={`relative flex items-center gap-2 px-4 py-3.5 rounded-xl font-bold text-base transition-all duration-200 active:scale-[0.97] font-body ${cardClass}`}
                  dir="ltr"
                >
                  {result === "correct" && (
                    <span className="material-symbols-outlined text-white text-lg shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  )}
                  {result === "incorrect" && (
                    <span className="material-symbols-outlined text-white text-lg shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
                  )}
                  <span className={`flex-1 ${textClass}`}>{pair.word}</span>
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => { e.stopPropagation(); speakWord(pair.word); }}
                    className={`material-symbols-outlined text-lg shrink-0 opacity-60 hover:opacity-100 transition-opacity ${textClass}`}
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    volume_up
                  </span>
                </button>
              );
            })}
          </div>

          {/* Hebrew column */}
          <div className="flex flex-col gap-2.5 flex-1 max-w-[48%]">
            <div className="text-center mb-2">
              <span className="text-xs font-bold text-on-surface-variant bg-surface-container-highest px-3 py-1 rounded-full">
                עברית
              </span>
            </div>
            {shuffledHebrew.map((pair) => {
              const color = getColorForHeb(pair.vocabId);
              const isSelected = selectedSide === "heb" && selectedId === pair.vocabId;
              const pendingColor =
                isSelected && pendingColorIdx !== null ? PAIR_COLORS[pendingColorIdx % PAIR_COLORS.length] : null;
              const engKey = getEngForHeb(pair.vocabId);
              const result = engKey ? getResult(engKey) : null;

              let cardClass: string;
              let textClass = "text-on-surface";
              if (result === "correct") {
                cardClass = "bg-green-500 border-2 border-green-700 ring-2 ring-green-300";
                textClass = "text-white";
              } else if (result === "incorrect") {
                cardClass = "bg-red-500 border-2 border-red-700 ring-2 ring-red-300";
                textClass = "text-white";
              } else if (color) {
                cardClass = `${color.bg} border-2 ${color.border} shadow-md`;
                textClass = color.text;
              } else if (pendingColor) {
                cardClass = `${pendingColor.bg} border-2 ${pendingColor.border} shadow-md scale-[1.03] ring-2 ring-black/10`;
                textClass = pendingColor.text;
              } else {
                cardClass = "bg-surface-container-lowest border-2 border-outline-variant/20 hover:border-primary/40 hover:shadow-sm";
              }

              return (
                <button
                  key={`heb-${pair.vocabId}`}
                  onClick={() => handleCardClick("heb", pair.vocabId)}
                  disabled={status === "results"}
                  className={`relative flex items-center justify-end gap-2 px-4 py-3.5 rounded-xl font-bold text-base transition-all duration-200 active:scale-[0.97] ${cardClass}`}
                >
                  <span className={textClass}>{pair.correctHebrew}</span>
                  {result === "correct" && (
                    <span className="material-symbols-outlined text-white text-lg shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  )}
                  {result === "incorrect" && (
                    <span className="material-symbols-outlined text-white text-lg shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results breakdown */}
        {status === "results" && (
          <div className="mt-8 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-6">
            <h3 className="font-bold text-lg mb-4 text-center">תוצאות</h3>
            <p className="text-xs text-on-surface-variant text-center mb-4">לחץ על הכפתור כדי לשנות את הסטטוס של כל מילה</p>
            <div className="space-y-3">
              {pairs.map((pair) => {
                const m = matches.get(pair.vocabId);
                const isCorrect = m?.hebId === pair.vocabId;
                const wrongHebrew = !isCorrect && m
                  ? pairs.find((p) => p.vocabId === m.hebId)?.correctHebrew
                  : null;
                const decision = wordDecisions.get(pair.vocabId) || "practice";
                const isKnown = decision === "known";

                return (
                  <div
                    key={pair.vocabId}
                    className={`flex items-center gap-3 p-3 rounded-xl text-sm ${isCorrect ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}
                  >
                    <span
                      className={`material-symbols-outlined text-lg ${isCorrect ? "text-green-600" : "text-red-600"}`}
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {isCorrect ? "check_circle" : "cancel"}
                    </span>
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold font-body" dir="ltr">{pair.word}</span>
                        <button
                          onClick={() => speakWord(pair.word)}
                          className="material-symbols-outlined text-sm opacity-50 hover:opacity-100 transition-opacity text-on-surface"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          volume_up
                        </button>
                        <span className="text-on-surface-variant">=</span>
                        <span className="font-bold">{pair.correctHebrew}</span>
                      </div>
                      {wrongHebrew && (
                        <span className="text-red-500 text-xs">(בחרת: {wrongHebrew})</span>
                      )}
                    </div>
                    {isCorrect && (
                      <button
                        onClick={() => toggleWordDecision(pair.vocabId)}
                        className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 ${
                          !isKnown
                            ? "bg-orange-500 text-white border border-orange-600"
                            : "bg-surface-container-highest text-on-surface-variant border border-outline-variant/30 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200"
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>replay</span>
                        {!isKnown ? "יעבור לתרגול" : "העבר לתרגול"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Bottom bar */}
      <div className={`fixed bottom-0 left-0 w-full p-6 flex justify-center transition-all ${status === "results"
        ? correctCount >= 7 ? "bg-green-100 border-t border-green-200" : "bg-red-100 border-t border-red-200"
        : "bg-white/80 backdrop-blur-xl border-t border-outline-variant/20"
        }`}>
        <div className="w-full max-w-4xl flex items-center justify-between gap-4">
          {status === "playing" && (
            <>
              <div className="flex items-center gap-3">
                <p className="text-sm text-on-surface-variant">
                  <strong>{matches.size}</strong> / {pairs.length} זוגות
                </p>
                {/* Mini color legend */}
                <div className="flex gap-1">
                  {[...matches.values()].map(({ colorIdx }, i) => (
                    <span key={i} className={`w-2.5 h-2.5 rounded-full ${PAIR_COLORS[colorIdx % PAIR_COLORS.length].bg}`} />
                  ))}
                </div>
              </div>
              <button
                onClick={handleFinish}
                disabled={!allMatched}
                className={`py-4 px-10 rounded-full font-bold text-lg text-white transition-all active:scale-95 shadow-md ${allMatched
                  ? "bg-primary hover:bg-primary/90"
                  : "bg-outline/30 cursor-not-allowed"
                  }`}
              >
                סיימתי
              </button>
            </>
          )}
          {status === "results" && (
            <>
              <div className="flex-1 text-right">
                <p className={`font-bold text-lg ${correctCount >= 7 ? "text-green-800" : correctCount >= 4 ? "text-amber-800" : "text-red-800"}`}>
                  {correctCount >= 7 ? "מעולה!" : correctCount >= 4 ? "לא רע!" : "המשך לתרגל!"}
                </p>
                <p className="text-sm text-on-surface-variant">
                  {correctCount} נכונים, {pairs.length - correctCount} שגויים
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={async () => { await persistDecisions(); handlePlayAgain(); }}
                  className="py-3 px-6 rounded-full font-bold text-sm bg-primary text-on-primary hover:bg-primary/90 active:scale-95 transition-all shadow-md"
                >
                  שחק שוב
                </button>
                <button
                  onClick={async () => { await persistDecisions(); goBackToPicker(); }}
                  className="py-3 px-6 rounded-full font-bold text-sm bg-surface-container-highest text-on-surface hover:bg-surface-container-high active:scale-95 transition-all"
                >
                  בחר רמה אחרת
                </button>
                <button
                  onClick={async () => { await persistDecisions(); router.push("/practice/vocab"); }}
                  className="py-3 px-6 rounded-full font-bold text-sm text-on-surface-variant hover:bg-surface-container-highest active:scale-95 transition-all"
                >
                  חזור לתפריט
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VocabMatchPage() {
  return (
    <Suspense fallback={
      <div className="flex bg-surface min-h-screen items-center justify-center font-hebrew text-primary flex-col gap-4">
        <span className="material-symbols-outlined animate-spin text-5xl">sync</span>
        <span className="font-semibold text-lg animate-pulse">טוען משחק התאמה...</span>
      </div>
    }>
      <VocabMatchPageInner />
    </Suspense>
  );
}
