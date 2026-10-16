import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hammer Ridealong Archive",
  description: "Archived Hammer aviation trainee and ridealong progression records.",
};

export default function HammerRidealongArchiveLayout({ children }: { children: React.ReactNode }) {
  return children;
}

