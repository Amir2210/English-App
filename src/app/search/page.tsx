"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { CATEGORY_EMOJI, CATEGORY_HEBREW, type VocabItem } from "@/lib/vocab-utils";

const MAX_RESULTS = 100;
const DEBOUNCE_MS = 150;

type WordStatus = "known" | "needs_practice" | "new";

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

interface RankedResult {
  item: VocabItem;
  score: number;
}

function rankResults(items: VocabItem[], rawQuery: string): VocabItem[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return [];
  const scored: RankedResult[] = [];
  for (const item of items) {
    const wordL = item.word.toLowerCase();
    const heb = item.correctAnswer;
    let score = 0;
    if (wordL === q || heb === q) score = 100;
    else if (wordL.startsWith(q) || heb.startsWith(q)) score = 80;
    else if (wordL.includes(q) || heb.includes(q)) score = 50;
    if (score > 0) scored.push({ item, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.item.word.localeCompare(b.item.word))
    .slice(0, MAX_RESULTS)
    .map((r) => r.item);
}

interface CategoryMatch {
  key: string;
  hebrew: string;
  emoji: string;
  count: number;
  known: number;
}

const MAX_CATEGORY_RESULTS = 5;

function rankCategoryResults(
  items: VocabItem[],
  knownWords: Set<string>,
  rawQuery: string,
): CategoryMatch[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return [];

  const counts = new Map<string, { total: number; known: number }>();
  for (const item of items) {
    const stats = counts.get(item.category) ?? { total: 0, known: 0 };
    stats.total += 1;
    if (knownWords.has(item.id)) stats.known += 1;
    counts.set(item.category, stats);
  }

  const scored: { match: CategoryMatch; score: number }[] = [];
  counts.forEach((stats, key) => {
    const keyL = key.toLowerCase();
    const heb = CATEGORY_HEBREW[key] || "";
    let score = 0;
    if (keyL === q || heb === q) score = 100;
    else if (keyL.startsWith(q) || heb.startsWith(q)) score = 80;
    else if (keyL.includes(q) || heb.includes(q)) score = 50;
    if (score > 0) {
      scored.push({
        match: {
          key,
          hebrew: heb || key,
          emoji: CATEGORY_EMOJI[key] || "📚",
          count: stats.total,
          known: stats.known,
        },
        score,
      });
    }
  });

  return scored
    .sort((a, b) => b.score - a.score || a.match.key.localeCompare(b.match.key))
    .slice(0, MAX_CATEGORY_RESULTS)
    .map((s) => s.match);
}

const SUGGESTED_QUERIES = ["travel", "בית", "food", "עבודה", "family"];

export default function SearchPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [allItems, setAllItems] = useState<VocabItem[]>([]);
  const [knownWords, setKnownWords] = useState<Set<string>>(new Set());
  const [needsPracticeWords, setNeedsPracticeWords] = useState<Set<string>>(new Set());
  const userDocRef = useRef<ReturnType<typeof doc> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/");
        return;
      }
      setUser(currentUser);
      try {
        const snap = await getDocs(collection(db, "vocabulary"));
        const items: VocabItem[] = [];
        snap.forEach((d) => items.push({ id: d.id, ...d.data() } as VocabItem));
        setAllItems(items);

        const uRef = doc(db, "users", currentUser.uid);
        userDocRef.current = uRef;
        const userSnap = await getDoc(uRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data.knownWords) setKnownWords(new Set(data.knownWords));
          if (data.needsPracticeWords) setNeedsPracticeWords(new Set(data.needsPracticeWords));
        }
      } catch (err) {
        console.error("Search load error:", err);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setExpandedId(null);
  }, [debouncedQuery]);

  const results = useMemo(
    () => rankResults(allItems, debouncedQuery),
    [allItems, debouncedQuery],
  );

  const categoryResults = useMemo(
    () => rankCategoryResults(allItems, knownWords, debouncedQuery),
    [allItems, knownWords, debouncedQuery],
  );

  const getStatus = useCallback(
    (id: string): WordStatus => {
      if (knownWords.has(id)) return "known";
      if (needsPracticeWords.has(id)) return "needs_practice";
      return "new";
    },
    [knownWords, needsPracticeWords],
  );

  const markKnown = useCallback(async (id: string) => {
    if (!userDocRef.current) return;
    try {
      await updateDoc(userDocRef.current, {
        knownWords: arrayUnion(id),
        needsPracticeWords: arrayRemove(id),
      });
    } catch {
      await setDoc(
        userDocRef.current,
        { knownWords: [id], needsPracticeWords: [] },
        { merge: true },
      );
    }
    setKnownWords((prev) => new Set(prev).add(id));
    setNeedsPracticeWords((prev) => {
      const s = new Set(prev);
      s.delete(id);
      return s;
    });
  }, []);

  const markNeedsPractice = useCallback(async (id: string) => {
    if (!userDocRef.current) return;
    try {
      await updateDoc(userDocRef.current, {
        needsPracticeWords: arrayUnion(id),
        knownWords: arrayRemove(id),
      });
    } catch {
      await setDoc(
        userDocRef.current,
        { knownWords: [], needsPracticeWords: [id] },
        { merge: true },
      );
    }
    setNeedsPracticeWords((prev) => new Set(prev).add(id));
    setKnownWords((prev) => {
      const s = new Set(prev);
      s.delete(id);
      return s;
    });
  }, []);

  if (loading) {
    return (
      <div className="flex bg-surface min-h-screen items-center justify-center font-hebrew text-primary flex-col gap-4">
        <span className="material-symbols-outlined animate-spin text-5xl">sync</span>
        <span className="font-semibold text-lg animate-pulse">טוען חיפוש...</span>
      </div>
    );
  }

  const trimmed = debouncedQuery.trim();
  const showResults = trimmed.length > 0;
  const noMatches = showResults && results.length === 0 && categoryResults.length === 0;

  return (
    <div
      className="bg-surface text-on-surface min-h-screen flex flex-col items-center font-hebrew antialiased"
      dir="rtl"
    >
      <header className="w-full max-w-4xl px-6 pt-6 pb-3 flex items-center gap-4">
        <button
          onClick={() => router.push("/dashboard")}
          className="material-symbols-outlined text-outline hover:text-on-surface-variant transition-colors p-2 -mr-2 cursor-pointer"
          aria-label="חזור ללוח הבקרה"
        >
          arrow_forward
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold font-headline text-on-surface">חיפוש מילים</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            חפש באנגלית או בעברית · {allItems.length} מילים במאגר
          </p>
        </div>
      </header>

      <main className="w-full max-w-4xl px-6 py-4 flex-1">
        <div className="relative mb-6">
          <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-outline text-2xl pointer-events-none">
            search
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="הקלד מילה באנגלית או בעברית..."
            className="w-full pr-14 pl-12 py-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 focus:border-primary focus:ring-2 focus:ring-primary/15 focus:outline-none text-base transition-colors placeholder:text-on-surface-variant/50"
            dir="auto"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container-highest transition-colors"
              aria-label="נקה חיפוש"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          )}
        </div>

        {!showResults && (
          <div className="text-center py-12 flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-primary-fixed flex items-center justify-center">
              <span
                className="material-symbols-outlined text-primary text-4xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                manage_search
              </span>
            </div>
            <div>
              <p className="font-bold text-on-surface">חפש כל מילה במאגר</p>
              <p className="text-sm text-on-surface-variant mt-1">
                אפשר להקליד את המילה באנגלית, בעברית, או חלק מהמילה
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
              <span className="text-xs text-on-surface-variant">נסה:</span>
              {SUGGESTED_QUERIES.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setQuery(s);
                    inputRef.current?.focus();
                  }}
                  className="text-xs font-bold bg-surface-container-highest text-on-surface-variant hover:bg-primary-fixed hover:text-primary transition-colors px-3 py-1.5 rounded-full"
                  dir="auto"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {showResults && categoryResults.length > 0 && (
          <div className="mb-5">
            <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-2.5">
              קטגוריות תואמות
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {categoryResults.map((cat) => {
                const pct = cat.count > 0 ? Math.round((cat.known / cat.count) * 100) : 0;
                return (
                  <button
                    key={cat.key}
                    onClick={() =>
                      router.push(`/practice/vocab?cat=${encodeURIComponent(cat.key)}`)
                    }
                    className="flex items-center gap-3 p-3.5 rounded-2xl border border-primary/20 bg-primary-fixed/40 hover:border-primary hover:shadow-md transition-all text-right active:scale-[0.98] group cursor-pointer"
                  >
                    <span className="text-2xl shrink-0" aria-hidden="true">
                      {cat.emoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-on-surface truncate" dir="ltr">
                        {cat.key}
                      </p>
                      <p className="text-xs text-on-surface-variant truncate">
                        {cat.hebrew} · {cat.count} מילים
                        {cat.known > 0 && (
                          <span className="text-green-600 font-bold"> · {pct}% ידועות</span>
                        )}
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-primary group-hover:-translate-x-0.5 transition-transform shrink-0">
                      arrow_back
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {showResults && results.length > 0 && (
          <div className="mb-3 text-sm text-on-surface-variant">
            <span>
              <strong className="text-on-surface">{results.length}</strong> מילים עבור &ldquo;
              <span className="font-bold text-on-surface" dir="auto">
                {trimmed}
              </span>
              &rdquo;
            </span>
          </div>
        )}

        {noMatches && (
          <div className="text-center py-12 flex flex-col items-center gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined text-5xl opacity-30">search_off</span>
            <p className="font-bold text-on-surface">
              לא נמצאה התאמה ל-
              <span dir="auto">&ldquo;{trimmed}&rdquo;</span>
            </p>
            <p className="text-sm">בדוק את האיות או נסה לחפש בשפה השנייה</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2.5">
          {results.map((item) => {
            const status = getStatus(item.id);
            const expanded = expandedId === item.id;
            const emoji = CATEGORY_EMOJI[item.category] || "📚";
            const catHebrew = CATEGORY_HEBREW[item.category] || item.category;
            const example =
              item.exampleSentence || `This is an example of "${item.word}" in context.`;

            const statusBadge =
              status === "known" ? (
                <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                  <span
                    className="material-symbols-outlined text-sm"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  יודע
                </span>
              ) : status === "needs_practice" ? (
                <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                  <span
                    className="material-symbols-outlined text-sm"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    replay
                  </span>
                  לתרגול
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-surface-container-highest text-on-surface-variant px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                  חדש
                </span>
              );

            return (
              <div
                key={item.id}
                className={`rounded-2xl border transition-all bg-surface-container-lowest ${
                  expanded
                    ? "border-primary/40 shadow-md"
                    : "border-outline-variant/15 hover:border-primary/30 hover:shadow-sm"
                }`}
              >
                <button
                  onClick={() => setExpandedId(expanded ? null : item.id)}
                  className="w-full flex items-center gap-3 p-4 text-right cursor-pointer"
                >
                  <span className="text-2xl shrink-0" aria-hidden="true">
                    {emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-lg font-bold font-body text-on-surface" dir="ltr">
                        {item.word}
                      </span>
                      <span className="text-on-surface-variant">·</span>
                      <span className="text-base text-on-surface font-medium">
                        {item.correctAnswer}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-0.5 truncate">{catHebrew}</p>
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`שמע הגייה של ${item.word}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      speakWord(item.word);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        speakWord(item.word);
                      }
                    }}
                    className="w-9 h-9 rounded-full bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-all hover:scale-110 active:scale-95 shrink-0 cursor-pointer"
                  >
                    <span
                      className="material-symbols-outlined text-xl"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      volume_up
                    </span>
                  </span>
                  {statusBadge}
                  <span
                    className={`material-symbols-outlined text-outline text-xl transition-transform ${
                      expanded ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  >
                    expand_more
                  </span>
                </button>

                {expanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-outline-variant/10">
                    <div className="bg-surface-container-low rounded-xl px-4 py-3 mt-3">
                      <p
                        className="text-sm leading-relaxed text-on-surface-variant italic"
                        dir="ltr"
                      >
                        &ldquo;{example}&rdquo;
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-4">
                      <button
                        onClick={() => markKnown(item.id)}
                        disabled={status === "known"}
                        className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-bold transition-all active:scale-95 ${
                          status === "known"
                            ? "bg-green-100 text-green-700 cursor-default"
                            : "bg-green-500 text-white hover:bg-green-600 shadow-sm"
                        }`}
                      >
                        <span
                          className="material-symbols-outlined text-base"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          check_circle
                        </span>
                        {status === "known" ? "כבר מסומן כיודע" : "סמן כיודע"}
                      </button>
                      <button
                        onClick={() => markNeedsPractice(item.id)}
                        disabled={status === "needs_practice"}
                        className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-bold transition-all active:scale-95 ${
                          status === "needs_practice"
                            ? "bg-red-100 text-red-700 cursor-default"
                            : "bg-red-500 text-white hover:bg-red-600 shadow-sm"
                        }`}
                      >
                        <span
                          className="material-symbols-outlined text-base"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          replay
                        </span>
                        {status === "needs_practice" ? "כבר ברשימת התרגול" : "סמן לתרגול"}
                      </button>
                      <button
                        onClick={() =>
                          router.push(
                            `/practice/vocab?cat=${encodeURIComponent(item.category)}`,
                          )
                        }
                        className="flex items-center gap-1 px-4 py-2.5 rounded-full text-sm font-bold text-primary hover:bg-primary-fixed transition-colors"
                      >
                        תרגל קטגוריה
                        <span className="material-symbols-outlined text-base">arrow_back</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!user && !loading && (
          <p className="text-center text-on-surface-variant text-sm mt-8">
            יש להתחבר כדי לחפש מילים
          </p>
        )}
      </main>
    </div>
  );
}
