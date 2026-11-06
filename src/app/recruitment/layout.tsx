import { metadataFor } from "@/lib/siteMetadata";

export const metadata = metadataFor("/recruitment");

export default function RecruitmentLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
