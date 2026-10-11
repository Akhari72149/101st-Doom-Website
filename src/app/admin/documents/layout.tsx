import { metadataFor } from "@/lib/siteMetadata";

export const metadata = metadataFor("/admin/documents");
export default function DocumentsAdminLayout({ children }: { children: React.ReactNode }) { return children; }
