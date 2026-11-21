"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { NOISE, SKY_FN } from "../shaders/common";
import { sceneTime } from "../clock";
import type { SharedSkyUniforms } from "./LakeWater";
import { mulberry32 } from "@/lib/noise";

/* ------------------------------------------------------------------ */
/*  Cielo: tramonto → notte, nuvole sottili, stelle                     */
/* ------------------------------------------------------------------ */

export function SkyDome({ sky, radius = 450 }: { sky: SharedSkyUniforms; radius?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { uNight: sky.uNight, uSunDir: sky.uSunDir, uTime: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main(){
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          varying vec3 vDir;
          ${NOISE}
          ${SKY_FN}
          void main(){
            vec3 d = normalize(vDir);
            vec3 col = skyColor(d);
            // nuvole stratificate, illuminate dal basso dal tramonto
            vec2 cuv = d.xz / (d.y + 0.12);
            float n = fbm(cuv * vec2(0.55, 1.9) + vec2(uTime * 0.004, 0.0));
            float band = smoothstep(0.03, 0.2, d.y) * smoothstep(0.65, 0.18, d.y);
            float cl = smoothstep(0.5, 0.82, n) * band;
            float sunSide = pow(max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0), 3.0);
            vec3 lit = mix(vec3(0.55, 0.26, 0.32), vec3(1.0, 0.62, 0.42), sunSide);
            vec3 cloudCol = mix(lit * 0.9, vec3(0.035, 0.035, 0.06), uNight);
            col = mix(col, cloudCol, cl * 0.75);
            // stelle
            vec2 suv = vec2(atan(d.z, d.x) * 2.0, asin(clamp(d.y, -1.0, 1.0)) * 2.2) * 70.0;
            vec2 cell = floor(suv);
            vec2 f = fract(suv) - 0.5;
            float h = hash12(cell);
            vec2 off = vec2(hash12(cell + 7.1), hash12(cell + 3.7)) - 0.5;
            float star = smoothstep(0.09, 0.0, length(f - off * 0.6)) * step(0.985, h);
            float tw = 0.6 + 0.4 * sin(uTime * (1.0 + h * 4.0) + h * 60.0);
            col += vec3(0.95, 0.9, 1.0) * star * tw * smoothstep(0.35, 0.9, uNight) * smoothstep(0.05, 0.3, d.y) * (1.0 - cl);
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    [sky],
  );

  useFrame(({ camera }) => {
    mat.uniforms.uTime.value = sceneTime.t;
    ref.current?.position.copy(camera.position);
  });

  return (
    <mesh ref={ref} material={mat} frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[radius, 48, 24]} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Foschia: piani con rumore fbm che scorrono lentamente               */
/* ------------------------------------------------------------------ */

export function MistLayer({
  position,
  scale,
  color = "#b79aa6",
  opacity = 0.35,
  speed = 0.01,
  seed = 1,
}: {
  position: [number, number, number];
  scale: [number, number];
  color?: THREE.ColorRepresentation;
  opacity?: number;
  speed?: number;
  seed?: number;
}) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: opacity },
          uSpeed: { value: speed },
          uSeed: { value: seed },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime, uOpacity, uSpeed, uSeed;
          uniform vec3 uColor;
          varying vec2 vUv;
          ${NOISE}
          void main(){
            vec2 p = vUv * vec2(5.0, 1.4) + vec2(uTime * uSpeed + uSeed * 13.0, uSeed);
            float n = fbm(p + fbm(p * 0.7 + uTime * 0.01));
            float v = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.25, vUv.y);
            float h = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
            float a = smoothstep(0.35, 0.85, n) * v * h * uOpacity;
            gl_FragColor = vec4(uColor, a);
            #include <colorspace_fragment>
          }`,
      }),
    [color, opacity, speed, seed],
  );
  useFrame(() => {
    mat.uniforms.uTime.value = sceneTime.t;
  });
  return (
    <mesh position={position} material={mat} renderOrder={5}>
      <planeGeometry args={[scale[0], scale[1]]} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Particelle "bokeh": pulviscolo luminoso con finta profondità di     */
/*  campo (dimensione e morbidezza crescono lontano dal piano a fuoco). */
/* ------------------------------------------------------------------ */

export function BokehDust({
  count = 220,
  box = [30, 14, 40],
  center = [0, 4, 0],
  color = "#D8BC8A",
  size = 26,
  focus = 8,
  opacity = 0.7,
  rise = 0.15,
  seed = 7,
  follow = false,
}: {
  count?: number;
  box?: [number, number, number];
  center?: [number, number, number];
  color?: THREE.ColorRepresentation;
  size?: number;
  focus?: number;
  opacity?: number;
  rise?: number;
  seed?: number;
  /** Il volume di particelle segue la camera restando fermo nel mondo. */
  follow?: boolean;
}) {
  const dpr = useThree((s) => s.viewport.dpr);
  const ref = useRef<THREE.Points>(null);
  const { geo, mat } = useMemo(() => {
    const rnd = mulberry32(seed);
    const pos = new Float32Array(count * 3);
    const rand = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() - 0.5) * box[0];
      pos[i * 3 + 1] = (rnd() - 0.5) * box[1];
      pos[i * 3 + 2] = (rnd() - 0.5) * box[2];
      rand[i] = rnd();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uSize: { value: size },
        uFocus: { value: focus },
        uOpacity: { value: opacity },
        uBox: { value: new THREE.Vector3(...box) },
        uRise: { value: rise },
        uDpr: { value: 1 },
        uOrigin: { value: new THREE.Vector3(...center) },
      },
      vertexShader: /* glsl */ `
        uniform float uTime, uSize, uFocus, uRise, uDpr;
        uniform vec3 uBox, uOrigin;
        attribute float aRand;
        varying float vBlur;
        varying float vA;
        void main(){
          vec3 p = position;
          p.y += uTime * uRise * (0.4 + aRand);
          p.x += sin(uTime * 0.2 + aRand * 30.0) * 0.6;
          p.z += cos(uTime * 0.17 + aRand * 20.0) * 0.6;
          p = mod(p - uOrigin + uBox * 0.5, uBox) - uBox * 0.5;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float depth = -mv.z;
          vBlur = clamp(abs(depth - uFocus) / (uFocus * 0.9), 0.0, 1.0);
          float edge = smoothstep(0.5, 0.35, abs(p.y / uBox.y));
          vA = (0.35 + 0.65 * aRand) * edge * smoothstep(0.3, 1.5, depth);
          gl_PointSize = uSize * (0.35 + aRand * 0.65) * (1.0 + vBlur * 2.2) * uDpr / max(depth, 0.5);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vBlur;
        varying float vA;
        void main(){
          float r = length(gl_PointCoord - 0.5) * 2.0;
          float sharp = smoothstep(1.0, 0.0, r);
          sharp *= sharp;
          float disc = smoothstep(1.0, 0.82, r) * (0.55 + 0.45 * smoothstep(0.4, 0.95, r));
          float a = mix(sharp, disc * 0.35, vBlur) * vA * uOpacity;
          gl_FragColor = vec4(uColor * a, a);
        }`,
    });
    return { geo, mat };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, color, size, focus, opacity, rise, seed]);

  useFrame(({ camera }) => {
    mat.uniforms.uTime.value = sceneTime.t;
    mat.uniforms.uDpr.value = dpr;
    if (follow && ref.current) {
      ref.current.position.set(camera.position.x + center[0], camera.position.y + center[1], camera.position.z + center[2]);
    }
    if (ref.current) mat.uniforms.uOrigin.value.copy(ref.current.position);
  });

  return <points ref={ref} geometry={geo} material={mat} position={center} frustumCulled={false} renderOrder={8} />;
}

/* ------------------------------------------------------------------ */
/*  Fondale sferico a gradiente per le scene "da studio"                */
/* ------------------------------------------------------------------ */

export const backdropUniforms = () => ({
  uTop: { value: new THREE.Color("#0b0a10") },
  uMid: { value: new THREE.Color("#1a0f17") },
  uBottom: { value: new THREE.Color("#050507") },
  uGlow: { value: new THREE.Color("#551E32") },
  uGlowDir: { value: new THREE.Vector3(0, 0.15, -1).normalize() },
  uGlowPower: { value: 3.0 },
  uGlowAmount: { value: 0.9 },
  uTime: { value: 0 },
  uStars: { value: 0 },
});

export type BackdropUniforms = ReturnType<typeof backdropUniforms>;

export function Backdrop({ uniforms, radius = 300 }: { uniforms: BackdropUniforms; radius?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms,
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main(){
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uTop, uMid, uBottom, uGlow, uGlowDir;
          uniform float uGlowPower, uGlowAmount, uTime, uStars;
          varying vec3 vDir;
          ${NOISE}
          void main(){
            vec3 d = normalize(vDir);
            vec3 col = mix(uMid, uTop, smoothstep(0.0, 0.7, d.y));
            col = mix(col, uBottom, smoothstep(0.0, -0.5, d.y));
            float g = pow(max(dot(d, normalize(uGlowDir)), 0.0), uGlowPower);
            col += uGlow * g * uGlowAmount;
            // velature lentissime
            float n = fbm(d.xz * 2.0 / (abs(d.y) + 0.6) + uTime * 0.01);
            col *= 0.88 + 0.24 * n;
            vec2 suv = vec2(atan(d.z, d.x) * 2.0, asin(clamp(d.y, -1.0, 1.0)) * 2.2) * 60.0;
            vec2 cell = floor(suv);
            float h = hash12(cell);
            vec2 off = vec2(hash12(cell + 7.1), hash12(cell + 3.7)) - 0.5;
            float star = smoothstep(0.1, 0.0, length(fract(suv) - 0.5 - off * 0.6)) * step(0.988, h);
            col += vec3(1.0, 0.92, 0.85) * star * uStars * (0.6 + 0.4 * sin(uTime * 1.3 + h * 50.0)) * smoothstep(-0.05, 0.3, d.y);
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    [uniforms],
  );
  useFrame(({ camera }) => {
    uniforms.uTime.value = sceneTime.t;
    ref.current?.position.copy(camera.position);
  });
  return (
    <mesh ref={ref} material={mat} frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[radius, 32, 16]} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Alone luminoso (sprite additivo) — "bloom" economico                */
/* ------------------------------------------------------------------ */

const glowTexture = (() => {
  let tex: THREE.Texture | null = null;
  return () => {
    if (tex) return tex;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.18, "rgba(255,255,255,0.55)");
    grd.addColorStop(0.45, "rgba(255,255,255,0.12)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
})();

export function Glow({
  position,
  color = "#ffc98a",
  scale = 1,
  opacity = 1,
}: {
  position: [number, number, number];
  color?: THREE.ColorRepresentation;
  scale?: number;
  opacity?: number;
}) {
  const map = useMemo(() => glowTexture(), []);
  return (
    <sprite position={position} scale={[scale, scale, scale]} renderOrder={9}>
      <spriteMaterial
        map={map}
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        fog={false}
      />
    </sprite>
  );
}

/* ------------------------------------------------------------------ */
/*  Ombra di contatto finta (gradiente radiale): costo quasi nullo      */
/* ------------------------------------------------------------------ */

const shadowTexture = (() => {
  let tex: THREE.Texture | null = null;
  return () => {
    if (tex) return tex;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(0,0,0,0.85)");
    grd.addColorStop(0.5, "rgba(0,0,0,0.4)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    tex = new THREE.CanvasTexture(c);
    return tex;
  };
})();

export function SoftShadow({
  position,
  scale = 1,
  opacity = 0.6,
}: {
  position: [number, number, number];
  scale?: number | [number, number];
  opacity?: number;
}) {
  const map = useMemo(() => shadowTexture(), []);
  const s = Array.isArray(scale) ? scale : [scale, scale];
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} scale={[s[0], s[1], 1]} renderOrder={1}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={map} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}
