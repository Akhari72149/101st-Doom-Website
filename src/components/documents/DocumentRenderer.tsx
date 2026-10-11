import type { CSSProperties, ReactNode } from "react";
import type { DocumentBlock, DocumentRun } from "@/data/siteDocuments";
import { blockText } from "@/data/siteDocuments";

const colours = {
  default: "#d5e1d8",
  green: "#00ff66",
  cyan: "#67e8f9",
  amber: "#facc15",
  red: "#fca5a5",
};

export function documentHeadingId(block: DocumentBlock, index: number) {
  const value = blockText(block).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return value || `section-${index}`;
}

function renderRun(run: DocumentRun, key: number) {
  const style: CSSProperties = {
    fontFamily: run.font ? `'${run.font}', sans-serif` : undefined,
    fontSize: run.size ? `${run.size}px` : undefined,
    color: colours[run.colour || "default"],
    fontWeight: run.bold ? 800 : undefined,
    fontStyle: run.italic ? "italic" : undefined,
    textDecoration: run.underline ? "underline" : undefined,
  };
  const content = <span key={key} style={style}>{run.text}</span>;
  return run.href ? <a key={key} href={run.href} target="_blank" rel="noreferrer" className="text-cyan-300 underline decoration-cyan-300/45 underline-offset-4 hover:text-cyan-100">{content}</a> : content;
}

export default function DocumentRenderer({ content, className = "" }: { content: DocumentBlock[]; className?: string }) {
  return (
    <div className={`document-content ${className}`}>
      {content.map((block, index) => {
        const children = block.runs.map(renderRun) as ReactNode;
        const style = { textAlign: block.align, marginLeft: block.level ? `${block.level * 1.5}rem` : undefined } as CSSProperties;
        if (block.type === "divider") return <hr key={index} className="my-7 border-0 border-t border-[#00ff66]/25" />;
        if (block.type === "heading1") return <h2 key={index} id={documentHeadingId(block, index)} style={style} className="mb-4 mt-12 scroll-mt-24 border-l-2 border-[#00ff66] pl-4 text-2xl font-black uppercase text-white sm:text-3xl">{children}</h2>;
        if (block.type === "heading2") return <h3 key={index} id={documentHeadingId(block, index)} style={style} className="mb-3 mt-8 scroll-mt-24 text-xl font-black text-[#00ff66]">{children}</h3>;
        if (block.type === "heading3") return <h4 key={index} style={style} className="mb-2 mt-6 text-base font-black uppercase text-cyan-200">{children}</h4>;
        if (block.type === "numbered") return <div key={index} style={style} className="my-3 grid grid-cols-[2.3rem_minmax(0,1fr)] gap-2 text-sm leading-7 sm:text-base"><span className="font-black text-[#00ff66]">{block.start ? `${block.start}.` : "#"}</span><p>{children}</p></div>;
        if (block.type === "bullet") return <div key={index} style={style} className="my-2 grid grid-cols-[1rem_minmax(0,1fr)] gap-2 text-sm leading-7 sm:text-base"><span className="pt-0.5 text-[#00ff66]">▪</span><p>{children}</p></div>;
        return <p key={index} style={style} className="my-3 whitespace-pre-wrap text-sm leading-7 text-[#b7c8bc] sm:text-base">{children}</p>;
      })}
    </div>
  );
}
