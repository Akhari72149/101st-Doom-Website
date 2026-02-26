import type { Metadata } from "next";
import "./globals.css";
import { Orbitron } from "next/font/google";

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "101st Doom Battalion | Official Military Operations Hub",
  description: "The official operational command system for the 101st Doom Battalion. View rosters, certifications, campaigns, and military operations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${orbitron.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}