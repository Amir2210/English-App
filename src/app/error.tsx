"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center text-center px-6 font-hebrew" dir="rtl">
      <div className="bg-surface-container-lowest max-w-md w-full p-12 rounded-3xl shadow-[0px_10px_40px_rgba(25,28,29,0.05)] border border-outline-variant/20">
        <div className="w-24 h-24 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            error
          </span>
        </div>
        <h2 className="text-xl font-bold text-on-surface mb-4">משהו השתבש</h2>
        <p className="text-on-surface-variant mb-8">
          אירעה שגיאה בלתי צפויה. אנא נסה שוב.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 bg-primary text-on-primary px-8 py-4 rounded-full font-bold text-lg hover:bg-primary/90 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined">refresh</span>
          נסה שוב
        </button>
      </div>
    </div>
  );
}
