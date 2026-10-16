import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hammer Ridealong Responses",
  description: "Review submitted Hammer aviation ridealong reports.",
};

export default function HammerRidealongResponsesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

