"use client";

import { usePathname } from "next/navigation";
import NavbarClient from "@/components/NavbarClient";
import LegalFooter from "@/components/legal/LegalFooter";

export default function LayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const hideNavbar =
    pathname === "/login" || pathname.startsWith("/planops");
  const hideFooter = pathname.startsWith("/planops");

  return (
    <>
      {!hideNavbar && <NavbarClient />}
      {children}
      {!hideFooter && <LegalFooter />}
    </>
  );
}
