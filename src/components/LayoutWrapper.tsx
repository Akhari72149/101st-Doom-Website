"use client";

import { usePathname } from "next/navigation";
import NavbarClient from "@/components/NavbarClient";
import LegalFooter from "@/components/legal/LegalFooter";
import WebsiteUpdateNotice from "@/components/WebsiteUpdateNotice";

export default function LayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const hideNavbar =
    pathname === "/login" || pathname === "/change-password" || pathname.startsWith("/planops");
  const hideFooter = pathname === "/change-password" || pathname.startsWith("/planops");
  const editorialPage = [
    "/",
    "/Who-We-Are",
    "/Join",
    "/News",
    "/Art-of-War",
    "/documents",
    "/faq",
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
      <WebsiteUpdateNotice />
    </>
  );
}
