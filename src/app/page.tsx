"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth } from "../lib/firebase";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
} from "firebase/auth";

const CONTINENTS_IMG = `
  radial-gradient(ellipse 40px 55px at 45px 70px, #45a85e 0%, #45a85e 76%, transparent 82%),
  radial-gradient(ellipse 30px 40px at 55px 82px, #3fa758 0%, #3fa758 72%, transparent 78%),
  radial-gradient(ellipse 18px 22px at 35px 56px, #4dae65 0%, #4dae65 74%, transparent 80%),

  radial-gradient(ellipse 22px 42px at 95px 178px, #3fa758 0%, #3fa758 76%, transparent 82%),
  radial-gradient(ellipse 16px 24px at 100px 164px, #4dae65 0%, #4dae65 74%, transparent 80%),
  radial-gradient(ellipse 10px 16px at 88px 202px, #3a9e55 0%, #3a9e55 70%, transparent 78%),

  radial-gradient(ellipse 30px 18px at 170px 64px, #4aad62 0%, #4aad62 76%, transparent 82%),
  radial-gradient(ellipse 14px 20px at 158px 58px, #52b36a 0%, #52b36a 72%, transparent 78%),
  radial-gradient(ellipse 18px 12px at 182px 55px, #4fb068 0%, #4fb068 72%, transparent 78%),

  radial-gradient(ellipse 36px 52px at 178px 135px, #3a9e55 0%, #3a9e55 78%, transparent 83%),
  radial-gradient(ellipse 30px 28px at 172px 110px, #45a85e 0%, #45a85e 76%, transparent 82%),
  radial-gradient(ellipse 16px 16px at 190px 162px, #4dae65 0%, #4dae65 72%, transparent 78%),

  radial-gradient(ellipse 55px 40px at 260px 72px, #3fa758 0%, #3fa758 76%, transparent 82%),
  radial-gradient(ellipse 24px 30px at 278px 58px, #47a960 0%, #47a960 74%, transparent 80%),
  radial-gradient(ellipse 16px 26px at 284px 95px, #3a9e55 0%, #3a9e55 72%, transparent 78%),
  radial-gradient(ellipse 18px 14px at 252px 52px, #4fb068 0%, #4fb068 70%, transparent 78%),

  radial-gradient(ellipse 26px 20px at 310px 172px, #4dae65 0%, #4dae65 76%, transparent 82%),
  radial-gradient(ellipse 14px 12px at 318px 182px, #52b36a 0%, #52b36a 72%, transparent 78%),

  radial-gradient(ellipse 16px 12px at 82px 38px, #c8e6d4 0%, #c8e6d4 72%, transparent 80%),
  radial-gradient(ellipse 100px 8px at 180px 272px, #dff0e8 0%, #dff0e8 68%, transparent 78%)
`;

function InteractiveGlobe() {
  const offsetRef = useRef(0);
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);
  const rafRef = useRef<number>(0);
  const [scrollX, setScrollX] = useState(0);

  const tick = useCallback(() => {
    if (!draggingRef.current) {
      offsetRef.current -= 0.15;
    }
    setScrollX(offsetRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    draggingRef.current = true;
    lastXRef.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastXRef.current;
    offsetRef.current += dx * 0.5;
    lastXRef.current = e.clientX;
  }, []);

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  const TILE_W = 360;
  const STRIP_W = TILE_W * 3;
  const wrapX = ((scrollX % TILE_W) + TILE_W) % TILE_W;

  return (
    <div
      className="relative w-72 h-72 rounded-full select-none cursor-grab active:cursor-grabbing"
      style={{ animation: "globePulse 4s ease-in-out infinite" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Ocean base */}
      <div className="absolute inset-0 rounded-full bg-linear-to-br from-blue-400 via-primary to-indigo-600 overflow-hidden">
        {/* Scrolling continent strip — tiled, wrapping seamlessly */}
        <div
          className="absolute top-0 h-full pointer-events-none"
          style={{
            width: STRIP_W,
            left: -(TILE_W),
            transform: `translateX(${-wrapX}px)`,
            backgroundImage: CONTINENTS_IMG,
            backgroundSize: `${TILE_W}px 288px`,
            backgroundRepeat: "repeat-x",
          }}
        />
        {/* Fixed 3D lighting — sells the sphere illusion */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: `
              radial-gradient(circle at 38% 35%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.08) 30%, transparent 55%),
              radial-gradient(circle at 68% 72%, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.08) 35%, transparent 60%)
            `,
          }}
        />
        {/* Edge darkening for sphere curvature */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ boxShadow: "inset 0 0 50px 15px rgba(0,20,60,0.18)" }}
        />
      </div>
      {/* Atmosphere glow rings */}
      <div className="absolute -inset-3 rounded-full border border-primary/10 pointer-events-none" />
      <div className="absolute -inset-6 rounded-full border border-primary/5 pointer-events-none" />
    </div>
  );
}

function useCountUp(target: number, duration = 1800) {
  const [value, setValue] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true); },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started || target === 0) return;
    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, target, duration]);

  return { value, ref };
}

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) router.replace("/dashboard");
    });
    return () => unsub();
  }, [router]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch {
      setError("שגיאה בהתחברות. אנא בדוק את הפרטים שלך ונסה שוב.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      router.push("/dashboard");
    } catch {
      setError("שגיאה בהתחברות עם Google.");
    } finally {
      setLoading(false);
    }
  };

  const scrollToLogin = () => {
    document.getElementById("login-section")?.scrollIntoView({ behavior: "smooth" });
  };

  const stats = {
    words: useCountUp(500),
    categories: useCountUp(20),
    games: useCountUp(4),
  };

  return (
    <div className="bg-surface text-on-surface font-hebrew overflow-x-hidden">

      {/* ─── Navbar ─── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/15">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-4 sm:px-8">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Atlas" width={96} height={96} className="w-9 h-9" priority />
            <span className="text-xl font-bold font-headline text-on-surface hidden sm:inline">Atlas</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-on-surface-variant">
            <a href="#features" className="hover:text-primary transition-colors">מה אנחנו מציעים</a>
            <a href="#roadmap" className="hover:text-primary transition-colors">מסלול הלמידה</a>
            <a href="#how-it-works" className="hover:text-primary transition-colors">איך זה עובד</a>
            <a href="#stats" className="hover:text-primary transition-colors">בנתונים</a>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={scrollToLogin} className="hidden sm:block text-sm font-bold text-primary hover:text-primary-container transition-colors">
              כניסה
            </button>
            <Link href="/register" className="bg-primary text-on-primary px-5 py-2 rounded-xl text-sm font-bold hover:scale-[1.03] active:scale-[0.97] transition-transform shadow-lg shadow-primary/15">
              הרשמה חינם
            </Link>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-1.5 rounded-lg hover:bg-surface-container-highest transition-colors">
              <span className="material-symbols-outlined">{mobileMenuOpen ? "close" : "menu"}</span>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-surface border-t border-outline-variant/15 px-6 py-4 space-y-3">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-on-surface-variant hover:text-primary">מה אנחנו מציעים</a>
            <a href="#roadmap" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-on-surface-variant hover:text-primary">מסלול הלמידה</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-on-surface-variant hover:text-primary">איך זה עובד</a>
            <a href="#stats" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-on-surface-variant hover:text-primary">בנתונים</a>
            <button onClick={() => { scrollToLogin(); setMobileMenuOpen(false); }} className="block text-sm font-bold text-primary">כניסה</button>
          </div>
        )}
      </nav>

      {/* ─── Hero Section ─── */}
      <section className="relative min-h-[92vh] flex items-center pt-16 overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-linear-to-bl from-primary-fixed via-[#f0e6ff] to-[#ffe0f0] opacity-60" />
          <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-primary/8 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-violet-300/15 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />
          {/* Decorative grid dots */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: "radial-gradient(circle, var(--color-primary) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }} />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-8 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

            {/* Text content */}
            <div className="space-y-6 sm:space-y-8 text-center lg:text-right">
              <div className="inline-flex items-center gap-2 bg-primary-fixed/50 text-primary px-4 py-1.5 rounded-full text-sm font-bold border border-primary/10">
                <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                הדרך החכמה ללמוד אנגלית
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black font-headline leading-tight text-on-surface">
                שליטה באנגלית{" "}
                <span className="relative inline-block">
                  <span className="relative z-10 text-primary">מתחילה כאן</span>
                  <span className="absolute bottom-1 right-0 left-0 h-3 sm:h-4 bg-primary/10 rounded-full z-0" />
                </span>
              </h1>

              <p className="text-base sm:text-lg text-on-surface-variant max-w-lg mx-auto lg:mx-0 leading-relaxed">
                מערכת למידה אינטראקטיבית עם כרטיסיות, משחקי התאמה, תרגול אוצר מילים ושאלות ברמת אמיר&quot;ם — הכל במקום אחד, בחינם.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 justify-center lg:justify-start">
                <Link
                  href="/register"
                  className="w-full sm:w-auto bg-primary text-on-primary px-8 py-4 rounded-2xl text-base font-bold shadow-xl shadow-primary/20 hover:scale-[1.03] active:scale-[0.97] transition-all flex items-center justify-center gap-2"
                >
                  התחל ללמוד — בחינם
                  <span className="material-symbols-outlined">arrow_back</span>
                </Link>
                <button
                  onClick={scrollToLogin}
                  className="w-full sm:w-auto bg-surface-container-lowest text-on-surface px-8 py-4 rounded-2xl text-base font-bold border border-outline-variant/30 hover:border-primary/40 hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  יש לי חשבון
                  <span className="material-symbols-outlined text-primary">login</span>
                </button>
              </div>

              {/* Social proof */}
              <div className="flex items-center gap-4 justify-center lg:justify-start pt-2">
                <div className="flex -space-x-2 space-x-reverse">
                  {["bg-blue-400", "bg-emerald-400", "bg-amber-400", "bg-rose-400"].map((c, i) => (
                    <div key={i} className={`w-8 h-8 rounded-full ${c} border-2 border-surface flex items-center justify-center text-white text-xs font-bold`}>
                      {["A", "M", "S", "D"][i]}
                    </div>
                  ))}
                </div>
                <div className="text-sm text-on-surface-variant">
                  <span className="font-bold text-on-surface">100+</span> תלמידים כבר לומדים איתנו
                </div>
              </div>
            </div>

            {/* Hero visual — spinning globe with floating cards */}
            <div className="hidden lg:flex items-center justify-center relative" style={{ width: 520, height: 520 }}>

              {/* Globe */}
              <InteractiveGlobe />

              {/* ─ Floating card 1 — top right ─ */}
              <div
                className="absolute group"
                style={{ top: -18, right: -10, animation: "floatCard1 5s ease-in-out infinite" }}
              >
                {/* Connector line */}
                <svg className="absolute bottom-0 left-8 w-16 h-20 pointer-events-none" style={{ transform: "translate(-50%, 100%)" }}>
                  <line x1="32" y1="0" x2="8" y2="72" stroke="var(--color-primary)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.3" />
                  <circle cx="8" cy="72" r="3" fill="var(--color-primary)" opacity="0.4" />
                </svg>
                <div className="bg-surface-container-lowest/95 backdrop-blur-xl rounded-2xl p-5 shadow-xl border border-outline-variant/15 hover:border-primary/30 hover:shadow-2xl hover:scale-105 transition-all duration-300 w-56">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl">🃏</div>
                    <span className="text-base font-bold text-on-surface font-headline">כרטיסיות</span>
                  </div>
                  <p className="text-sm text-on-surface-variant leading-snug">הפוך, גלה תרגום, עקוב אחרי ההתקדמות</p>
                </div>
              </div>

              {/* ─ Floating card 2 — left ─ */}
              <div
                className="absolute group"
                style={{ top: "50%", left: -80, marginTop: -35, animation: "floatCard2 6s ease-in-out infinite 0.5s" }}
              >
                <svg className="absolute top-3 right-0 w-20 h-12 pointer-events-none" style={{ transform: "translate(100%, 0)" }}>
                  <line x1="0" y1="16" x2="72" y2="24" stroke="var(--color-primary)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.3" />
                  <circle cx="72" cy="24" r="3" fill="var(--color-primary)" opacity="0.4" />
                </svg>
                <div className="bg-surface-container-lowest/95 backdrop-blur-xl rounded-2xl p-5 shadow-xl border border-outline-variant/15 hover:border-emerald-400/40 hover:shadow-2xl hover:scale-105 transition-all duration-300 w-52">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-xl">🔗</div>
                    <span className="text-base font-bold text-on-surface font-headline">התאמה</span>
                  </div>
                  <p className="text-sm text-on-surface-variant leading-snug">חבר מילה באנגלית לתרגום בעברית</p>
                </div>
              </div>

              {/* ─ Floating card 3 — bottom ─ */}
              <div
                className="absolute group"
                style={{ bottom: -28, left: "50%", marginLeft: -100, animation: "floatCard3 5.5s ease-in-out infinite 1s" }}
              >
                <svg className="absolute top-0 right-10 w-12 h-16 pointer-events-none" style={{ transform: "translate(0, -100%)" }}>
                  <line x1="20" y1="56" x2="24" y2="0" stroke="var(--color-primary)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.3" />
                  <circle cx="24" cy="0" r="3" fill="var(--color-primary)" opacity="0.4" />
                </svg>
                <div className="bg-surface-container-lowest/95 backdrop-blur-xl rounded-2xl p-5 shadow-xl border border-outline-variant/15 hover:border-amber-400/40 hover:shadow-2xl hover:scale-105 transition-all duration-300 w-52">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl">📊</div>
                    <span className="text-base font-bold text-on-surface font-headline">התקדמות</span>
                  </div>
                  <p className="text-sm text-on-surface-variant leading-snug">לוח בקרה אישי עם סטטיסטיקות</p>
                </div>
              </div>

              {/* ─ Floating card 4 — right ─ */}
              <div
                className="absolute group"
                style={{ top: "36%", right: -70, animation: "floatCard2 5s ease-in-out infinite 1.5s" }}
              >
                <svg className="absolute top-4 left-0 w-16 h-10 pointer-events-none" style={{ transform: "translate(-100%, 0)" }}>
                  <line x1="60" y1="12" x2="0" y2="18" stroke="var(--color-primary)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.3" />
                  <circle cx="0" cy="18" r="3" fill="var(--color-primary)" opacity="0.4" />
                </svg>
                <div className="bg-surface-container-lowest/95 backdrop-blur-xl rounded-2xl p-5 shadow-xl border border-outline-variant/15 hover:border-rose-400/40 hover:shadow-2xl hover:scale-105 transition-all duration-300 w-52">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-xl">🎯</div>
                    <span className="text-base font-bold text-on-surface font-headline">אמיר&quot;ם</span>
                  </div>
                  <p className="text-sm text-on-surface-variant leading-snug">שאלות ברמת מבחן ב-5 רמות קושי</p>
                </div>
              </div>

            </div>

            {/* Mobile card grid — shown only on small screens */}
            <div className="grid grid-cols-2 gap-3 lg:hidden w-full max-w-sm mx-auto mt-2">
              {[
                { emoji: "🃏", label: "כרטיסיות", desc: "הפוך, גלה תרגום, עקוב", bg: "bg-violet-100", border: "hover:border-violet-400/40" },
                { emoji: "🔗", label: "התאמה", desc: "חבר מילה לתרגום", bg: "bg-emerald-100", border: "hover:border-emerald-400/40" },
                { emoji: "🎯", label: "אמיר\"ם", desc: "שאלות ב-5 רמות קושי", bg: "bg-rose-100", border: "hover:border-rose-400/40" },
                { emoji: "📊", label: "התקדמות", desc: "סטטיסטיקות אישיות", bg: "bg-amber-100", border: "hover:border-amber-400/40" },
              ].map((card) => (
                <div
                  key={card.label}
                  className={`bg-surface-container-lowest/90 backdrop-blur-xl rounded-2xl p-4 shadow-lg border border-outline-variant/15 ${card.border} hover:shadow-xl hover:scale-[1.03] transition-all duration-300`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center text-lg`}>{card.emoji}</div>
                    <span className="text-sm font-bold text-on-surface font-headline">{card.label}</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-snug">{card.desc}</p>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce hidden sm:block">
          <span className="material-symbols-outlined text-outline/40 text-3xl">expand_more</span>
        </div>
      </section>

      {/* ─── Features Section ─── */}
      <section id="features" className="py-20 sm:py-28 bg-surface-container-lowest">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="text-center mb-14 sm:mb-20">
            <span className="inline-block bg-primary-fixed/50 text-primary px-4 py-1.5 rounded-full text-sm font-bold mb-4">כלים ללמידה</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black font-headline text-on-surface mb-4">כל מה שצריך כדי{" "}
              <span className="text-primary">להצליח באנגלית</span>
            </h2>
            <p className="text-on-surface-variant text-base sm:text-lg max-w-2xl mx-auto">
              מגוון כלים אינטראקטיביים שהופכים את הלמידה ליעילה, מהנה ואישית
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {[
              {
                icon: "translate",
                title: "תרגול אוצר מילים",
                desc: "למעלה מ-500 מילים מחולקות לקטגוריות עם 4 אפשרויות תרגום — בחר את התשובה הנכונה וצבור ידע",
                color: "from-violet-500 to-indigo-600",
                bgLight: "bg-violet-50",
                iconColor: "text-violet-600",
              },
              {
                icon: "style",
                title: "כרטיסיות (Flashcards)",
                desc: "הפוך כרטיס, ראה את התרגום ודוגמה במשפט — סמן אם אתה יודע או צריך לחזור",
                color: "from-blue-500 to-cyan-500",
                bgLight: "bg-blue-50",
                iconColor: "text-blue-600",
              },
              {
                icon: "hub",
                title: "משחק התאמה",
                desc: "חבר 10 מילים באנגלית לתרגום בעברית — צבעים ייחודיים לכל זוג, תוצאות בסוף המשחק",
                color: "from-amber-500 to-orange-500",
                bgLight: "bg-amber-50",
                iconColor: "text-amber-600",
              },
              {
                icon: "quiz",
                title: "שאלות אמיר\"ם",
                desc: "שאלות ברמת מבחן אמיר\"ם אמיתי ב-5 רמות קושי — התאמן על סוג השאלות שמחכות לך במבחן",
                color: "from-emerald-500 to-green-600",
                bgLight: "bg-emerald-50",
                iconColor: "text-emerald-600",
              },
              {
                icon: "trending_up",
                title: "מעקב התקדמות חכם",
                desc: "לוח בקרה אישי עם סטטיסטיקות, אחוזי שליטה, המלצות חכמות וזיהוי נקודות חולשה",
                color: "from-rose-500 to-pink-600",
                bgLight: "bg-rose-50",
                iconColor: "text-rose-600",
              },
              {
                icon: "category",
                title: "20+ קטגוריות מילים",
                desc: "מתחיליות שלילה ועד מילות קישור, תחיליות זמן ומרחב — כל הנושאים שמופיעים במבחן",
                color: "from-teal-500 to-cyan-600",
                bgLight: "bg-teal-50",
                iconColor: "text-teal-600",
              },
            ].map((f, i) => (
              <div
                key={i}
                className="group bg-surface-container-lowest rounded-2xl p-6 sm:p-7 border border-outline-variant/10 hover:border-primary/20 hover:shadow-xl transition-all duration-300 relative overflow-hidden"
              >
                <div className={`absolute top-0 right-0 w-24 h-24 bg-linear-to-br ${f.color} opacity-5 rounded-bl-full group-hover:w-32 group-hover:h-32 transition-all duration-500`} />
                <div className={`w-12 h-12 rounded-2xl ${f.bgLight} ${f.iconColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>{f.icon}</span>
                </div>
                <h3 className="text-lg font-bold text-on-surface mb-2 font-headline">{f.title}</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Learning Roadmap ─── */}
      <section id="roadmap" className="py-20 sm:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-surface via-primary/2 to-surface" />
        <div className="max-w-3xl mx-auto px-4 sm:px-8 relative">
          <div className="text-center mb-16 sm:mb-20">
            <span className="inline-block bg-violet-100 text-violet-700 px-4 py-1.5 rounded-full text-sm font-bold mb-4">מסלול הלמידה</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black font-headline text-on-surface">
              מ<span className="text-primary">מתחיל</span> ל<span className="text-primary">שולט</span>
            </h2>
          </div>

          <div className="relative">
            {/* Winding SVG path — desktop, passes through each node center */}
            <svg
              className="absolute top-0 left-1/2 -translate-x-1/2 h-full hidden sm:block pointer-events-none"
              style={{ width: "200px" }}
              viewBox="0 0 200 1000"
              preserveAspectRatio="none"
              fill="none"
            >
              <path
                d="M 100 20 Q 190 130 100 240 Q 10 350 100 460 Q 190 570 100 680 Q 10 790 100 900 L 100 1000"
                stroke="url(#roadmapGrad)"
                strokeWidth="3"
                strokeDasharray="8 6"
                className="opacity-40"
              />
              <defs>
                <linearGradient id="roadmapGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-outline-variant)" />
                  <stop offset="50%" stopColor="var(--color-primary)" />
                  <stop offset="100%" stopColor="#7c3aed" />
                </linearGradient>
              </defs>
            </svg>

            {/* Mobile straight line */}
            <div className="absolute top-0 bottom-0 right-6 w-0.5 bg-linear-to-b from-outline-variant/30 via-primary/30 to-violet-500/30 sm:hidden" />

            {/* Roadmap steps */}
            <div className="relative space-y-16 sm:space-y-20">
              {[
                {
                  step: 1,
                  icon: "rocket_launch",
                  title: "מתחיל",
                  subtitle: "Beginner",
                  desc: "נרשמים בחינם ומתחילים עם מילים בסיסיות — קטגוריות קלות, כרטיסיות ומשחקי התאמה ראשונים",
                  color: "from-emerald-400 to-teal-500",
                  ringColor: "ring-emerald-200",
                  bgDot: "bg-emerald-500",
                  align: "right",
                },
                {
                  step: 2,
                  icon: "local_library",
                  title: "לומד",
                  subtitle: "Learner",
                  desc: "מרחיבים את אוצר המילים — תחיליות, מילות קישור, רמות קושי בינוניות ומעקב התקדמות",
                  color: "from-blue-400 to-indigo-500",
                  ringColor: "ring-blue-200",
                  bgDot: "bg-blue-500",
                  align: "left",
                },
                {
                  step: 3,
                  icon: "translate",
                  title: "מתרגל",
                  subtitle: "Practicing",
                  desc: "מתרגלים ברמה גבוהה — קטגוריות קשות, חזרה על מילים שטעיתם בהן, שליטה ב-80%+ מהמילים",
                  color: "from-amber-400 to-orange-500",
                  ringColor: "ring-amber-200",
                  bgDot: "bg-amber-500",
                  align: "right",
                },
                {
                  step: 4,
                  icon: "psychology",
                  title: "מתקדם",
                  subtitle: "Advanced",
                  desc: "שולטים ברוב הקטגוריות, עוברים לשאלות אמיר\"ם ברמות קושי שונות ומכינים את עצמכם למבחן",
                  color: "from-violet-400 to-purple-600",
                  ringColor: "ring-violet-200",
                  bgDot: "bg-violet-500",
                  align: "left",
                },
                {
                  step: 5,
                  icon: "emoji_events",
                  title: "שולט באמיר\"ם",
                  subtitle: "Amiram Master",
                  desc: "100% שליטה באוצר מילים, כל הקטגוריות הושלמו, ציון גבוה בשאלות אמיר\"ם — מוכנים למבחן!",
                  color: "from-yellow-400 to-amber-500",
                  ringColor: "ring-yellow-200",
                  bgDot: "bg-yellow-500",
                  align: "right",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`relative flex items-start gap-4 sm:gap-0 ${item.align === "left" ? "sm:flex-row-reverse" : "sm:flex-row"
                    }`}
                >
                  {/* Mobile dot */}
                  <div className={`sm:hidden shrink-0 w-12 h-12 rounded-2xl bg-linear-to-br ${item.color} flex items-center justify-center shadow-lg z-10`}>
                    <span className="material-symbols-outlined text-white text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                  </div>

                  {/* Desktop: card on one side */}
                  <div className={`flex-1 ${item.align === "left" ? "sm:text-left sm:pr-14" : "sm:text-right sm:pl-14"}`}>
                    <div className="group bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-outline-variant/10 hover:border-primary/20 hover:shadow-xl transition-all duration-300 relative overflow-hidden">
                      <div className={`absolute top-0 ${item.align === "left" ? "left-0 rounded-br-full" : "right-0 rounded-bl-full"} w-20 h-20 bg-linear-to-br ${item.color} opacity-[0.06] group-hover:w-28 group-hover:h-28 transition-all duration-500`} />
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-black text-outline font-body">STEP {item.step}</span>
                        <span className="text-xs font-bold text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded-full">{item.subtitle}</span>
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold font-headline text-on-surface mb-2">{item.title}</h3>
                      <p className="text-sm text-on-surface-variant leading-relaxed">{item.desc}</p>
                    </div>
                  </div>

                  {/* Desktop: center node */}
                  <div className="hidden sm:flex absolute left-1/2 -translate-x-1/2 top-4 z-10 flex-col items-center">
                    <div className={`w-14 h-14 rounded-2xl bg-linear-to-br ${item.color} flex items-center justify-center shadow-lg ring-4 ${item.ringColor} ring-offset-2 ring-offset-surface`}>
                      <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                    </div>
                  </div>

                  {/* Desktop: empty space on the other side */}
                  <div className="hidden sm:block flex-1" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Stats Section ─── */}
      <section id="stats" className="py-20 sm:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-r from-primary/5 via-transparent to-violet-500/5" />
        <div className="max-w-7xl mx-auto px-4 sm:px-8 relative">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black font-headline text-on-surface mb-3">בנתונים</h2>
            <p className="text-on-surface-variant text-base">מספרים שמדברים בעד עצמם</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              { ref: stats.words.ref, value: stats.words.value, suffix: "+", label: "מילים במאגר", icon: "dictionary", color: "text-primary" },
              { ref: stats.categories.ref, value: stats.categories.value, suffix: "+", label: "קטגוריות מילים", icon: "category", color: "text-violet-600" },
              { ref: stats.games.ref, value: stats.games.value, suffix: "", label: "מצבי תרגול", icon: "sports_esports", color: "text-amber-600" },
            ].map((s, i) => (
              <div key={i} ref={s.ref} className="text-center group">
                <div className="w-16 h-16 rounded-2xl bg-surface-container-lowest border border-outline-variant/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:shadow-lg transition-all">
                  <span className={`material-symbols-outlined text-3xl ${s.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
                </div>
                <p className="text-4xl sm:text-5xl font-black font-headline text-on-surface mb-1">{s.value}{s.suffix}</p>
                <p className="text-sm text-on-surface-variant font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="py-20 sm:py-28 bg-surface-container-lowest">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="text-center mb-14 sm:mb-20">
            <span className="inline-block bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-bold mb-4">פשוט וקל</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black font-headline text-on-surface">
              שלושה צעדים ל<span className="text-primary">הצלחה</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: "01",
                icon: "person_add",
                title: "הירשם בחינם",
                desc: "צור חשבון תוך שניות עם Google או אימייל — בלי תשלום, בלי התחייבות",
              },
              {
                step: "02",
                icon: "tune",
                title: "בחר מה לתרגל",
                desc: "בחר קטגוריה, רמת קושי ומצב תרגול — הכל מותאם אישית להתקדמות שלך",
              },
              {
                step: "03",
                icon: "emoji_events",
                title: "שלוט באנגלית",
                desc: "תרגל מדי יום, עקוב אחרי ההתקדמות ותראה את השיפור — מילה אחרי מילה",
              },
            ].map((item, i) => (
              <div key={i} className="text-center group">
                <div className="relative mx-auto mb-6">
                  <div className="w-20 h-20 rounded-3xl bg-primary/5 border-2 border-primary/10 flex items-center justify-center mx-auto group-hover:bg-primary/10 group-hover:border-primary/20 group-hover:scale-110 transition-all duration-300">
                    <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                  </div>
                  <span className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-white text-xs font-black flex items-center justify-center font-body shadow-lg">{item.step}</span>
                </div>
                <h3 className="text-xl font-bold font-headline text-on-surface mb-2">{item.title}</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed max-w-xs mx-auto">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Login / CTA Section ─── */}
      <section id="login-section" className="py-20 sm:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-t from-primary/5 via-transparent to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-8 relative">
          <div className="max-w-md mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-black font-headline text-on-surface mb-3">
                מוכן להתחיל?
              </h2>
              <p className="text-on-surface-variant text-base">התחבר לחשבון שלך או צור חשבון חדש</p>
            </div>

            <div className="bg-surface-container-lowest rounded-3xl p-6 sm:p-8 border border-outline-variant/15 shadow-xl shadow-black/5">
              {error && (
                <div className="mb-6 p-3 rounded-xl bg-error-container text-on-error-container text-sm font-medium border border-error/20 flex items-center gap-2">
                  <span className="material-symbols-outlined shrink-0 text-lg">error</span>
                  <p>{error}</p>
                </div>
              )}

              <form onSubmit={handleEmailLogin} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-on-surface-variant px-1" htmlFor="email">כתובת אימייל</label>
                  <div className="relative">
                    <input
                      className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3.5 text-on-surface outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all"
                      id="email"
                      placeholder="name@example.com"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline-variant text-xl">mail</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-on-surface-variant px-1" htmlFor="password">סיסמה</label>
                  <div className="relative">
                    <input
                      className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3.5 text-on-surface outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all"
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline-variant hover:text-primary transition-colors"
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <span className="material-symbols-outlined text-xl">{showPassword ? "visibility_off" : "visibility"}</span>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-primary text-on-primary font-bold text-base rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20 disabled:opacity-70 disabled:hover:scale-100"
                >
                  {loading ? "מתחבר..." : "כניסה"}
                </button>
              </form>

              <div className="flex items-center gap-3 my-5">
                <div className="h-px bg-outline-variant/40 grow" />
                <span className="text-xs text-outline font-medium">או</span>
                <div className="h-px bg-outline-variant/40 grow" />
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-surface-container-low rounded-xl border border-outline-variant/20 hover:border-primary/20 hover:shadow-md transition-all font-medium text-sm disabled:opacity-70"
              >
                <Image
                  alt="Google"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBhNQDYZutqEWSpwe5Cz7s2kU8h7DB4H2Nn6e-IA_ajpB2bXnc56-wJ8W3KeKS2l_fa09RGTGahdP6gq7ewReq0XvNsmMp92UMp9T6j860NpjPVPCp1aA1xHlHfjdauWwQc90uVnKiPXC9026V8sEzCdFn8rsw4uvDQ3VdK-e8BUIWTE2SXX8j7RitJtU9wt7ssyZUlr-sAYSPDooj1zGLmebgXQ6vLbl1f8R9HNN0VSPblffflCJObZQODIhTW9jtJ9pSbauQZZpcC"
                  width={20}
                  height={20}
                  className="w-5 h-5"
                />
                <span className="text-on-surface">כניסה עם Google</span>
              </button>

              <p className="text-center text-sm text-on-surface-variant mt-6">
                עדיין אין לך חשבון?{" "}
                <Link href="/register" className="text-primary font-bold hover:underline">הרשמה בחינם</Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="bg-surface-container-low border-t border-outline-variant/15 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="flex flex-col sm:flex-row-reverse justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <Image src="/logo.png" alt="Atlas" width={96} height={96} className="w-8 h-8" />
              <span className="text-lg font-bold font-headline text-on-surface">Atlas</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-outline">
              <Link href="#" className="hover:text-primary transition-colors">תנאי שימוש</Link>
              <Link href="#" className="hover:text-primary transition-colors">מדיניות פרטיות</Link>
              <Link href="#" className="hover:text-primary transition-colors">צור קשר</Link>
            </div>
            <p className="text-xs text-outline font-body">© 2025 Atlas. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
