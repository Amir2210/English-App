import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "תרגול | Atlas",
  description: "תרגול שאלות אמיר״ם ואוצר מילים באנגלית",
};

export default function PracticeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
