import React from "react";

const SKEL_BAR = "bg-surface-container-highest animate-pulse";

export default function DashboardSkeleton() {
  return (
    <div
      className="bg-surface text-on-surface antialiased overflow-x-hidden min-h-screen flex text-right font-hebrew"
      dir="rtl"
      aria-busy="true"
      aria-label="טוען את לוח הבקרה"
    >
      {/* Mobile top bar */}
      <header className="fixed top-0 right-0 left-0 h-14 bg-surface-container-low/95 backdrop-blur-md border-b border-outline-variant/20 flex items-center justify-between px-4 z-30 lg:hidden">
        <div className={`w-8 h-8 rounded-xl ${SKEL_BAR}`} />
        <div className={`h-5 w-20 rounded-md ${SKEL_BAR}`} />
        <div className={`w-8 h-8 rounded-full ${SKEL_BAR}`} />
      </header>

      {/* Sidebar (lg only) */}
      <aside className="hidden lg:flex h-screen w-64 fixed right-0 top-0 bg-surface-container-low flex-col py-6 pr-4 text-right z-50">
        <div className="mb-8 pr-4 space-y-3">
          <div className={`h-6 w-24 rounded-md ${SKEL_BAR}`} />
          <div className={`h-1.5 rounded-full ${SKEL_BAR}`} />
        </div>
        <nav className="flex flex-col gap-2 w-full">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3 px-4">
              <div className={`w-6 h-6 rounded ${SKEL_BAR}`} />
              <div className={`h-4 w-24 rounded-md ${SKEL_BAR}`} />
            </div>
          ))}
        </nav>
        <div className="mt-auto pr-4 pt-4 border-t border-outline-variant/20 mr-4 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${SKEL_BAR}`} />
          <div className="flex-1 space-y-1.5">
            <div className={`h-4 w-20 rounded-md ${SKEL_BAR}`} />
            <div className={`h-3 w-16 rounded-md ${SKEL_BAR}`} />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen lg:mr-64 pt-14 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6 lg:space-y-8">
          {/* Hero */}
          <section className="rounded-2xl sm:rounded-3xl p-5 sm:p-8 bg-surface-container-low">
            <div className="flex items-center justify-between gap-4 sm:gap-8">
              <div className="space-y-3 flex-1">
                <div className={`h-6 sm:h-9 w-56 rounded-md ${SKEL_BAR}`} />
                <div className={`h-4 w-full max-w-md rounded-md ${SKEL_BAR}`} />
                <div className={`h-4 w-3/4 max-w-sm rounded-md ${SKEL_BAR}`} />
              </div>
              <div className={`hidden md:block w-[140px] h-[140px] rounded-full ${SKEL_BAR} shrink-0`} />
            </div>
          </section>

          {/* Smart practice card */}
          <section className="rounded-2xl sm:rounded-3xl p-5 sm:p-7 bg-surface-container-low">
            <div className="flex items-center gap-5">
              <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl ${SKEL_BAR} shrink-0`} />
              <div className="flex-1 space-y-2">
                <div className={`h-3 w-32 rounded-md ${SKEL_BAR}`} />
                <div className={`h-6 w-56 rounded-md ${SKEL_BAR}`} />
                <div className={`h-4 w-40 rounded-md ${SKEL_BAR}`} />
              </div>
            </div>
          </section>

          {/* Stats grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className={`w-10 h-10 rounded-xl ${SKEL_BAR}`} />
                  <div className={`h-5 w-12 rounded-full ${SKEL_BAR}`} />
                </div>
                <div className={`h-8 w-16 rounded-md ${SKEL_BAR}`} />
                <div className={`h-3 w-24 rounded-md ${SKEL_BAR}`} />
              </div>
            ))}
          </div>

          {/* Overall progress card */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className={`h-5 w-36 rounded-md ${SKEL_BAR}`} />
              <div className={`h-4 w-28 rounded-md ${SKEL_BAR}`} />
            </div>
            <div className={`h-4 rounded-full ${SKEL_BAR}`} />
            <div className="flex gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={`h-4 w-20 rounded-md ${SKEL_BAR}`} />
              ))}
            </div>
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <div className={`h-6 w-48 rounded-md ${SKEL_BAR}`} />
                <div className={`h-4 w-24 rounded-md ${SKEL_BAR}`} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/10 space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded ${SKEL_BAR}`} />
                      <div className="flex-1 space-y-1.5">
                        <div className={`h-4 w-32 rounded-md ${SKEL_BAR}`} />
                        <div className={`h-3 w-20 rounded-md ${SKEL_BAR}`} />
                      </div>
                      <div className={`h-5 w-10 rounded-full ${SKEL_BAR}`} />
                    </div>
                    <div className={`h-2 rounded-full ${SKEL_BAR}`} />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className={`h-6 w-32 rounded-md ${SKEL_BAR}`} />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/10"
                  >
                    <div className={`w-10 h-10 rounded-lg ${SKEL_BAR}`} />
                    <div className="flex-1 space-y-1.5">
                      <div className={`h-4 w-32 rounded-md ${SKEL_BAR}`} />
                      <div className={`h-3 w-20 rounded-md ${SKEL_BAR}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
