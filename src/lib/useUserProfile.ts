"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";

export type UserLevel = "beginner" | "intermediate" | "advanced";
export type UserFocus = "amiram" | "general" | "both";
export type DailyMinutes = 5 | 15 | 30;

export interface UserProfile {
  level: UserLevel;
  focus: UserFocus;
  dailyMinutes: DailyMinutes;
  selfAssessmentScore: number;
  onboardingComplete: boolean;
}

interface UseUserProfileReturn extends UserProfile {
  user: User | null;
  loading: boolean;
}

const DEFAULTS: UserProfile = {
  level: "intermediate",
  focus: "both",
  dailyMinutes: 15,
  selfAssessmentScore: 0,
  onboardingComplete: false,
};

let cachedProfile: UserProfile | null = null;
let cachedUid: string | null = null;

export function useUserProfile(): UseUserProfileReturn {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setProfile(DEFAULTS);
        cachedProfile = null;
        cachedUid = null;
        setLoading(false);
        return;
      }

      if (cachedProfile && cachedUid === currentUser.uid) {
        setProfile(cachedProfile);
        setLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", currentUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          const p: UserProfile = {
            level: data.level || DEFAULTS.level,
            focus: data.focus || DEFAULTS.focus,
            dailyMinutes: data.dailyMinutes || DEFAULTS.dailyMinutes,
            selfAssessmentScore: data.selfAssessmentScore ?? DEFAULTS.selfAssessmentScore,
            onboardingComplete: data.onboardingComplete ?? DEFAULTS.onboardingComplete,
          };
          setProfile(p);
          cachedProfile = p;
          cachedUid = currentUser.uid;
        }
      } catch (err) {
        console.error("Error loading user profile:", err);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  return { ...profile, user, loading };
}

export function invalidateProfileCache() {
  cachedProfile = null;
  cachedUid = null;
}
