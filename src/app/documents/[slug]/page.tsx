import ManagedDocumentClient from "./ManagedDocumentClient";

export default async function ManagedDocumentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ManagedDocumentClient slug={slug} />;
}
