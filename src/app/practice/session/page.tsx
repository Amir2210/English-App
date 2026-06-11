"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import SessionSkeleton from "./session-skeleton";

interface Option {
  id: string;
  text: string;
}

interface Question {
  id: string;
  type: string;
  difficultyLevel: number;
  tags: string[];
  prompt: string;
  options: Option[];
  correctOptionId: string;
  explanation_he: string;
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function PracticeSession() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const levelParam = searchParams.get("level");

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "correct" | "incorrect" | "completed">("idle");
  const [score, setScore] = useState(0);

  const levelLabel = levelParam === "mix" ? "מיקס" : `רמה ${levelParam}`;

  useEffect(() => {
    if (!levelParam) {
      router.push("/practice");
      return;
    }

    const fetchQuestions = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "questions"));
        let fetched: Question[] = [];

        querySnapshot.forEach((docSnap) => {
          fetched.push({ id: docSnap.id, ...docSnap.data() } as Question);
        });

        if (levelParam !== "mix") {
          const numLevel = parseInt(levelParam, 10);
          fetched = fetched.filter((q) => q.difficultyLevel === numLevel);
        }

        setQuestions(shuffleArray(fetched));
      } catch (error) {
        console.error("Error fetching questions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [levelParam, router]);

  if (loading) {
    return <SessionSkeleton />;
  }

  if (questions.length === 0) {
    return (
      <div className="flex bg-surface min-h-screen items-center justify-center font-hebrew text-on-surface flex-col gap-4" dir="rtl">
        <span className="material-symbols-outlined text-5xl text-outline">search_off</span>
        <p className="text-xl font-bold">לא נמצאו שאלות ברמה הזו.</p>
        <button
          onClick={() => router.push("/practice")}
          className="mt-4 bg-primary text-white px-8 py-3 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all"
        >
          חזור לבחירת רמה
        </button>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progressPercent = ((currentIndex + (status !== "idle" ? 1 : 0)) / questions.length) * 100;

  const handleOptionClick = (id: string) => {
    if (status === "correct" || status === "incorrect") return;
    setSelectedOptionId(id);
  };

  const handleCheck = () => {
    if (selectedOptionId === null) return;
    if (selectedOptionId === currentQuestion.correctOptionId) {
      setStatus("correct");
      setScore((prev) => prev + 1);
    } else {
      setStatus("incorrect");
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOptionId(null);
      setStatus("idle");
    } else {
      setStatus("completed");
    }
  };

  // Completed Screen
  if (status === "completed") {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="bg-surface text-on-surface min-h-screen flex flex-col items-center justify-center font-hebrew text-right" dir="rtl">
        <div className="bg-surface-container-lowest max-w-lg w-full p-12 rounded-3xl shadow-[0px_10px_40px_rgba(25,28,29,0.05)] flex flex-col items-center gap-6 animate-fade-in-up text-center border border-outline-variant/20">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 ${percentage >= 70 ? "bg-green-100 text-green-600" : percentage >= 40 ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600"}`}>
            <span className="material-symbols-outlined text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              {percentage >= 70 ? "emoji_events" : percentage >= 40 ? "sentiment_neutral" : "mood_bad"}
            </span>
          </div>
          <h2 className="text-3xl font-bold font-headline text-on-surface">
            {percentage >= 70 ? "כל הכבוד!" : percentage >= 40 ? "לא רע!" : "צריך עוד תרגול"}
          </h2>
          <p className="text-5xl font-black font-body text-primary">{percentage}%</p>
          <p className="text-on-surface-variant text-lg">
            ענית נכון על <strong>{score}</strong> מתוך <strong>{questions.length}</strong> שאלות ({levelLabel})
          </p>

          <div className="flex flex-col gap-3 w-full mt-4">
            <button
              onClick={() => {
                setCurrentIndex(0);
                setSelectedOptionId(null);
                setStatus("idle");
                setScore(0);
                setQuestions(shuffleArray(questions));
              }}
              className="bg-primary text-white w-full py-4 rounded-full font-bold text-lg hover:opacity-90 active:scale-95 transition-all"
            >
              נסה שוב
            </button>
            <button
              onClick={() => router.push("/practice")}
              className="bg-surface-container-highest text-on-surface w-full py-4 rounded-full font-bold text-lg hover:opacity-90 active:scale-95 transition-all"
            >
              בחר רמה אחרת
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="text-on-surface-variant w-full py-3 rounded-full font-medium text-base hover:underline transition-all"
            >
              חזור ללוח הבקרה
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active Practice Screen
  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col items-center font-hebrew text-right antialiased" dir="rtl">

      {/* Top Header / Progress */}
      <header className="w-full max-w-3xl px-6 py-8 flex items-center gap-6">
        <button
          onClick={() => router.push("/practice")}
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

      {/* Main Question Area */}
      <main className="w-full max-w-3xl px-6 flex-1 flex flex-col">
        <div className="mt-8 mb-12">
          <div className="flex items-center gap-2 mb-6">
            <span className="inline-block text-sm font-bold text-primary bg-primary-fixed px-3 py-1 rounded-md uppercase tracking-wider font-body">
              {currentQuestion.type.replace(/_/g, " ")}
            </span>
            <span className="inline-block text-sm font-bold text-tertiary bg-tertiary-fixed px-3 py-1 rounded-md uppercase tracking-wider font-body">
              LVL {currentQuestion.difficultyLevel}
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-on-surface font-body leading-tight text-left" dir="ltr">
            {currentQuestion.prompt}
          </h1>
          <p className="text-on-surface-variant mt-6 text-lg">בחר את התשובה הנכונה ביותר:</p>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-4 pb-48">
          {currentQuestion.options.map((option) => {
            let optionStyles = "bg-surface-container-lowest border-2 border-transparent hover:bg-surface-container-high hover:border-outline-variant/30";
            let textStyles = "text-on-surface";

            if (status === "idle" && selectedOptionId === option.id) {
              optionStyles = "bg-primary-fixed border-2 border-primary shadow-[0px_4px_20px_rgba(0,91,191,0.1)]";
              textStyles = "text-primary font-bold";
            } else if (status === "correct" || status === "incorrect") {
              if (option.id === currentQuestion.correctOptionId) {
                optionStyles = "bg-green-50 border-2 border-green-500 shadow-sm";
                textStyles = "text-green-700 font-bold";
              } else if (status === "incorrect" && selectedOptionId === option.id) {
                optionStyles = "bg-red-50 border-2 border-red-500 shadow-sm opacity-80";
                textStyles = "text-red-700 font-bold";
              } else {
                optionStyles = "bg-surface-container-lowest border-2 border-transparent opacity-50";
              }
            }

            return (
              <button
                key={option.id}
                onClick={() => handleOptionClick(option.id)}
                className={`w-full p-5 md:p-6 rounded-3xl text-left flex flex-row-reverse items-center justify-between transition-all duration-300 active:scale-[0.98] ${optionStyles}`}
                disabled={status !== "idle"}
                dir="ltr"
              >
                <div className="flex items-center gap-4">
                  <span className={`text-lg md:text-xl font-medium font-body ${textStyles}`}>
                    {option.text}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  {status !== "idle" && option.id === currentQuestion.correctOptionId && (
                    <span className="material-symbols-outlined text-green-500" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  )}
                  {status === "incorrect" && selectedOptionId === option.id && (
                    <span className="material-symbols-outlined text-red-500" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
                  )}
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border font-body transition-colors uppercase ${
                    selectedOptionId === option.id && status === "idle" ? "border-primary text-primary" :
                    (status !== "idle" && option.id === currentQuestion.correctOptionId) ? "bg-green-100 text-green-700 border-green-500" :
                    (status === "incorrect" && selectedOptionId === option.id) ? "bg-red-100 text-red-700 border-red-500" :
                    "border-outline-variant text-outline"
                  }`}>
                    {option.id}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </main>

      {/* Dynamic Action Bar */}
      <div className={`fixed bottom-0 left-0 w-full p-6 md:p-8 flex justify-center transition-all min-h-[120px] ${
        status === "correct" ? "bg-green-100 border-t border-green-200" :
        status === "incorrect" ? "bg-red-100 border-t border-red-200" :
        "bg-white/80 backdrop-blur-xl border-t border-outline-variant/20"
      }`}>
        <div className="w-full max-w-3xl flex flex-col md:flex-row items-center justify-between gap-4">

          {/* Explanation */}
          <div className="flex-1 w-full text-right">
            {status === "correct" && (
              <div className="animate-fade-in-up">
                <div className="flex items-center gap-2 text-green-800 font-bold text-2xl font-hebrew">
                  <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span>מצוין!</span>
                </div>
                <p className="text-green-900 mt-2 text-sm leading-relaxed max-w-md">{currentQuestion.explanation_he}</p>
              </div>
            )}
            {status === "incorrect" && (
              <div className="animate-fade-in-up">
                <div className="flex items-center gap-2 text-red-800 font-bold text-2xl font-hebrew">
                  <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
                  <span>לא מדויק.</span>
                </div>
                <p className="text-red-900 mt-2 text-sm leading-relaxed max-w-md">{currentQuestion.explanation_he}</p>
              </div>
            )}
          </div>

          {/* Action Button */}
          {status === "idle" ? (
            <button
              onClick={handleCheck}
              disabled={selectedOptionId === null}
              className={`w-full md:w-auto py-4 px-12 rounded-full font-bold text-lg font-hebrew transition-all ${
                selectedOptionId !== null
                  ? "bg-primary text-white hover:bg-[#004a9e] active:scale-95 shadow-md shadow-primary/20"
                  : "bg-surface-variant text-on-surface-variant/50 cursor-not-allowed"
              }`}
            >
              בדוק תשובה
            </button>
          ) : (
            <button
              onClick={handleNext}
              className={`w-full md:w-auto py-4 px-12 rounded-full font-bold text-lg text-white font-hebrew transition-all active:scale-95 shadow-md ${
                status === "correct" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
              }`}
            >
              המשך
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PracticeSessionPage() {
  return (
    <Suspense fallback={<SessionSkeleton />}>
      <PracticeSession />
    </Suspense>
  );
}
