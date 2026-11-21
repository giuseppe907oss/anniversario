"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { NOISE, SKY_FN } from "../shaders/common";
import { sceneTime } from "../clock";
import type { SharedSkyUniforms } from "./LakeWater";
import { fbm, mulberry32, ridged } from "@/lib/noise";

/* ------------------------------------------------------------------ */
/*  Geografia stilizzata di un lago prealpino (non una mappa reale).    */
/* ------------------------------------------------------------------ */

export const CITY_Z = -232;
export const shoreL = (z: number) => -24 - 7 * Math.sin(z * 0.021 + 0.4) - 3 * Math.sin(z * 0.057);
export const shoreR = (z: number) => 22 + 8 * Math.sin(z * 0.017 + 1.3) + 3 * Math.sin(z * 0.049 + 2);

/** Distanza (positiva = terraferma) dalla riva più vicina. */
function landDistance(x: number, z: number) {
  let d = Math.max(shoreL(z) - x, x - shoreR(z));
  d = Math.max(d, CITY_Z - z);
  return d;
}

export function terrainHeight(x: number, z: number) {
  const d = landDistance(x, z);
  if (d < 0) return -3 + d * 0.05;
  const near = Math.min(d, 6) * 0.35;
  const rise = Math.pow(THREE.MathUtils.smoothstep(d, 2, 70), 1.15);
  const r = ridged(x * 0.011 + 3.1, z * 0.009 - 1.7, 11);
  const f = fbm(x * 0.03, z * 0.03, 5);
  let h = near + rise * (22 + 78 * r) + f * 6 * rise;
  // la città è in piano: abbassiamo il fondovalle dietro la riva
  const cityMask =
    (1 - THREE.MathUtils.smoothstep(Math.abs(x), 26, 58)) *
    THREE.MathUtils.smoothstep(z, CITY_Z - 80, CITY_Z - 48) *
    (1 - THREE.MathUtils.smoothstep(z, CITY_Z + 10, CITY_Z + 40));
  h = THREE.MathUtils.lerp(h, near + f * 2.5, cityMask);
  // Alpi lontane
  const far = THREE.MathUtils.smoothstep(-z, 300, 420);
  h += far * (60 + 90 * ridged(x * 0.006, z * 0.006, 23));
  return h;
}

export function Terrain({ sky }: { sky: SharedSkyUniforms }) {
  const { geo, mat } = useMemo(() => {
    const W = 420, D = 560, SX = 150, SZ = 170;
    const geo = new THREE.PlaneGeometry(W, D, SX, SZ);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, -D / 2 + 90);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, terrainHeight(x, z));
    }
    geo.computeVertexNormals();
    const mat = new THREE.ShaderMaterial({
      fog: false,
      uniforms: { uNight: sky.uNight, uSunDir: sky.uSunDir, uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vWorld; varying vec3 vN;
        void main(){
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz; vN = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vWorld; varying vec3 vN;
        ${NOISE}
        ${SKY_FN}
        void main(){
          vec3 N = normalize(vN);
          vec3 V = vWorld - cameraPosition;
          float dist = length(V);
          vec3 base = mix(vec3(0.035, 0.032, 0.05), vec3(0.012, 0.012, 0.022), uNight);
          // boschi: variazione sottile
          base *= 0.75 + 0.5 * vnoise(vWorld.xz * 0.35);
          // luce radente del tramonto sui versanti esposti
          float rim = pow(max(dot(N, normalize(vec3(uSunDir.x, 0.35, uSunDir.z))), 0.0), 2.0);
          vec3 rimCol = mix(vec3(0.75, 0.36, 0.3), vec3(0.06, 0.06, 0.12), uNight);
          vec3 col = base + rimCol * rim * 0.35;
          // neve sulle cime con "enrosadira" (alpenglow)
          float snowLine = 95.0 + vnoise(vWorld.xz * 0.05) * 25.0;
          float snow = smoothstep(snowLine - 8.0, snowLine + 10.0, vWorld.y) * smoothstep(0.45, 0.85, N.y);
          vec3 snowCol = mix(vec3(0.62, 0.42, 0.42), vec3(0.1, 0.11, 0.16), uNight);
          col = mix(col, snowCol * (0.45 + 0.55 * rim), snow * 0.85);
          // prospettiva aerea: la foschia prende il colore del cielo all'orizzonte
          vec3 hazeDir = normalize(vec3(V.x, max(V.y, 0.0) * 0.15 + 0.03, V.z));
          vec3 haze = skyColor(hazeDir);
          float lowMist = exp(-max(vWorld.y, 0.0) * 0.035);
          float h = 1.0 - exp(-dist * (0.0017 + lowMist * 0.0018));
          col = mix(col, haze * 0.62, clamp(h, 0.0, 0.88));
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    return { geo, mat };
  }, [sky]);

  return <mesh geometry={geo} material={mat} />;
}

/* ------------------------------------------------------------------ */
/*  Luci della costa: si accendono una a una con il calare della notte  */
/* ------------------------------------------------------------------ */

/** Campo di luci puntiformi (lampioni, finestre): si accendono con uNight. */
export interface LightData {
  positions: number[];
  sizes: number[];
  seeds: number[];
  ons: number[];
  colors: number[];
}

export function LightPoints({
  data,
  night,
  brightness = 1,
  sizeScale = 1,
}: {
  data: LightData;
  night: { value: number };
  brightness?: number;
  sizeScale?: number;
}) {
  const dpr = useThree((s) => s.viewport.dpr);
  const { geo, mat } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
    geo.setAttribute("aSize", new THREE.Float32BufferAttribute(data.sizes, 1));
    geo.setAttribute("aSeed", new THREE.Float32BufferAttribute(data.seeds, 1));
    geo.setAttribute("aOn", new THREE.Float32BufferAttribute(data.ons, 1));
    geo.setAttribute("aColor", new THREE.Float32BufferAttribute(data.colors, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      uniforms: { uNight: night, uTime: { value: 0 }, uDpr: { value: 1 }, uBright: { value: brightness }, uSizeScale: { value: sizeScale } },
      vertexShader: /* glsl */ `
        uniform float uNight, uTime, uDpr, uSizeScale;
        attribute float aSize, aSeed, aOn;
        attribute vec3 aColor;
        varying vec3 vColor; varying float vA;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float on = smoothstep(aOn, aOn + 0.12, uNight + 0.05);
          float tw = 0.82 + 0.18 * sin(uTime * (1.2 + aSeed * 3.0) + aSeed * 40.0);
          float depth = -mv.z;
          vA = on * tw * (0.55 + 0.45 * exp(-depth * 0.004));
          gl_PointSize = clamp(aSize * 70.0 * uSizeScale / depth, 1.6, 30.0) * uDpr;
          vColor = aColor;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uBright;
        varying vec3 vColor; varying float vA;
        void main(){
          float r = length(gl_PointCoord - 0.5) * 2.0;
          float core = smoothstep(0.32, 0.0, r);
          float halo = exp(-r * r * 5.0) * 0.45;
          float a = (core + halo) * vA;
          gl_FragColor = vec4(vColor * (core * 2.2 + halo) * vA * uBright, a);
        }`,
    });
    return { geo, mat };
  }, [data, night, brightness, sizeScale]);

  useFrame(() => {
    mat.uniforms.uTime.value = sceneTime.t;
    mat.uniforms.uDpr.value = dpr;
  });

  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={6} />;
}

export function makeLightData(): LightData & { push: (x: number, y: number, z: number, size: number, on: number, rnd: () => number) => void } {
  const warm = [new THREE.Color("#ffd29a"), new THREE.Color("#ffb76b"), new THREE.Color("#fff1d6"), new THREE.Color("#ffc4a0")];
  const d: LightData = { positions: [], sizes: [], seeds: [], ons: [], colors: [] };
  return {
    ...d,
    push(x, y, z, size, on, rnd) {
      this.positions.push(x, y, z);
      this.sizes.push(size);
      this.seeds.push(rnd());
      this.ons.push(on);
      const c = warm[Math.floor(rnd() * warm.length)];
      this.colors.push(c.r, c.g, c.b);
    },
  };
}

export function ShoreLights({ sky, density = 1 }: { sky: SharedSkyUniforms; density?: number }) {
  const data = useMemo(() => {
    const rnd = mulberry32(42);
    const L = makeLightData();
    const push = (x: number, y: number, z: number, size: number, on: number) => L.push(x, y, z, size, on, rnd);
    const n = (k: number) => Math.round(k * density);
    // lungolago: due file lungo le rive
    for (let i = 0; i < n(260); i++) {
      const z = 40 - rnd() * 280;
      const left = rnd() < 0.5;
      const x = left ? shoreL(z) - 1.2 - rnd() * 2 : shoreR(z) + 1.2 + rnd() * 2;
      const pz = z + (rnd() - 0.5) * 2;
      if (rnd() < 0.26) continue;
      push(x, terrainHeight(x, pz) + 0.6, pz, 1.4 + rnd() * 1.6, 0.1 + rnd() * 0.5);
    }
    // borghi sui versanti
    for (let i = 0; i < n(420); i++) {
      const z = 30 - rnd() * 300;
      const left = rnd() < 0.5;
      const d = 3 + Math.pow(rnd(), 1.8) * 55;
      const x = left ? shoreL(z) - d : shoreR(z) + d;
      const h = terrainHeight(x, z);
      if (h > 70) continue;
      if (fbm(x * 0.05, z * 0.05, 3) < 0.48) continue;
      push(x, h + 0.4, z, 1 + rnd() * 1.4, 0.2 + rnd() * 0.6);
    }
    // la città in fondo al lago
    for (let i = 0; i < n(520); i++) {
      const x = (rnd() - 0.5) * 90 * (0.4 + rnd() * 0.6);
      const z = CITY_Z - 2 - Math.pow(rnd(), 1.4) * 45;
      const h = terrainHeight(x, z);
      if (h > 40) continue;
      push(x, h + 0.5 + rnd() * 1.5, z, 1.2 + rnd() * 2, 0.05 + rnd() * 0.45);
    }
    // collina sopra la città (luci sparse in quota)
    for (let i = 0; i < n(120); i++) {
      const x = 25 + rnd() * 30;
      const z = CITY_Z + 10 - rnd() * 40;
      push(x, terrainHeight(x, z) + 0.4, z, 1 + rnd(), 0.35 + rnd() * 0.5);
    }
    return { positions: L.positions, sizes: L.sizes, seeds: L.seeds, ons: L.ons, colors: L.colors };
  }, [density]);

  return <LightPoints data={data} night={sky.uNight} />;
}
