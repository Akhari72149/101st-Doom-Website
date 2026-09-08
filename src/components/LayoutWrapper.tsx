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

  return (
    <>
      {!hideNavbar && <NavbarClient />}
      {children}
      {!hideFooter && <LegalFooter />}
      <WebsiteUpdateNotice />
    </>
  );
}
