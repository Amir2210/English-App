import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "הגדרות | The Scholarly Horizon",
  description: "ניהול הגדרות חשבון והעדפות למידה",
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
