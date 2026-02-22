import type { Metadata } from "next";
import "./globals.css";
import { Orbitron } from "next/font/google";

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Personnel Command System",
  description: "Server & Certification Management",
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