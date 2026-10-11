"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import NavbarClient from "@/components/NavbarClient";
import LegalFooter from "@/components/legal/LegalFooter";
import WebsiteUpdateNotice from "@/components/WebsiteUpdateNotice";

function subscribeToLocation(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

function getEmbeddedSnapshot() {
  return new URLSearchParams(window.location.search).get("embedded") === "1";
}

export default function LayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const embedded = useSyncExternalStore(subscribeToLocation, getEmbeddedSnapshot, () => false);

  const hideNavbar =
    embedded || pathname === "/login" || pathname === "/change-password" || pathname.startsWith("/planops");
  const hideFooter = embedded || pathname === "/change-password" || pathname.startsWith("/planops");
  const editorialPage = [
    "/",
    "/Who-We-Are",
    "/Join",
    "/News",
    "/Art-of-War",
    "/documents",
    "/faq",
    "/rank-structure",
  ].includes(pathname);

  return (
    <>
      {!hideNavbar && <NavbarClient />}
      <div
        className="contents"
        data-page-surface={editorialPage ? "editorial" : "operational"}
      >
        {children}
      </div>
      {!hideFooter && <LegalFooter />}
      {!embedded && <WebsiteUpdateNotice />}
    </>
  );
}
