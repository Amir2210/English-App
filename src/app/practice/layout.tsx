import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "תרגול | The Scholarly Horizon",
  description: "תרגול שאלות אמיר״ם ואוצר מילים באנגלית",
};

export default function PracticeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
