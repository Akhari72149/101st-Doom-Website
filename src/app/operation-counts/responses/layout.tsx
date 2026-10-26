import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Operation Count Responses | 101st Doom Battalion",
  description: "Review submitted CR and CR-C operation-count forms.",
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
