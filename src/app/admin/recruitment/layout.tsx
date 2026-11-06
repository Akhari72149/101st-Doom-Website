import { metadataFor } from "@/lib/siteMetadata";

export const metadata = metadataFor("/admin/recruitment");

export default function RecruitmentAdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
