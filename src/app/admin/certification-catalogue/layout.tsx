import { metadataFor } from "@/lib/siteMetadata";

export const metadata = metadataFor("/admin/certification-catalogue");

export default function CertificationCatalogueLayout({ children }: { children: React.ReactNode }) {
  return children;
}
