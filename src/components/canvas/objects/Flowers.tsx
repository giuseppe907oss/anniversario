"use client";

import { useFrame, type ThreeElements } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mulberry32 } from "@/lib/noise";
import { sceneTime } from "../clock";

/* ------------------------------------------------------------------ */
/*  Petalo procedurale: piano deformato (coppa + ricciolo del bordo)    */
/* ------------------------------------------------------------------ */

function petal(width: number, height: number, cup: number, curl: number, tilt: number, shade: [number, number]) {
  const g = new THREE.PlaneGeometry(1, 1, 7, 9);
  g.translate(0, 0.5, 0);
  const p = g.attributes.position as THREE.BufferAttribute;
  const colors: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i); // -0.5..0.5
    const v = p.getY(i); // 0..1
    // profilo: base stretta, testa larga e arrotondata
    const w = (0.18 + 0.92 * Math.sin(Math.min(v * 1.25, 1) * Math.PI * 0.62)) * (1 - Math.pow(Math.max(v - 0.8, 0) / 0.2, 2) * 0.35);
    const x = u * w * width;
    const y = v * height;
    // coppa: i bordi si chiudono verso il centro del fiore
    let z = -Math.pow(Math.abs(x) / (width * 0.5), 2) * cup * width;
    // ricciolo: la punta si piega verso l'esterno; i bordi si arrotolano
    z += Math.pow(v, 2.6) * curl * height;
    z += Math.pow(Math.abs(u) * 2, 3) * Math.pow(v, 2) * curl * 0.35 * height;
    p.setXYZ(i, x, y, z);
    const s = THREE.MathUtils.lerp(shade[0], shade[1], Math.pow(v, 0.7));
    colors.push(s, s, s);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.rotateX(tilt);
  return g;
}

/**
 * Rosa: ogni petalo è avvolto su un cilindro attorno all'asse del fiore
 * (raggio che cresce con l'altezza = apertura), con il bordo superiore
 * che si arriccia verso l'esterno. Dai petali chiusi del bocciolo a quelli aperti.
 */
export function makeRoseGeometry(seed = 1, openness = 1) {
  const rnd = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [];
  const layers = [
    { n: 3, h: 0.17, r0: 0.01, open: 0.05, curl: 0.0, cover: 0.55 },
    { n: 4, h: 0.2, r0: 0.022, open: 0.09, curl: 0.02, cover: 0.45 },
    { n: 5, h: 0.23, r0: 0.034, open: 0.14, curl: 0.05, cover: 0.4 },
    { n: 5, h: 0.25, r0: 0.046, open: 0.22, curl: 0.09, cover: 0.36 },
    { n: 6, h: 0.27, r0: 0.056, open: 0.32, curl: 0.15, cover: 0.33 },
    { n: 6, h: 0.27, r0: 0.064, open: 0.45, curl: 0.22, cover: 0.3 },
  ];
  let rot = rnd() * Math.PI * 2;
  layers.forEach((L, li) => {
    const k = li >= 3 ? THREE.MathUtils.lerp(0.35, 1, openness) : 1;
    for (let i = 0; i < L.n; i++) {
      const g = new THREE.PlaneGeometry(1, 1, 8, 7);
      g.translate(0, 0.5, 0);
      const pos = g.attributes.position as THREE.BufferAttribute;
      const colors: number[] = [];
      const h = L.h * (0.94 + rnd() * 0.12);
      const open = L.open * k * (0.9 + rnd() * 0.2);
      const curl = L.curl * k;
      const base = rot + (i / L.n) * Math.PI * 2 + (rnd() - 0.5) * 0.25;
      const cover = L.cover * Math.PI * 2;
      for (let j = 0; j < pos.count; j++) {
        const u = pos.getX(j); // -0.5..0.5
        const v = pos.getY(j); // 0..1
        const w = (0.42 + 0.58 * Math.sin(Math.min(v * 1.25, 1) * Math.PI * 0.5)) * (1 - THREE.MathUtils.smoothstep(v, 0.82, 1) * 0.28);
        const phi = base + u * w * cover;
        const au = Math.abs(u) * 2;
        const R = L.r0 + open * v * h + curl * Math.pow(v, 3) * h + 0.3 * curl * au * au * v * h;
        const y = (v * h) / (1 + 0.25 * open) - li * 0.008;
        pos.setXYZ(j, Math.sin(phi) * R, y, Math.cos(phi) * R);
        const sh = THREE.MathUtils.lerp(0.35 + li * 0.07, 1, Math.pow(v, 0.55)) * (0.92 + au * au * 0.12);
        colors.push(sh, sh, sh);
      }
      g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      parts.push(g);
    }
    rot += 0.75 + rnd() * 0.5;
  });
  // sepali
  for (let i = 0; i < 5; i++) {
    const g = petal(0.05, 0.12, 0.3, -0.1, Math.PI * 0.62, [0.25, 0.3]);
    g.rotateY((i / 5) * Math.PI * 2);
    g.translate(0, 0.005, 0);
    parts.push(g);
  }
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

/** Foglia ellittica con nervatura centrale piegata. */
export function makeLeafGeometry(len = 0.5, wid = 0.2) {
  const g = new THREE.PlaneGeometry(1, 1, 4, 8);
  g.translate(0, 0.5, 0);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i), v = p.getY(i);
    const w = Math.sin(v * Math.PI) * (1 - v * 0.25);
    const x = u * w * wid;
    const y = v * len;
    const z = Math.abs(u) * w * wid * 0.45 - Math.sin(v * Math.PI) * 0.04 * len + v * v * 0.12 * len;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------------ */
/*  Materiali (condivisi)                                               */
/* ------------------------------------------------------------------ */

export function usePetalMaterials() {
  return useMemo(() => {
    const pink = new THREE.MeshPhysicalMaterial({
      color: "#D6A7B3",
      vertexColors: true,
      roughness: 0.6,
      sheen: 1,
      sheenRoughness: 0.45,
      sheenColor: new THREE.Color("#ffe1ea"),
      side: THREE.DoubleSide,
      emissive: new THREE.Color("#6a2c3c"),
      emissiveIntensity: 0.35,
    });
    const white = new THREE.MeshPhysicalMaterial({
      color: "#F4EEE7",
      vertexColors: true,
      roughness: 0.62,
      sheen: 1,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color("#fff6ec"),
      side: THREE.DoubleSide,
      emissive: new THREE.Color("#5a4c40"),
      emissiveIntensity: 0.3,
    });
    const leaf = new THREE.MeshStandardMaterial({ color: "#3f5a40", roughness: 0.55, side: THREE.DoubleSide });
    const sage = new THREE.MeshStandardMaterial({ color: "#7d9583", roughness: 0.7, side: THREE.DoubleSide });
    const stem = new THREE.MeshStandardMaterial({ color: "#4c6b45", roughness: 0.7 });
    return { pink, white, leaf, sage, stem };
  }, []);
}

/* ------------------------------------------------------------------ */
/*  Bouquet                                                             */
/* ------------------------------------------------------------------ */

interface RoseSpec {
  pos: [number, number, number];
  dir: [number, number, number];
  white: boolean;
  scale: number;
  seed: number;
  open: number;
}

export function Bouquet({ detail = 1, ...props }: ThreeElements["group"] & { detail?: number }) {
  const mats = usePetalMaterials();
  const data = useMemo(() => {
    const rnd = mulberry32(2026);
    const roseGeos = [makeRoseGeometry(3, 1), makeRoseGeometry(9, 0.75), makeRoseGeometry(17, 0.95)];
    const leafGeo = makeLeafGeometry(0.42, 0.17);
    const coinLeaf = new THREE.CircleGeometry(0.045, 10);

    // rose su una cupola
    const roses: RoseSpec[] = [];
    roses.push({ pos: [0, 1.3, 0], dir: [0, 1, 0], white: false, scale: 0.78, seed: 0, open: 1 });
    const ring = 6;
    for (let i = 0; i < ring; i++) {
      const a = (i / ring) * Math.PI * 2 + 0.3;
      const r = 0.36;
      roses.push({
        pos: [Math.cos(a) * r, 1.2 - rnd() * 0.05, Math.sin(a) * r],
        dir: [Math.cos(a) * 0.55, 1, Math.sin(a) * 0.55],
        white: i % 2 === 0,
        scale: 0.7 + rnd() * 0.1,
        seed: i + 1,
        open: 0.8,
      });
    }
    // anello esterno, più basso
    const outer = detail > 0.6 ? 5 : 3;
    for (let i = 0; i < outer; i++) {
      const a = (i / outer) * Math.PI * 2 + 1.1;
      roses.push({
        pos: [Math.cos(a) * 0.58, 1.0, Math.sin(a) * 0.58],
        dir: [Math.cos(a) * 1.2, 0.8, Math.sin(a) * 1.2],
        white: i % 2 === 1,
        scale: 0.62,
        seed: i + 10,
        open: 0.6,
      });
    }

    // foglie
    const leaves: THREE.Matrix4[] = [];
    const nLeaves = Math.round(16 * detail + 6);
    for (let i = 0; i < nLeaves; i++) {
      const a = (i / nLeaves) * Math.PI * 2 + rnd() * 0.4;
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.9 - rnd() * 0.5, -a + Math.PI / 2, 0, "YXZ"));
      const r = 0.5 + rnd() * 0.15;
      m.compose(new THREE.Vector3(Math.cos(a) * r * 0.7, 0.92 + rnd() * 0.1, Math.sin(a) * r * 0.7), q, new THREE.Vector3(1, 1, 1).multiplyScalar(0.85 + rnd() * 0.4));
      leaves.push(m);
    }

    // eucalipto: foglioline tonde su rametti
    const coins: THREE.Matrix4[] = [];
    const sprigs = Math.round(7 * detail + 3);
    for (let s = 0; s < sprigs; s++) {
      const a = (s / sprigs) * Math.PI * 2 + 0.6;
      const base = new THREE.Vector3(Math.cos(a) * 0.45, 1.05, Math.sin(a) * 0.45);
      const dir = new THREE.Vector3(Math.cos(a), 1.1, Math.sin(a)).normalize();
      for (let k = 0; k < 7; k++) {
        const p = base.clone().addScaledVector(dir, 0.08 + k * 0.07);
        p.x += (k % 2 ? 1 : -1) * 0.03;
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3));
        m.compose(p, q, new THREE.Vector3(1, 1, 1).multiplyScalar(1 - k * 0.07));
        coins.push(m);
      }
    }

    // nebbiolina (gypsophila): puntini bianchi
    const dots: THREE.Matrix4[] = [];
    const nDots = Math.round(140 * detail);
    for (let i = 0; i < nDots; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 0.25 + rnd() * 0.45;
      const m = new THREE.Matrix4();
      m.compose(
        new THREE.Vector3(Math.cos(a) * r, 1.12 + rnd() * 0.32 - r * 0.25, Math.sin(a) * r),
        new THREE.Quaternion(),
        new THREE.Vector3(1, 1, 1).multiplyScalar(0.6 + rnd() * 0.8),
      );
      dots.push(m);
    }

    // carta: cono aperto con bordo ondulato
    const paperGeo = new THREE.CylinderGeometry(0.78, 0.1, 1.15, 48, 6, true);
    const pp = paperGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pp.count; i++) {
      const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i);
      const ang = Math.atan2(z, x);
      const top = (y + 0.575) / 1.15;
      const wave = Math.sin(ang * 5) * 0.06 * top * top + Math.sin(ang * 13) * 0.012 * top;
      pp.setY(i, y + wave);
      const k = 1 + Math.sin(ang * 9) * 0.02 * top;
      pp.setX(i, x * k);
      pp.setZ(i, z * k);
    }
    paperGeo.computeVertexNormals();

    return { roseGeos, leafGeo, coinLeaf, roses, leaves, coins, dots, paperGeo };
  }, [detail]);

  const leafRef = useRef<THREE.InstancedMesh>(null);
  const coinRef = useRef<THREE.InstancedMesh>(null);
  const dotRef = useRef<THREE.InstancedMesh>(null);

  const setInstances = (mesh: THREE.InstancedMesh | null, list: THREE.Matrix4[]) => {
    if (!mesh || mesh.userData.done) return;
    list.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.userData.done = true;
  };

  const paper = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#f3ebe0",
        roughness: 0.8,
        sheen: 0.5,
        sheenColor: new THREE.Color("#fff3df"),
        emissive: new THREE.Color("#3a2c22"),
        emissiveIntensity: 0.35,
        side: THREE.DoubleSide,
      }),
    [],
  );
  const paperInner = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#551E32", roughness: 0.8, side: THREE.BackSide }),
    [],
  );
  const ribbon = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: "#6b2238", roughness: 0.3, sheen: 1, sheenColor: new THREE.Color("#c46d84"), clearcoat: 0.4 }),
    [],
  );
  const dotMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#fbf6ef", roughness: 0.6, emissive: "#3b3530", emissiveIntensity: 0.4 }), []);

  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  return (
    <group {...props}>
      {data.roses.map((r, i) => {
        q.setFromUnitVectors(up, new THREE.Vector3(...r.dir).normalize());
        const e = new THREE.Euler().setFromQuaternion(q);
        return (
          <group key={i} position={r.pos} rotation={e}>
            <mesh geometry={data.roseGeos[r.seed % 3]} material={r.white ? mats.white : mats.pink} scale={r.scale} />
            <mesh position={[0, -0.25, 0]} material={mats.stem}>
              <cylinderGeometry args={[0.012, 0.014, 0.5, 6]} />
            </mesh>
          </group>
        );
      })}
      <instancedMesh
        ref={(m) => setInstances(m, data.leaves)}
        args={[data.leafGeo, mats.leaf, data.leaves.length]}
      />
      <instancedMesh
        ref={(m) => setInstances(m, data.coins)}
        args={[data.coinLeaf, mats.sage, data.coins.length]}
      />
      <instancedMesh ref={(m) => setInstances(m, data.dots)} args={[undefined, dotMat, data.dots.length]}>
        <sphereGeometry args={[0.011, 6, 4]} />
      </instancedMesh>
      {/* carta + interno bordeaux */}
      <mesh geometry={data.paperGeo} material={paper} position={[0, 0.5, 0]} />
      <mesh geometry={data.paperGeo} material={paperInner} position={[0, 0.5, 0]} scale={0.985} />
      {/* steli che escono sotto */}
      <mesh position={[0, -0.25, 0]} material={mats.stem}>
        <cylinderGeometry args={[0.07, 0.05, 0.5, 10]} />
      </mesh>
      {/* nastro */}
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]} material={ribbon}>
        <torusGeometry args={[0.13, 0.03, 10, 32]} />
      </mesh>
      <mesh position={[0.05, -0.12, 0.12]} rotation={[0.2, 0, 0.5]} material={ribbon}>
        <boxGeometry args={[0.05, 0.36, 0.008]} />
      </mesh>
      <mesh position={[-0.06, -0.14, 0.12]} rotation={[0.2, 0, -0.35]} material={ribbon}>
        <boxGeometry args={[0.05, 0.4, 0.008]} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Petali sospesi che fluttuano                                        */
/* ------------------------------------------------------------------ */

export function FloatingPetals({
  count = 40,
  radius = 3,
  height = 3,
  center = [0, 1, 0] as [number, number, number],
}: {
  count?: number;
  radius?: number;
  height?: number;
  center?: [number, number, number];
}) {
  const mats = usePetalMaterials();
  const ref = useRef<THREE.InstancedMesh>(null);
  const { geo, seeds } = useMemo(() => {
    const geo = petal(0.13, 0.15, 0.6, 0.15, 0, [0.7, 1]);
    geo.translate(0, -0.075, 0);
    geo.computeVertexNormals();
    const rnd = mulberry32(77);
    const seeds = Array.from({ length: count }, () => ({
      a: rnd() * Math.PI * 2,
      r: radius * (0.35 + rnd() * 0.65),
      y: rnd(),
      s: 0.05 + rnd() * 0.08,
      spin: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(),
      rate: 0.3 + rnd() * 0.8,
      white: rnd() < 0.4,
      scale: 0.45 + rnd() * 0.5,
    }));
    return { geo, seeds };
  }, [count, radius]);

  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const sc = useMemo(() => new THREE.Vector3(), []);
  const colorSet = useRef(false);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    if (!colorSet.current) {
      const pink = new THREE.Color("#D6A7B3"), white = new THREE.Color("#F4EEE7");
      seeds.forEach((s, i) => mesh.setColorAt(i, s.white ? white : pink));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      colorSet.current = true;
    }
    const t = sceneTime.t;
    seeds.forEach((s, i) => {
      const a = s.a + t * s.s;
      const y = ((s.y + t * 0.012 * s.rate) % 1) * height - height / 2;
      p.set(Math.cos(a) * s.r + center[0], y + center[1] + Math.sin(t * s.rate + i) * 0.08, Math.sin(a) * s.r + center[2]);
      q.setFromAxisAngle(s.spin, t * s.rate * 0.6 + i);
      const fade = Math.sin(((s.y + t * 0.012 * s.rate) % 1) * Math.PI);
      sc.setScalar(s.scale * (0.3 + 0.7 * fade));
      m.compose(p, q, sc);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={ref} args={[geo, mats.white, count]} frustumCulled={false} />;
}
