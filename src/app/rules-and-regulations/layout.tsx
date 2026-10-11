import type { Metadata } from "next";
import { metadataFor } from "@/lib/siteMetadata";

export const metadata: Metadata = metadataFor("/rules-and-regulations");

export default function RulesLayout({ children }: { children: React.ReactNode }) { return children; }
