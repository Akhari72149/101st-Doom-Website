import type { Metadata } from "next";
import { metadataFor } from "@/lib/siteMetadata";

export const metadata: Metadata = metadataFor("/uniform-guide");

export default function UniformGuideLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
