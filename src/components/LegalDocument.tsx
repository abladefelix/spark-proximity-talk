import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { parseLegal, stripEmphasis } from "@/lib/legal";

/**
 * Renders a legal document. These pages are opened both inside the app and
 * from a desktop browser (store review, listing links), so they opt out of
 * the native fixed-viewport lock and scroll like a normal web page.
 */
export function LegalDocument({
  markdown,
  supportEmail,
}: {
  markdown: string;
  supportEmail?: string;
}) {
  useEffect(() => {
    document.body.setAttribute("data-web-page", "");
    return () => document.body.removeAttribute("data-web-page");
  }, []);

  const blocks = parseLegal(markdown);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-24 pt-10">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back
      </Link>
      <article className="mt-6">
        {blocks.map((block, i) => {
          if (block.kind === "h1")
            return (
              <h1 key={i} className="text-2xl font-semibold tracking-tight">
                {stripEmphasis(block.text)}
              </h1>
            );
          if (block.kind === "h2")
            return (
              <h2 key={i} className="mt-8 text-base font-semibold">
                {stripEmphasis(block.text)}
              </h2>
            );
          if (block.kind === "em")
            return (
              <p key={i} className="mt-2 text-xs text-muted-foreground">
                {stripEmphasis(block.text)}
              </p>
            );
          if (block.kind === "ul")
            return (
              <ul key={i} className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                {block.items.map((item, j) => (
                  <li key={j}>{stripEmphasis(item)}</li>
                ))}
              </ul>
            );
          return (
            <p key={i} className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {stripEmphasis(block.text)}
            </p>
          );
        })}
        {supportEmail ? (
          <p className="mt-8 text-sm">
            Support:{" "}
            <a className="text-primary underline-offset-4 hover:underline" href={`mailto:${supportEmail}`}>
              {supportEmail}
            </a>
          </p>
        ) : null}
      </article>
    </main>
  );
}
