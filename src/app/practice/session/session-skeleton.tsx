import React from "react";

const SKEL_BAR = "bg-surface-container-highest animate-pulse";

export default function SessionSkeleton() {
  return (
    <div
      className="bg-surface text-on-surface min-h-screen flex flex-col items-center font-hebrew text-right antialiased"
      dir="rtl"
      aria-busy="true"
      aria-label="טוען שאלות"
    >
      {/* Header with progress */}
      <header className="w-full max-w-3xl px-6 py-8 flex items-center gap-6">
        <div className={`w-9 h-9 rounded ${SKEL_BAR}`} />
        <div className={`flex-1 h-3 rounded-full ${SKEL_BAR}`} />
        <div className={`h-5 w-12 rounded-md ${SKEL_BAR}`} />
      </header>

      <main className="w-full max-w-3xl px-6 flex-1 flex flex-col">
        <div className="mt-8 mb-12 space-y-6">
          {/* Tag chips */}
          <div className="flex items-center gap-2">
            <div className={`h-7 w-24 rounded-md ${SKEL_BAR}`} />
            <div className={`h-7 w-16 rounded-md ${SKEL_BAR}`} />
          </div>

          {/* Prompt */}
          <div className="space-y-3" dir="ltr">
            <div className={`h-9 w-full rounded-md ${SKEL_BAR}`} />
            <div className={`h-9 w-5/6 rounded-md ${SKEL_BAR}`} />
            <div className={`h-9 w-2/3 rounded-md ${SKEL_BAR}`} />
          </div>

          <div className={`h-5 w-48 rounded-md ${SKEL_BAR}`} />
        </div>

        {/* Options */}
        <div className="flex flex-col gap-4 pb-48">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="w-full p-5 md:p-6 rounded-3xl bg-surface-container-lowest border-2 border-transparent flex flex-row-reverse items-center justify-between"
            >
              <div className={`h-6 w-3/5 rounded-md ${SKEL_BAR}`} />
              <div className={`w-8 h-8 rounded-full ${SKEL_BAR}`} />
            </div>
          ))}
        </div>
      </main>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 w-full p-6 md:p-8 flex justify-center min-h-[120px] bg-white/80 backdrop-blur-xl border-t border-outline-variant/20">
        <div className="w-full max-w-3xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex-1" />
          <div className={`h-14 w-full md:w-48 rounded-full ${SKEL_BAR}`} />
        </div>
      </div>
    </div>
  );
}
