"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { getRecommendedAmiramLevel } from "@/lib/vocab-utils";
import { useUserProfile } from "@/lib/useUserProfile";

interface LevelInfo {
  level: number | "mix";
  label: string;
  labelHe: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  count: number;
}

const LEVEL_CONFIG: Omit<LevelInfo, "count">[] = [
  {
    level: 1,
    label: "Level 1",
    labelHe: "מתחילים",
    description: "אוצר מילים בסיסי ומשפטים פשוטים. מתאים לתחילת הדרך.",
    icon: "eco",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200 hover:border-emerald-400",
  },
  {
    level: 2,
    label: "Level 2",
    labelHe: "קל",
    description: "מילים נפוצות בהקשרים יומיומיים. מצריך ידע בסיסי באנגלית.",
    icon: "spa",
    color: "text-teal-600",
    bgColor: "bg-teal-50",
    borderColor: "border-teal-200 hover:border-teal-400",
  },
  {
    level: 3,
    label: "Level 3",
    labelHe: "בינוני",
    description: "אוצר מילים אקדמי, ביטויים ומבנים דקדוקיים מורכבים יותר.",
    icon: "local_fire_department",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200 hover:border-amber-400",
  },
  {
    level: 4,
    label: "Level 4",
    labelHe: "קשה",
    description: "מילים מתוחכמות, ניסוחים מורכבים ומלכודות לשוניות קלאסיות.",
    icon: "bolt",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200 hover:border-orange-400",
  },
  {
    level: 5,
    label: "Level 5",
    labelHe: "מומחים",
    description: "רמה גבוהה מאוד. מילים נדירות, תנאי מדומה ומשפטים מסובכים.",
    icon: "diamond",
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200 hover:border-red-400",
  },
  {
    level: "mix",
    label: "Mix",
    labelHe: "מיקס — כל הרמות",
    description: "שאלות אקראיות מכל הרמות. סימולציה אמיתית של מבחן אמיר\"ם.",
    icon: "shuffle",
    color: "text-primary",
    bgColor: "bg-primary-fixed",
    borderColor: "border-primary/20 hover:border-primary",
  },
];

export default function PracticeLevelPickerPage() {
  const router = useRouter();
  const profile = useUserProfile();
  const recommendedLevels = getRecommendedAmiramLevel(profile.level);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [vocabCount, setVocabCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState<number | "mix" | null>(null);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [questionsSnap, vocabSnap] = await Promise.all([
          getDocs(collection(db, "questions")),
          getDocs(collection(db, "vocabulary")),
        ]);

        const levelCounts: Record<string, number> = { mix: 0 };
        questionsSnap.forEach((doc) => {
          const data = doc.data();
          const lvl = data.difficultyLevel;
          levelCounts[lvl] = (levelCounts[lvl] || 0) + 1;
          levelCounts["mix"]++;
        });
        setCounts(levelCounts);
        setVocabCount(vocabSnap.size);
      } catch (err) {
        console.error("Error fetching counts:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCounts();
  }, []);

  const handleStart = () => {
    if (selectedLevel === null) return;
    router.push(`/practice/session?level=${selectedLevel}`);
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col items-center font-hebrew antialiased" dir="rtl">

      {/* Header */}
      <header className="w-full max-w-4xl px-6 pt-8 pb-4 flex items-center gap-4">
        <button
          onClick={() => router.push("/dashboard")}
          className="material-symbols-outlined text-outline hover:text-on-surface-variant transition-colors p-2 -mr-2 cursor-pointer"
        >
          arrow_forward
        </button>
        <div>
          <h1 className="text-2xl font-bold font-headline text-on-surface">בחר סוג תרגול</h1>
          <p className="text-on-surface-variant text-sm mt-1">שאלות בסגנון אמיר"ם או תרגול אוצר מילים</p>
        </div>
      </header>

      <main className="w-full max-w-4xl px-6 py-6 flex-1">

        {/* Vocabulary Card — Big & Prominent */}
        <button
          onClick={() => router.push("/practice/vocab")}
          className="w-full mb-8 p-7 rounded-2xl border-2 border-violet-200 hover:border-violet-400 bg-violet-50 text-right transition-all hover:shadow-lg active:scale-[0.98] group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>translate</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-on-surface">תרגול אוצר מילים</h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  מילה באנגלית → בחר את התרגום הנכון בעברית
                  <span className="mr-2 text-violet-600 font-bold">({loading ? "..." : vocabCount} מילים)</span>
                </p>
              </div>
            </div>
            <span className="material-symbols-outlined text-violet-400 group-hover:text-violet-600 transition-colors text-3xl">arrow_back</span>
          </div>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1 h-px bg-outline-variant/30"></div>
          <span className="text-sm font-bold text-on-surface-variant bg-surface px-3">שאלות אמיר"ם — בחר רמה</span>
          <div className="flex-1 h-px bg-outline-variant/30"></div>
        </div>

        {/* Level Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {LEVEL_CONFIG.map((cfg) => {
            const count = counts[String(cfg.level)] || 0;
            const isSelected = selectedLevel === cfg.level;
            const isEmpty = !loading && count === 0;

            return (
              <button
                key={String(cfg.level)}
                onClick={() => !isEmpty && setSelectedLevel(cfg.level)}
                disabled={isEmpty}
                className={`
                  group relative text-right p-6 rounded-2xl border-2 transition-all duration-300
                  ${isSelected
                    ? `${cfg.bgColor} ${cfg.borderColor.split(" ")[0].replace("border-", "border-").replace("/20", "")} shadow-lg scale-[1.02] ring-2 ring-offset-2 ${cfg.borderColor.split(" ")[0].replace("border", "ring")}`
                    : `bg-surface-container-lowest ${cfg.borderColor} shadow-sm hover:shadow-md`
                  }
                  ${isEmpty ? "opacity-40 cursor-not-allowed" : "cursor-pointer active:scale-[0.98]"}
                `}
              >
                {typeof cfg.level === "number" && recommendedLevels.includes(cfg.level) && (
                  <div className="absolute top-0 left-0 bg-primary text-white text-[9px] font-bold px-2 py-0.5 rounded-br-lg rounded-tl-lg z-10">
                    מומלץ לרמה שלך
                  </div>
                )}
                {/* Top Row: Icon + Badge */}
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl ${cfg.bgColor} ${cfg.color} flex items-center justify-center transition-transform group-hover:scale-110`}>
                    <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {cfg.icon}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSelected && (
                      <span className="material-symbols-outlined text-xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                        check_circle
                      </span>
                    )}
                    <span className={`text-xs font-bold font-body px-2.5 py-1 rounded-full ${cfg.bgColor} ${cfg.color}`}>
                      {loading ? "..." : `${count} שאלות`}
                    </span>
                  </div>
                </div>

                {/* Level Label */}
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold font-body uppercase tracking-wider ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>

                {/* Hebrew Title */}
                <h3 className="text-xl font-bold text-on-surface mb-2">{cfg.labelHe}</h3>

                {/* Description */}
                <p className="text-sm text-on-surface-variant leading-relaxed">{cfg.description}</p>

                {/* Difficulty Dots */}
                {typeof cfg.level === "number" && (
                  <div className="flex gap-1.5 mt-4">
                    {[1, 2, 3, 4, 5].map((dot) => (
                      <div
                        key={dot}
                        className={`w-2.5 h-2.5 rounded-full transition-colors ${
                          dot <= (cfg.level as number) ? `${cfg.color.replace("text-", "bg-")}` : "bg-surface-container-highest"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </main>

      {/* Bottom Action Bar */}
      <div className="sticky bottom-0 w-full bg-white/80 backdrop-blur-xl border-t border-outline-variant/20 p-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="text-right">
            {selectedLevel !== null ? (
              <>
                <p className="text-sm text-on-surface-variant">רמה נבחרה:</p>
                <p className="text-lg font-bold text-on-surface">
                  {LEVEL_CONFIG.find(c => c.level === selectedLevel)?.labelHe}
                  <span className="text-on-surface-variant font-normal text-sm mr-2">
                    ({counts[String(selectedLevel)] || 0} שאלות)
                  </span>
                </p>
              </>
            ) : (
              <p className="text-on-surface-variant">בחר רמה כדי להתחיל</p>
            )}
          </div>
          <button
            onClick={handleStart}
            disabled={selectedLevel === null}
            className={`py-4 px-10 rounded-full font-bold text-lg transition-all ${
              selectedLevel !== null
                ? "bg-primary text-white hover:bg-[#004a9e] active:scale-95 shadow-lg shadow-primary/20"
                : "bg-surface-variant text-on-surface-variant/50 cursor-not-allowed"
            }`}
          >
            <span className="flex items-center gap-2">
              התחל תרגול
              <span className="material-symbols-outlined">arrow_back</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
