import React from "react";

const SKEL_BAR = "bg-surface-container-highest animate-pulse";

export default function PracticePickerSkeleton() {
  return (
    <div
      className="bg-surface text-on-surface min-h-screen flex flex-col items-center font-hebrew antialiased"
      dir="rtl"
      aria-busy="true"
      aria-label="טוען את מסך התרגול"
    >
      {/* Header */}
      <header className="w-full max-w-4xl px-6 pt-8 pb-4 flex items-center gap-4">
        <div className={`w-9 h-9 rounded ${SKEL_BAR}`} />
        <div className="space-y-2">
          <div className={`h-7 w-44 rounded-md ${SKEL_BAR}`} />
          <div className={`h-4 w-64 rounded-md ${SKEL_BAR}`} />
        </div>
      </header>

      <main className="w-full max-w-4xl px-6 py-6 flex-1">
        {/* Vocab card */}
        <div className="w-full mb-8 p-7 rounded-2xl border-2 border-outline-variant/20 bg-surface-container-lowest">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className={`w-14 h-14 rounded-xl ${SKEL_BAR}`} />
              <div className="space-y-2">
                <div className={`h-6 w-48 rounded-md ${SKEL_BAR}`} />
                <div className={`h-4 w-72 rounded-md ${SKEL_BAR}`} />
              </div>
            </div>
            <div className={`w-8 h-8 rounded ${SKEL_BAR}`} />
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1 h-px bg-outline-variant/30" />
          <div className={`h-4 w-56 rounded-md ${SKEL_BAR}`} />
          <div className="flex-1 h-px bg-outline-variant/30" />
        </div>

        {/* Level cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="text-right p-6 rounded-2xl border-2 border-outline-variant/15 bg-surface-container-lowest space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className={`w-12 h-12 rounded-xl ${SKEL_BAR}`} />
                <div className={`h-5 w-16 rounded-full ${SKEL_BAR}`} />
              </div>
              <div className={`h-3 w-16 rounded-md ${SKEL_BAR}`} />
              <div className={`h-6 w-32 rounded-md ${SKEL_BAR}`} />
              <div className="space-y-1.5">
                <div className={`h-3 w-full rounded-md ${SKEL_BAR}`} />
                <div className={`h-3 w-3/4 rounded-md ${SKEL_BAR}`} />
              </div>
              <div className="flex gap-1.5 pt-2">
                {Array.from({ length: 5 }).map((__, j) => (
                  <div key={j} className={`w-2.5 h-2.5 rounded-full ${SKEL_BAR}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Bottom action bar */}
      <div className="sticky bottom-0 w-full bg-white/80 backdrop-blur-xl border-t border-outline-variant/20 p-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="space-y-1.5">
            <div className={`h-3 w-24 rounded-md ${SKEL_BAR}`} />
            <div className={`h-5 w-40 rounded-md ${SKEL_BAR}`} />
          </div>
          <div className={`h-14 w-44 rounded-full ${SKEL_BAR}`} />
        </div>
      </div>
    </div>
  );
}
