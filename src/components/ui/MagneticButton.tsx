"use client";

import { motion, useMotionValue, useSpring } from "motion/react";
import { useRef, type ReactNode } from "react";
import { selectReducedMotion, useUI } from "@/lib/store";

type Variant = "primary" | "secondary" | "ghost";

const styles: Record<Variant, string> = {
  primary:
    "bg-champagne text-night shadow-[0_10px_40px_-10px_rgba(216,188,138,0.6)] hover:shadow-[0_14px_50px_-8px_rgba(216,188,138,0.75)]",
  secondary: "glass text-ivory hover:border-champagne/50",
  ghost: "text-ivory/80 hover:text-ivory border border-ivory/15 hover:border-ivory/35",
};

interface Props {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: Variant;
  className?: string;
  ariaLabel?: string;
  external?: boolean;
  strength?: number;
  size?: "md" | "sm";
}

/**
 * Pulsante con attrazione "magnetica" su desktop (puntatore fine)
 * e micro-feedback al tocco su mobile.
 */
export function MagneticButton({
  children,
  onClick,
  href,
  variant = "primary",
  className = "",
  ariaLabel,
  external,
  strength = 0.28,
  size = "md",
}: Props) {
  const reduced = useUI(selectReducedMotion);
  const ref = useRef<HTMLElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.6 });

  const onMove = (e: React.PointerEvent) => {
    if (reduced || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };

  const sizing = size === "sm" ? "min-h-11 px-4 py-2 text-[0.82rem] gap-2" : "min-h-12 px-6 py-3 text-[0.95rem] gap-2.5";
  const cls = `group relative inline-flex ${sizing} items-center justify-center overflow-hidden rounded-full font-medium tracking-[0.01em] transition-[box-shadow,border-color,color] duration-500 select-none ${styles[variant]} ${className}`;

  const inner = (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-1000 ease-out group-hover:translate-x-full"
      />
      <span className={`relative inline-flex items-center ${size === "sm" ? "gap-1.5" : "gap-2.5"}`}>{children}</span>
    </>
  );

  const common = {
    style: { x: sx, y: sy },
    onPointerMove: onMove,
    onPointerLeave: reset,
    whileTap: reduced ? undefined : { scale: 0.965 },
    className: cls,
    "aria-label": ariaLabel,
  };

  if (href) {
    return (
      <motion.a
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        {...common}
      >
        {inner}
      </motion.a>
    );
  }
  return (
    <motion.button ref={ref as React.Ref<HTMLButtonElement>} type="button" onClick={onClick} {...common}>
      {inner}
    </motion.button>
  );
}
