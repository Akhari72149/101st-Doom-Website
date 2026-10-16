import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hammer Ridealong Tracker",
  description: "Public Hammer aviation trainee progression and supervised ridealong records.",
};

export default function HammerRidealongsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
