"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Glow } from "./Atmosphere";

/* ------------------------------------------------------------------ */
/*  Materiali                                                           */
/* ------------------------------------------------------------------ */

function marbleTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#d9d0c4";
  g.fillRect(0, 0, 256, 256);
  // corsi di conci
  for (let y = 0; y < 256; y += 16) {
    g.fillStyle = `rgba(120,105,90,${0.08 + Math.random() * 0.06})`;
    g.fillRect(0, y, 256, 1);
    for (let x = (y / 16) % 2 ? 0 : 20; x < 256; x += 40) {
      g.fillRect(x, y, 1, 16);
    }
  }
  for (let i = 0; i < 2200; i++) {
    g.fillStyle = `rgba(${90 + Math.random() * 60},${80 + Math.random() * 50},${70 + Math.random() * 40},${Math.random() * 0.06})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 6, 1 + Math.random() * 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function roseWindowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const cx = 128;
  const grd = g.createRadialGradient(cx, cx, 0, cx, cx, 128);
  grd.addColorStop(0, "#ffe7b0");
  grd.addColorStop(0.35, "#f0a860");
  grd.addColorStop(0.8, "#8c3a3a");
  grd.addColorStop(1, "#2a0f18");
  g.fillStyle = grd;
  g.beginPath();
  g.arc(cx, cx, 126, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(30,15,15,0.85)";
  g.lineWidth = 5;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * 18, cx + Math.sin(a) * 18);
    g.lineTo(cx + Math.cos(a) * 124, cx + Math.sin(a) * 124);
    g.stroke();
  }
  [18, 60, 95, 124].forEach((r) => {
    g.beginPath();
    g.arc(cx, cx, r, 0, Math.PI * 2);
    g.stroke();
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function useArchMaterials() {
  return useMemo(() => {
    const tex = marbleTexture();
    const marble = new THREE.MeshStandardMaterial({ color: "#efe6da", map: tex, roughness: 0.62, metalness: 0 });
    const marbleWarm = new THREE.MeshStandardMaterial({
      color: "#f2e2cc",
      map: tex,
      roughness: 0.6,
      emissive: new THREE.Color("#3a2a1c"),
      emissiveIntensity: 0.12,
    });
    const roof = new THREE.MeshStandardMaterial({ color: "#3b3f47", roughness: 0.55, metalness: 0.3 });
    const dome = new THREE.MeshStandardMaterial({ color: "#59655f", roughness: 0.35, metalness: 0.55 });
    const portal = new THREE.MeshBasicMaterial({ color: "#ffb766" });
    const windowWarm = new THREE.MeshBasicMaterial({ color: "#ffcf8a" });
    const rose = new THREE.MeshBasicMaterial({ map: roseWindowTexture() });
    const paving = new THREE.MeshStandardMaterial({ color: "#2b2626", roughness: 0.32, metalness: 0.25 });
    return { marble, marbleWarm, roof, dome, portal, windowWarm, rose, paving };
  }, []);
}

/* ------------------------------------------------------------------ */
/*  Duomo di Como — INTERPRETAZIONE STILIZZATA, non una riproduzione    */
/* ------------------------------------------------------------------ */

export function DuomoStylized(props: { position?: [number, number, number]; rotation?: [number, number, number] }) {
  const m = useArchMaterials();
  const geo = useMemo(() => {
    // profilo della facciata: corpo centrale più alto, ali laterali, frontone
    const s = new THREE.Shape();
    s.moveTo(-4, 0);
    s.lineTo(4, 0);
    s.lineTo(4, 5.0);
    s.lineTo(2.3, 5.9);
    s.lineTo(2.3, 7.0);
    s.lineTo(0, 8.5);
    s.lineTo(-2.3, 7.0);
    s.lineTo(-2.3, 5.9);
    s.lineTo(-4, 5.0);
    s.closePath();
    // aperture (portali) come fori
    const arch = (cx: number, w: number, h: number) => {
      const p = new THREE.Path();
      p.moveTo(cx - w / 2, 0.01);
      p.lineTo(cx - w / 2, h - w / 2);
      p.absarc(cx, h - w / 2, w / 2, Math.PI, 0, true);
      p.lineTo(cx + w / 2, 0.01);
      p.closePath();
      return p;
    };
    s.holes.push(arch(0, 1.25, 2.9), arch(-2.6, 0.8, 2.1), arch(2.6, 0.8, 2.1));
    const facade = new THREE.ExtrudeGeometry(s, { depth: 0.7, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1, curveSegments: 16 });
    facade.translate(0, 0, -0.7);
    const uv = facade.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.25, uv.getY(i) * 0.25);

    // lesene + pinnacoli
    const parts: THREE.BufferGeometry[] = [];
    [-4, -2.3, 2.3, 4].forEach((x, i) => {
      const hTop = i === 1 || i === 2 ? 7.0 : 5.0;
      const pil = new THREE.BoxGeometry(0.34, hTop + 0.4, 0.3);
      pil.translate(x, (hTop + 0.4) / 2, 0.12);
      parts.push(pil);
      const cone = new THREE.ConeGeometry(0.16, 1.3, 8);
      cone.translate(x, hTop + 1.05, 0.12);
      parts.push(cone);
    });
    // cornici orizzontali
    [2.95, 4.2].forEach((y) => {
      const b = new THREE.BoxGeometry(8.2, 0.1, 0.16);
      b.translate(0, y, 0.08);
      parts.push(b);
    });
    // statue/edicole stilizzate: piccole colonnine
    for (let k = 0; k < 6; k++) {
      const x = -1.6 + k * 0.64;
      const c = new THREE.CylinderGeometry(0.05, 0.05, 0.75, 6);
      c.translate(x, 3.45, 0.1);
      parts.push(c);
    }
    const ornaments = mergeGeometries(parts)!;

    // navata, transetto, tiburio con cupola e lanterna
    const nave = new THREE.BoxGeometry(7.6, 5.0, 13);
    nave.translate(0, 2.5, -7.3);
    const aisleRoofShape = new THREE.Shape();
    aisleRoofShape.moveTo(-2.3, 0);
    aisleRoofShape.lineTo(2.3, 0);
    aisleRoofShape.lineTo(0, 1.4);
    aisleRoofShape.closePath();
    const roofGeo = new THREE.ExtrudeGeometry(aisleRoofShape, { depth: 13, bevelEnabled: false });
    roofGeo.translate(0, 6.0, -13.8);
    const clerestory = new THREE.BoxGeometry(4.6, 1.0, 13);
    clerestory.translate(0, 5.5, -7.3);
    const transept = new THREE.BoxGeometry(13, 5.6, 4.2);
    transept.translate(0, 2.8, -12.5);
    const drum = new THREE.CylinderGeometry(2.6, 2.6, 2.6, 24);
    drum.translate(0, 7.4, -12.5);
    const body = mergeGeometries([nave, clerestory, transept, drum])!;

    const domeGeo = new THREE.SphereGeometry(2.7, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    domeGeo.scale(1, 1.15, 1);
    domeGeo.translate(0, 8.7, -12.5);
    const lanternParts = [
      new THREE.CylinderGeometry(0.45, 0.5, 1.0, 12).translate(0, 12.3, -12.5),
      new THREE.ConeGeometry(0.5, 0.9, 12).translate(0, 13.25, -12.5),
      new THREE.SphereGeometry(0.12, 8, 6).translate(0, 13.8, -12.5),
    ];
    const lantern = mergeGeometries(lanternParts)!;

    // finestre del tamburo
    const winParts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const w = new THREE.PlaneGeometry(0.35, 1.1);
      w.translate(0, 0, 2.62);
      w.rotateY(a);
      w.translate(0, 7.4, -12.5);
      winParts.push(w);
    }
    // finestre laterali della navata
    for (let i = 0; i < 5; i++) {
      [-3.82, 3.82].forEach((x) => {
        const w = new THREE.PlaneGeometry(0.5, 1.4);
        w.rotateY(x > 0 ? Math.PI / 2 : -Math.PI / 2);
        w.translate(x, 2.8, -2.8 - i * 2.2);
        winParts.push(w);
      });
    }
    const windows = mergeGeometries(winParts)!;

    // portali illuminati dall'interno (dietro i fori)
    const portalParts = [
      new THREE.PlaneGeometry(1.3, 3.0).translate(0, 1.5, -0.62),
      new THREE.PlaneGeometry(0.85, 2.2).translate(-2.6, 1.1, -0.62),
      new THREE.PlaneGeometry(0.85, 2.2).translate(2.6, 1.1, -0.62),
    ];
    const portals = mergeGeometries(portalParts)!;

    return { facade, ornaments, body, roofGeo, domeGeo, lantern, windows, portals };
  }, []);

  return (
    <group {...props}>
      <mesh geometry={geo.facade} material={m.marbleWarm} />
      <mesh geometry={geo.ornaments} material={m.marble} />
      <mesh geometry={geo.body} material={m.marble} />
      <mesh geometry={geo.roofGeo} material={m.roof} />
      <mesh geometry={geo.domeGeo} material={m.dome} />
      <mesh geometry={geo.lantern} material={m.marble} />
      <mesh geometry={geo.windows} material={m.windowWarm} />
      <mesh geometry={geo.portals} material={m.portal} />
      {/* rosone */}
      <mesh position={[0, 5.35, 0.06]} material={m.rose}>
        <circleGeometry args={[0.95, 48]} />
      </mesh>
      <mesh position={[0, 5.35, 0.08]} material={m.marble}>
        <torusGeometry args={[1.0, 0.09, 8, 48]} />
      </mesh>
      <Glow position={[0, 5.35, 0.4]} color="#ffb070" scale={3.2} opacity={0.45} />
      <Glow position={[0, 1.4, 0.5]} color="#ffb766" scale={3.4} opacity={0.5} />
      {/* piazza */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 4]} material={m.paving}>
        <planeGeometry args={[40, 30]} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Tempio Voltiano — interpretazione stilizzata                        */
/* ------------------------------------------------------------------ */

export function TempioStylized(props: { position?: [number, number, number]; rotation?: [number, number, number]; scale?: number }) {
  const m = useArchMaterials();
  const geo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    // basamento a gradoni
    [0, 1, 2].forEach((k) => {
      const b = new THREE.BoxGeometry(6.4 - k * 0.3, 0.18, 6.4 - k * 0.3);
      b.translate(0, 0.09 + k * 0.18, 0);
      parts.push(b);
    });
    // corpo cilindrico
    const body = new THREE.CylinderGeometry(2.3, 2.3, 3.2, 32);
    body.translate(0, 0.54 + 1.6, -0.4);
    parts.push(body);
    const cornice = new THREE.CylinderGeometry(2.45, 2.45, 0.22, 32);
    cornice.translate(0, 0.54 + 3.3, -0.4);
    parts.push(cornice);
    const drum = new THREE.CylinderGeometry(1.9, 2.1, 0.7, 32);
    drum.translate(0, 0.54 + 3.75, -0.4);
    parts.push(drum);
    // pronao: colonne + architrave + timpano
    for (let i = 0; i < 6; i++) {
      const x = -2.0 + i * 0.8;
      const col = new THREE.CylinderGeometry(0.16, 0.18, 2.9, 12);
      col.translate(x, 0.54 + 1.45, 2.1);
      parts.push(col);
      const cap = new THREE.BoxGeometry(0.44, 0.16, 0.44);
      cap.translate(x, 0.54 + 2.97, 2.1);
      parts.push(cap);
    }
    const arch = new THREE.BoxGeometry(5.0, 0.4, 1.7);
    arch.translate(0, 0.54 + 3.25, 1.6);
    parts.push(arch);
    const ped = new THREE.Shape();
    ped.moveTo(-2.6, 0);
    ped.lineTo(2.6, 0);
    ped.lineTo(0, 0.95);
    ped.closePath();
    const pedGeo = new THREE.ExtrudeGeometry(ped, { depth: 1.7, bevelEnabled: false });
    pedGeo.translate(0, 0.54 + 3.45, 0.75);
    parts.push(pedGeo);
    const stone = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!;

    const dome = new THREE.SphereGeometry(1.95, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.translate(0, 0.54 + 4.1, -0.4);
    const lantern = new THREE.CylinderGeometry(0.3, 0.35, 0.6, 12);
    lantern.translate(0, 0.54 + 6.2, -0.4);
    const door = new THREE.PlaneGeometry(1.0, 1.9);
    door.translate(0, 0.54 + 0.95, 1.92);
    return { stone, dome, lantern, door };
  }, []);

  return (
    <group {...props}>
      <mesh geometry={geo.stone} material={m.marbleWarm} />
      <mesh geometry={geo.dome} material={m.dome} />
      <mesh geometry={geo.lantern} material={m.marble} />
      <mesh geometry={geo.door} material={m.portal} />
      <Glow position={[0, 1.6, 2.6]} color="#ffbe7a" scale={5} opacity={0.4} />
      <Glow position={[0, 5.2, 0]} color="#ffd9a8" scale={7} opacity={0.18} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Lampioni del lungolago                                              */
/* ------------------------------------------------------------------ */

export function LampPosts({ points }: { points: [number, number, number][] }) {
  const pole = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1d1d22", roughness: 0.5, metalness: 0.6 }), []);
  const bulb = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffe2b0" }), []);
  return (
    <group>
      {points.map((p, i) => (
        <group key={i} position={p}>
          <mesh material={pole} position={[0, 1.3, 0]}>
            <cylinderGeometry args={[0.035, 0.05, 2.6, 6]} />
          </mesh>
          <mesh material={bulb} position={[0, 2.7, 0]}>
            <sphereGeometry args={[0.13, 12, 8]} />
          </mesh>
          <Glow position={[0, 2.7, 0]} color="#ffc98a" scale={1.8} opacity={0.75} />
        </group>
      ))}
    </group>
  );
}
