import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Orbitron } from "next/font/google";
import LayoutWrapper from "@/components/LayoutWrapper";
import PwaServiceWorker from "@/components/PwaServiceWorker";

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
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "101st Doom",
  },
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
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#000a06",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${orbitron.className} antialiased site-theme`}>
        <LayoutWrapper>
          {children}
        </LayoutWrapper>
        <PwaServiceWorker />
      </body>
    </html>
  );
}
