import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "לוח בקרה | Atlas",
  description: "לוח הבקרה האישי שלך - עקוב אחרי ההתקדמות שלך בלימוד אנגלית",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
