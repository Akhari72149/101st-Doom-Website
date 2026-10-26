import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Operation Counts | 101st Doom Battalion",
  description: "Track CR and CR-C operation credits and promotion readiness.",
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
