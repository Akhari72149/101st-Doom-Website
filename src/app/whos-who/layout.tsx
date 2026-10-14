import { metadataFor } from "@/lib/siteMetadata";

export const metadata = metadataFor("/whos-who");

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
