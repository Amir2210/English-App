"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";

export default function RegisterPage() {
  const router = useRouter();
  
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update display name
      if (userCredential.user) {
        await updateProfile(userCredential.user, {
          displayName: fullName
        });
      }
      
      alert("החשבון נוצר בהצלחה!");
      router.push("/settings"); // redirect strictly to settings wizard for onboarding
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string };
      if (firebaseErr.code === "auth/email-already-in-use") {
        setError("כתובת האימייל כבר בשימוש במערכת.");
      } else if (firebaseErr.code === "auth/weak-password") {
        setError("הסיסמה חלשה מדי, בחר לפחות 6 תווים.");
      } else {
        setError("שגיאה ביצירת החשבון. אנא נסה שוב.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* TopAppBar Navigation Shell */}
      <header className="flex items-center justify-between px-6 py-4 w-full h-16 bg-surface z-50">
        <div className="flex items-center gap-4">
          <Link href="/" className="scale-95 hover:scale-105 active:opacity-80 transition-transform text-primary flex items-center justify-center">
            <span className="material-symbols-outlined" style={{fontVariationSettings: "'wght' 600"}}>arrow_back</span>
          </Link>
          <h1 className="font-headline font-bold text-lg text-on-surface">הצטרפות למסלול האקדמי</h1>
        </div>
        <div className="w-8"></div> {/* Spacer for balance */}
      </header>

      <main className="w-full max-w-md px-6 pt-12 pb-12 flex flex-col items-center mx-auto">
        {/* Decorative Icon/Logo Section */}
        <div className="mb-10 text-center animate-fade-in-up">
          <div className="w-24 h-24 bg-primary-fixed rounded-full flex items-center justify-center mb-6 mx-auto shadow-[0px_10px_40px_rgba(0,91,191,0.1)] transition-transform duration-500 hover:scale-110">
            <span className="material-symbols-outlined text-primary text-5xl" style={{fontVariationSettings: "'FILL' 1"}}>school</span>
          </div>
          <h2 className="text-3xl font-headline font-extrabold text-on-surface tracking-tight leading-tight">The Scholarly Horizon</h2>
          <p className="text-on-surface-variant font-label text-lg mt-2 opacity-80">התחילו את המסע האקדמי שלכם היום</p>
        </div>

        {/* Global Error Notice */}
        {error && (
          <div className="w-full mb-6 p-4 rounded-xl bg-error-container text-on-error-container text-sm font-medium border border-error/20 flex flex-row items-center gap-3">
            <span className="material-symbols-outlined shrink-0">error</span>
            <p>{error}</p>
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleRegister} className="w-full flex flex-col gap-8">
          
          {/* Full Name */}
          <div className="space-y-2">
            <label className="text-on-surface font-semibold text-sm mr-1">שם מלא</label>
            <div className="relative group">
              <input 
                className="w-full h-14 bg-surface-container-low border-none rounded-xl px-4 text-on-surface font-label focus:ring-0 focus:bg-surface-container-lowest transition-all outline-none" 
                placeholder="ישראל ישראלי" 
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary scale-x-0 group-focus-within:scale-x-100 transition-transform duration-300 origin-center"></div>
            </div>
          </div>

          {/* Email Address */}
          <div className="space-y-2">
            <label className="text-on-surface font-semibold text-sm mr-1">כתובת אימייל</label>
            <div className="relative group">
              <input 
                className="w-full h-14 bg-surface-container-low border-none rounded-xl px-4 text-on-surface font-body focus:ring-0 focus:bg-surface-container-lowest transition-all outline-none" 
                dir="ltr" 
                placeholder="example@scholar.ac.il" 
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary scale-x-0 group-focus-within:scale-x-100 transition-transform duration-300 origin-center"></div>
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="text-on-surface font-semibold text-sm mr-1">סיסמה</label>
            <div className="relative group">
              <input 
                className="w-full h-14 bg-surface-container-low border-none rounded-xl pl-14 pr-4 text-on-surface font-body focus:ring-0 focus:bg-surface-container-lowest transition-all outline-none" 
                dir="ltr" 
                placeholder="••••••••" 
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:text-primary hover:bg-on-surface/5 transition-colors focus:outline-none" 
                type="button"
                aria-label={showPassword ? "הסתר סיסמה" : "הצג סיסמה"}
                onClick={() => setShowPassword(!showPassword)}
              >
                <span className="material-symbols-outlined">
                  {showPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary scale-x-0 group-focus-within:scale-x-100 transition-transform duration-300 origin-center"></div>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="mt-4">
            <button 
              className="w-full h-16 bg-linear-to-r from-primary to-primary-container text-white rounded-full font-label font-bold text-lg shadow-[0px_10px_25px_rgba(0,91,191,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:hover:scale-100" 
              type="submit"
              disabled={loading}
            >
              {loading ? "יוצר חשבון..." : "צור חשבון"}
            </button>
          </div>
        </form>

        {/* Secondary Action */}
        <div className="mt-10 text-center">
          <p className="text-on-surface-variant font-label">
            כבר יש לך חשבון?{" "}
            <Link className="text-primary font-bold hover:underline underline-offset-4 mr-1" href="/">
              התחבר
            </Link>
          </p>
        </div>

        {/* Trust Indicator */}
        <div className="mt-20 w-full p-6 bg-surface-container-lowest rounded-3xl border border-outline-variant/10 relative overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-default">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/5 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
          <div className="relative z-10 flex items-start gap-4">
            <div className="p-3 bg-primary-fixed rounded-xl group-hover:bg-primary-container transition-colors duration-300">
              <span className="material-symbols-outlined text-primary group-hover:text-on-primary transition-colors duration-300">verified_user</span>
            </div>
            <div>
              <h4 className="font-bold text-on-surface font-headline">אבטחה אקדמית בתקן מחמיר</h4>
              <p className="text-sm text-on-surface-variant mt-1 leading-relaxed font-label">
                הפרטים שלך מוצפנים ונשמרים במערכות המאובטחות של The Scholarly Horizon.
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
