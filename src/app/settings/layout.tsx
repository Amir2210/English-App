import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "הגדרות | Atlas",
  description: "ניהול הגדרות חשבון והעדפות למידה",
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
