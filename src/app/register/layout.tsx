import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "הרשמה | Atlas",
  description: "צור חשבון חדש ב-Atlas",
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
