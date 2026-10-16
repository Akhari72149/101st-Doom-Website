import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hammer Ridealong Report",
  description: "Password-protected Hammer aviation ridealong submission form.",
  robots: { index: false, follow: false },
};

export default function HammerRidealongReportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
