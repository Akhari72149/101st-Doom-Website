"use client";

import { usePathname } from "next/navigation";
import NavbarClient from "@/components/NavbarClient";

export default function LayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const hideNavbar = pathname === "/login";

  return (
    <>
      {!hideNavbar && <NavbarClient />}
      {children}
    </>
  );
}