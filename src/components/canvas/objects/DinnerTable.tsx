"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { CandleFlame, WineGlass } from "./Glassware";
import { makeLeafGeometry, makeRoseGeometry, usePetalMaterials } from "./Flowers";
import { Glow, SoftShadow } from "./Atmosphere";

function placeCardTexture(ready: boolean) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f4eee7";
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = "#D8BC8A";
  g.lineWidth = 4;
  g.strokeRect(14, 14, 484, 228);
  g.fillStyle = "#551E32";
  g.textAlign = "center";
  g.font = `italic 500 64px ${ready ? '"Cormorant Garamond", ' : ""}Georgia, serif`;
  g.fillText("Giuseppe & Milena", 256, 128);
  g.font = `500 26px ${ready ? '"Manrope Variable", ' : ""}Helvetica, sans-serif`;
  g.fillStyle = "#8a6a4a";
  g.fillText("RISERVATO · 20:30", 256, 190);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Tavolo per due: tovaglia, piatti, calici, candela e una piccola composizione. */
export function DinnerTable(props: { position?: [number, number, number] }) {
  const petals = usePetalMaterials();
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    document.fonts?.ready.then(() => setFontsReady(true)).catch(() => {});
  }, []);

  const res = useMemo(() => {
    // tovaglia: profilo tornito con pieghe
    const pts: THREE.Vector2[] = [];
    pts.push(new THREE.Vector2(0, 0.78));
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI * 0.5;
      pts.push(new THREE.Vector2(1.05 + Math.sin(a) * 0.05, 0.78 - (1 - Math.cos(a)) * 0.05));
    }
    pts.push(new THREE.Vector2(1.12, 0.6), new THREE.Vector2(1.17, 0.35), new THREE.Vector2(1.2, 0.18));
    const cloth = new THREE.LatheGeometry(pts, 96);
    const p = cloth.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const r = Math.hypot(x, z);
      if (r < 1.06) continue;
      const ang = Math.atan2(z, x);
      const drop = THREE.MathUtils.clamp((0.76 - y) / 0.58, 0, 1);
      const k = 1 + Math.sin(ang * 16) * 0.035 * drop + Math.sin(ang * 7 + 1) * 0.015 * drop;
      p.setX(i, x * k);
      p.setZ(i, z * k);
    }
    cloth.computeVertexNormals();

    const plate = new THREE.LatheGeometry(
      [[0, 0], [0.16, 0], [0.18, 0.008], [0.2, 0.012], [0.25, 0.022], [0.255, 0.026], [0.245, 0.028], [0.2, 0.018], [0.0, 0.012]].map(
        ([r, y]) => new THREE.Vector2(r, y),
      ),
      48,
    );
    plate.computeVertexNormals();
    const vase = new THREE.LatheGeometry(
      [[0, 0], [0.07, 0], [0.085, 0.04], [0.08, 0.12], [0.05, 0.18], [0.055, 0.2], [0.05, 0.2]].map(([r, y]) => new THREE.Vector2(r, y)),
      32,
    );
    vase.computeVertexNormals();
    const rose = makeRoseGeometry(5, 0.9);
    const leaf = makeLeafGeometry(0.16, 0.07);
    return { cloth, plate, vase, rose, leaf };
  }, []);

  const mats = useMemo(
    () => ({
      cloth: new THREE.MeshPhysicalMaterial({ color: "#f1e9de", roughness: 0.85, sheen: 0.8, sheenColor: new THREE.Color("#fff6e8"), side: THREE.DoubleSide }),
      plate: new THREE.MeshPhysicalMaterial({ color: "#fbf8f3", roughness: 0.25, clearcoat: 0.8 }),
      gold: new THREE.MeshStandardMaterial({ color: "#D8BC8A", metalness: 1, roughness: 0.28 }),
      silver: new THREE.MeshStandardMaterial({ color: "#d9d9de", metalness: 1, roughness: 0.22 }),
      wax: new THREE.MeshStandardMaterial({ color: "#f4eee7", roughness: 0.6, emissive: new THREE.Color("#ffb070"), emissiveIntensity: 0.35 }),
      chair: new THREE.MeshStandardMaterial({ color: "#2a1a16", roughness: 0.45, metalness: 0.1 }),
      velvet: new THREE.MeshPhysicalMaterial({ color: "#551E32", roughness: 0.9, sheen: 1, sheenColor: new THREE.Color("#a3465f") }),
      vase: new THREE.MeshPhysicalMaterial({ color: "#D8BC8A", metalness: 0.6, roughness: 0.2, clearcoat: 1 }),
      floor: new THREE.MeshStandardMaterial({ color: "#1a1214", roughness: 0.35, metalness: 0.2 }),
    }),
    [],
  );
  const card = useMemo(() => new THREE.MeshStandardMaterial({ map: placeCardTexture(fontsReady), roughness: 0.7 }), [fontsReady]);

  const setting = (side: 1 | -1) => (
    <group position={[0, 0.785, side * 0.62]} rotation={[0, side === 1 ? 0 : Math.PI, 0]}>
      <mesh geometry={res.plate} material={mats.gold} scale={1.14} position={[0, -0.002, 0]} />
      <mesh geometry={res.plate} material={mats.plate} position={[0, 0.006, 0]} />
      {/* posate */}
      <mesh material={mats.silver} position={[-0.33, 0.006, 0]}>
        <boxGeometry args={[0.022, 0.006, 0.3]} />
      </mesh>
      <mesh material={mats.silver} position={[0.33, 0.006, 0]}>
        <boxGeometry args={[0.02, 0.006, 0.32]} />
      </mesh>
      <mesh material={mats.velvet} position={[0, 0.03, 0.06]} rotation={[0, 0.7, 0]}>
        <boxGeometry args={[0.18, 0.03, 0.12]} />
      </mesh>
      <WineGlass position={[0.3, 0, -0.32]} scale={0.38} />
    </group>
  );

  const chair = (side: 1 | -1) => (
    <group position={[0, 0, side * 1.55]} rotation={[0, side === 1 ? Math.PI : 0, 0]}>
      <mesh material={mats.velvet} position={[0, 0.5, 0]}>
        <boxGeometry args={[0.52, 0.08, 0.5]} />
      </mesh>
      <mesh material={mats.velvet} position={[0, 0.95, -0.24]} rotation={[-0.08, 0, 0]}>
        <boxGeometry args={[0.5, 0.75, 0.06]} />
      </mesh>
      {[-0.22, 0.22].map((x) =>
        [-0.21, 0.21].map((z) => (
          <mesh key={`${x}${z}`} material={mats.chair} position={[x, 0.24, z]}>
            <cylinderGeometry args={[0.02, 0.016, 0.48, 6]} />
          </mesh>
        )),
      )}
    </group>
  );

  return (
    <group {...props}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={mats.floor}>
        <circleGeometry args={[6, 48]} />
      </mesh>
      <SoftShadow position={[0, 0.005, 0]} scale={3.2} opacity={0.7} />
      <mesh geometry={res.cloth} material={mats.cloth} />
      {setting(1)}
      {setting(-1)}
      {chair(1)}
      {chair(-1)}
      {/* candela */}
      <group position={[0.18, 0.78, -0.05]}>
        <mesh material={mats.gold} position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.07, 0.09, 0.04, 24]} />
        </mesh>
        <mesh material={mats.wax} position={[0, 0.17, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.26, 16]} />
        </mesh>
        <CandleFlame position={[0, 0.37, 0]} scale={0.42} />
        <Glow position={[0, 0.36, 0]} color="#ffb060" scale={1.4} opacity={0.85} />
      </group>
      {/* composizione floreale */}
      <group position={[-0.2, 0.78, 0.05]}>
        <mesh geometry={res.vase} material={mats.vase} />
        <mesh geometry={res.rose} material={petals.pink} position={[0, 0.24, 0]} scale={0.42} rotation={[0.2, 0, 0.1]} />
        <mesh geometry={res.rose} material={petals.white} position={[0.07, 0.21, 0.04]} scale={0.34} rotation={[0.5, 1, -0.6]} />
        <mesh geometry={res.rose} material={petals.pink} position={[-0.07, 0.2, -0.03]} scale={0.32} rotation={[-0.4, 2, 0.6]} />
        <mesh geometry={res.leaf} material={petals.leaf} position={[0.05, 0.18, -0.06]} rotation={[-1, 0.4, 0]} />
        <mesh geometry={res.leaf} material={petals.leaf} position={[-0.05, 0.18, 0.06]} rotation={[1.1, -0.6, 0]} />
      </group>
      {/* segnaposto */}
      <mesh material={card} position={[0.02, 0.83, 0.28]} rotation={[-0.5, 0, 0]}>
        <planeGeometry args={[0.2, 0.1]} />
      </mesh>
    </group>
  );
}
