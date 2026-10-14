import { metadataFor } from "@/lib/siteMetadata";

export const metadata = metadataFor("/recognition");

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
