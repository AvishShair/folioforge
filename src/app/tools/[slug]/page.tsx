import { notFound } from "next/navigation";
import Link from "next/link";
import { tools } from "@/lib/domain";
import { Workspace } from "@/components/workspace";
export function generateStaticParams() {
  return tools.map((t) => ({ slug: t.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = tools.find((t) => t.id === slug);
  return {
    title: tool?.name,
    description: tool?.description,
    alternates: process.env.NEXT_PUBLIC_SITE_URL
      ? { canonical: `/tools/${slug}` }
      : undefined,
  };
}
export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = tools.find((t) => t.id === slug);
  if (!tool) notFound();
  return (
    <main id="main" className="tool-page">
      <Link href="/#tools" className="back">
        ← All tools
      </Link>
      <div className="tool-heading">
        <p className="eyebrow">{tool.category} workspace</p>
        <h1>{tool.name}</h1>
        <p>{tool.description}</p>
      </div>
      <Workspace key={tool.id} id={tool.id} />
      <section className="tool-help">
        <h2>Make it yours, in three steps.</h2>
        <ol>
          <li>
            Choose{" "}
            {tool.input === "pdf"
              ? "a PDF document"
              : "JPEG, PNG, or WebP images"}{" "}
            from your device.
          </li>
          <li>Adjust the settings and process your files locally.</li>
          <li>Download your result, then reset to clear the workspace.</li>
        </ol>
        <h3>Good to know</h3>
        {tool.limitations.map((l) => (
          <p key={l}>{l}</p>
        ))}
        {["split-pdf", "rotate-pdf", "watermark-pdf", "pdf-to-images"].includes(
          slug,
        ) && (
          <p>
            Page ranges use one-based numbering: 1-3, 5, 8-10. Leave blank for
            all pages. Split ranges produce one file per comma-separated group.
          </p>
        )}
        <p>
          50 MB per input, 150 MB combined, up to 500 PDF pages or 32 megapixels
          per image. No files leave this browser.
        </p>
      </section>
      <section className="related">
        <h2>Keep things moving.</h2>
        {tools
          .filter((t) => t.category === tool.category && t.id !== tool.id)
          .slice(0, 3)
          .map((t) => (
            <Link key={t.id} href={t.route}>
              {t.name} ↗
            </Link>
          ))}
      </section>
    </main>
  );
}
