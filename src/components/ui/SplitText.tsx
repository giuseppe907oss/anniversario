"use client";

import { createElement, Fragment, type ElementType } from "react";

/**
 * Divide un testo in parole e lettere (span) per le animazioni tipografiche.
 * Il testo completo resta accessibile tramite aria-label; gli span sono aria-hidden.
 */
export function SplitText({
  text,
  as = "span",
  className,
  mode = "chars",
}: {
  text: string;
  as?: ElementType;
  className?: string;
  mode?: "chars" | "words";
}) {
  const words = text.split(" ");
  return createElement(
    as,
    { className, "aria-label": text, "data-split": mode },
    words.map((w, wi) => (
      <Fragment key={wi}>
        <span className="split-word" aria-hidden="true">
          {mode === "chars" ? (
            Array.from(w).map((c, ci) => (
              <span key={ci} className="split-char">
                {c}
              </span>
            ))
          ) : (
            <span className="split-char">{w}</span>
          )}
        </span>
        {wi < words.length - 1 ? " " : null}
      </Fragment>
    )),
  );
}
