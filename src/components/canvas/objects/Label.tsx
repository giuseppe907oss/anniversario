"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

/** Etichetta tipografica come sprite (canvas 2D), sempre rivolta alla camera. */
export function Label({
  text,
  position,
  size = 0.35,
  color = "#F4EEE7",
  italic = true,
  opacity = 0.9,
  font = "Cormorant Garamond",
  weight = 500,
  letterSpacing = 0,
}: {
  text: string;
  position: [number, number, number];
  size?: number;
  color?: string;
  italic?: boolean;
  opacity?: number;
  font?: string;
  weight?: number;
  letterSpacing?: number;
}) {
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const fam = `${italic ? "italic " : ""}${weight} 64px "${font}"`;
    (document.fonts?.load(fam) ?? Promise.resolve())
      .catch(() => {})
      .finally(() => alive && setFontsReady(true));
    return () => {
      alive = false;
    };
  }, [font, italic, weight]);

  const { tex, aspect } = useMemo(() => {
    const c = document.createElement("canvas");
    const g = c.getContext("2d")!;
    const px = 96;
    const fontStr = `${italic ? "italic " : ""}${weight} ${px}px "${font}", Georgia, serif`;
    g.font = fontStr;
    const spacing = letterSpacing * px;
    const w = Math.ceil(g.measureText(text).width + spacing * text.length + px * 0.6);
    c.width = w;
    c.height = Math.ceil(px * 1.5);
    g.font = fontStr;
    g.fillStyle = color;
    g.textBaseline = "middle";
    g.shadowColor = "rgba(0,0,0,0.6)";
    g.shadowBlur = 12;
    if ("letterSpacing" in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${spacing}px`;
    g.fillText(text, px * 0.3, c.height / 2);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { tex, aspect: c.width / c.height };
    // fontsReady forza il ridisegno quando il font è disponibile
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, color, italic, font, weight, letterSpacing, fontsReady]);

  useEffect(() => () => tex.dispose(), [tex]);

  return (
    <sprite position={position} scale={[size * aspect * 1.5, size * 1.5, 1]} renderOrder={12}>
      <spriteMaterial map={tex} transparent opacity={opacity} depthWrite={false} fog={false} />
    </sprite>
  );
}
