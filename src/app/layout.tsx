import type { Metadata } from "next";
import "./globals.css";
import { Orbitron } from "next/font/google";
import LayoutWrapper from "@/components/LayoutWrapper";

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "101st Doom Battalion | Official Military Operations Hub",
  description:
    "The official operational command system for personnel management.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${orbitron.className} antialiased`}>
        <LayoutWrapper>
          {children}
        </LayoutWrapper>
      </body>
    </html>
  );
}
