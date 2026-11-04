import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Map Requests | 101st Doom Battalion",
  description: "Request Steam Workshop maps and review which requested maps are currently available on the battalion server.",
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
