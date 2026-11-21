"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import route from "@/data/route.json";
import { PLACES } from "@/lib/content";
import { mulberry32 } from "@/lib/noise";
import { sceneTime } from "../clock";
import { Glow } from "./Atmosphere";
import { Label } from "./Label";
import { LightShaft } from "./LightShaft";

/**
 * Mappa 3D STILIZZATA di Como (decorativa).
 * Le posizioni delle tappe e il tracciato del percorso derivano da dati reali
 * (OpenStreetMap / OSRM) proiettati in scala; edifici e riva sono un'interpretazione.
 */
const LAT0 = 45.8112;
const LNG0 = 9.0812;
const M_PER_UNIT = 150;
export const project = (lat: number, lng: number): [number, number] => [
  ((lng - LNG0) * 111320 * Math.cos((LAT0 * Math.PI) / 180)) / M_PER_UNIT,
  (-(lat - LAT0) * 110540) / M_PER_UNIT,
];

// Riva del lago: linea stilizzata che passa vicino a Tempio Voltiano e Piazza Cavour
const SHORE: [number, number][] = [
  [45.8172, 9.0655],
  [45.8158, 9.0725],
  [45.8152, 9.0752],
  [45.8146, 9.0778],
  [45.8139, 9.0800],
  [45.8137, 9.0822],
  [45.8141, 9.0845],
  [45.8152, 9.0868],
  [45.8172, 9.0895],
  [45.8195, 9.0925],
];

function pointInPoly(x: number, z: number, poly: [number, number][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function distToSeg(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz || 1e-6;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  const qx = ax + t * dx - px, qz = az + t * dz - pz;
  return Math.sqrt(qx * qx + qz * qz);
}

export function ComoMap({ reveal }: { reveal?: { current: number } }) {
  const pulse = useRef<THREE.Mesh>(null);

  const data = useMemo(() => {
    const shore = SHORE.map(([la, ln]) => project(la, ln));
    const lakePoly: [number, number][] = [...shore, [shore[shore.length - 1][0], -12], [shore[0][0], -12]];

    // percorso reale (tutte le tratte concatenate)
    const pts: THREE.Vector3[] = [];
    (route.legs as unknown as { coordinates: [number, number][] }[]).forEach((leg) =>
      leg.coordinates.forEach(([la, ln]) => {
        const [x, z] = project(la, ln);
        const last = pts[pts.length - 1];
        if (!last || Math.hypot(last.x - x, last.z - z) > 0.01) pts.push(new THREE.Vector3(x, 0.05, z));
      }),
    );
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.1);
    const tube = new THREE.TubeGeometry(curve, Math.min(900, pts.length * 4), 0.018, 6, false);

    // edifici: griglia irregolare, esclusi lago, piazze e il tracciato
    const rnd = mulberry32(11);
    const stops = Object.values(PLACES).map((p) => project(p.lat, p.lng));
    const blocks: { x: number; z: number; w: number; d: number; h: number; old: boolean }[] = [];
    const step = 0.2;
    for (let gx = -6.5; gx <= 6.5; gx += step) {
      for (let gz = -4.5; gz <= 4.8; gz += step) {
        const x = gx + (rnd() - 0.5) * 0.06, z = gz + (rnd() - 0.5) * 0.06;
        const r = Math.hypot(x * 0.8, z);
        if (r > 6 + rnd() * 0.8) continue;
        if (pointInPoly(x, z, lakePoly)) continue;
        if (stops.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 0.26)) continue;
        let near = Infinity;
        for (let i = 0; i < pts.length - 1; i += 1) {
          const d = distToSeg(x, z, pts[i].x, pts[i].z, pts[i + 1].x, pts[i + 1].z);
          if (d < near) near = d;
          if (near < 0.1) break;
        }
        if (near < 0.1) continue;
        if (rnd() < 0.12) continue;
        const old = Math.abs(x - 0.2) < 2.2 && z > -1.2 && z < 2.8;
        blocks.push({
          x,
          z,
          w: step * (0.55 + rnd() * 0.35),
          d: step * (0.55 + rnd() * 0.35),
          h: (old ? 0.08 + rnd() * 0.14 : 0.05 + rnd() * 0.22) * (1 - Math.min(r / 9, 0.6)),
          old,
        });
      }
    }

    // forma del lago
    const shape = new THREE.Shape();
    lakePoly.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
    const lakeGeo = new THREE.ShapeGeometry(shape, 12);
    lakeGeo.rotateX(-Math.PI / 2);

    const shoreCurve = new THREE.CatmullRomCurve3(shore.map(([x, z]) => new THREE.Vector3(x, 0.012, z)));
    const shoreGeo = new THREE.TubeGeometry(shoreCurve, 120, 0.008, 4, false);

    return { tube, blocks, lakeGeo, shoreGeo, length: curve.getLength() };
  }, []);

  const blockRef = (mesh: THREE.InstancedMesh | null) => {
    if (!mesh || mesh.userData.done) return;
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    data.blocks.forEach((b, i) => {
      m.makeScale(b.w, b.h, b.d);
      m.setPosition(b.x, b.h / 2, b.z);
      mesh.setMatrixAt(i, m);
      col.set(b.old ? "#3a3036" : "#22212b").multiplyScalar(0.8 + Math.random() * 0.4);
      mesh.setColorAt(i, col);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.userData.done = true;
  };

  const routeShader = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
        uniforms: { uTime: { value: 0 }, uReveal: { value: 1 }, uColor: { value: new THREE.Color("#ffd49a") } },
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime, uReveal; uniform vec3 uColor; varying vec2 vUv;
          void main(){
            float shown = step(vUv.x, uReveal);
            float flow = 0.55 + 0.45 * smoothstep(0.6, 1.0, sin((vUv.x * 60.0 - uTime * 1.6)));
            float head = smoothstep(0.03, 0.0, abs(vUv.x - uReveal)) * 2.0;
            float a = shown * flow + head;
            gl_FragColor = vec4(uColor * a * 1.6, a);
          }`,
      }),
    [],
  );

  const [vx, vz] = project(PLACES.valduce.lat, PLACES.valduce.lng);
  const [dx, dz] = project(PLACES.duomo.lat, PLACES.duomo.lng);
  const [lx, lz] = project(45.8168, 9.079);

  useFrame(() => {
    routeShader.uniforms.uTime.value = sceneTime.t;
    routeShader.uniforms.uReveal.value = reveal ? THREE.MathUtils.lerp(0.04, 1, THREE.MathUtils.smoothstep(reveal.current * 1.15, 0, 1)) : 1;
    if (pulse.current) {
      const k = (sceneTime.t * 0.6) % 1;
      pulse.current.scale.setScalar(0.2 + k * 0.9);
      (pulse.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.8;
    }
  });

  return (
    <group>
      {/* base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[7.5, 64]} />
        <meshStandardMaterial color="#111018" roughness={0.9} />
      </mesh>
      {/* lago */}
      <mesh geometry={data.lakeGeo} position={[0, 0.004, 0]}>
        <meshStandardMaterial color="#0d1a2c" roughness={0.18} metalness={0.4} emissive="#0a1a33" emissiveIntensity={0.5} />
      </mesh>
      <mesh geometry={data.shoreGeo}>
        <meshBasicMaterial color="#D8BC8A" transparent opacity={0.55} />
      </mesh>
      <instancedMesh ref={blockRef} args={[undefined, undefined, data.blocks.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.75} emissive="#2a1a12" emissiveIntensity={0.25} />
      </instancedMesh>
      <mesh geometry={data.tube} material={routeShader} renderOrder={4} />
      {/* tappe */}
      {Object.values(PLACES).map((p) => {
        const [x, z] = project(p.lat, p.lng);
        return (
          <group key={p.id} position={[x, 0.06, z]}>
            <mesh>
              <sphereGeometry args={[0.035, 12, 8]} />
              <meshBasicMaterial color="#F4EEE7" />
            </mesh>
            <Glow position={[0, 0, 0]} color="#ffcf8f" scale={0.35} opacity={0.8} />
          </group>
        );
      })}
      {/* parcheggio: faro pulsante */}
      <group position={[vx, 0.06, vz]}>
        <mesh>
          <sphereGeometry args={[0.07, 16, 12]} />
          <meshBasicMaterial color="#fff2da" />
        </mesh>
        <Glow position={[0, 0, 0]} color="#ffc070" scale={1.1} />
        <mesh ref={pulse} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.45, 0.5, 48]} />
          <meshBasicMaterial color="#ffd49a" transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
        <LightShaft position={[0, 1.2, 0]} height={2.4} radiusTop={0.03} radiusBottom={0.18} opacity={0.5} color="#ffd49a" />
        <Label text="Autosilo Valduce" position={[0.15, 0.5, 0]} size={0.16} />
      </group>
      <Label text="Duomo" position={[dx, 0.42, dz]} size={0.13} opacity={0.75} />
      <Label text="Lago di Como" position={[lx, 0.25, lz]} size={0.2} color="#D8BC8A" opacity={0.8} />
    </group>
  );
}
