import type { Metadata } from "next";
import "./globals.css";
import { Orbitron } from "next/font/google";
import LayoutWrapper from "@/components/LayoutWrapper";

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://101stdoombattalion.com"),
  applicationName: "101st Doom Battalion",
  title: {
    default: "101st Doom Battalion",
    template: "%s | 101st Doom Battalion",
  },
  description:
    "The official website and personnel operations platform of the 101st Doom Battalion.",
  openGraph: {
    type: "website",
    siteName: "101st Doom Battalion",
    title: "101st Doom Battalion",
    description: "The official website and personnel operations platform of the 101st Doom Battalion.",
    url: "/",
    images: [{ url: "/icons/DBLogo.jpg", alt: "101st Doom Battalion emblem" }],
  },
  twitter: {
    card: "summary",
    title: "101st Doom Battalion",
    description: "The official website and personnel operations platform of the 101st Doom Battalion.",
    images: ["/icons/DBLogo.jpg"],
  },
  icons: {
    icon: [{ url: "/icons/DBLogo-favicon.png", type: "image/png" }],
    shortcut: "/icons/DBLogo-favicon.png",
    apple: "/icons/DBLogo-favicon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${orbitron.className} antialiased site-theme`}>
        <LayoutWrapper>
          {children}
        </LayoutWrapper>
      </body>
    </html>
  );
}
