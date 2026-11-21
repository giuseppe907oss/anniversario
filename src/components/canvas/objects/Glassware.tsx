"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { useUI, type Tier } from "@/lib/store";
import { NOISE } from "../shaders/common";
import { sceneTime } from "../clock";

/* ------------------------------------------------------------------ */
/*  Vetro: trasmissione fisica reale sui dispositivi capaci,            */
/*  vetro "fresnel" trasparente su quelli più deboli.                   */
/* ------------------------------------------------------------------ */

export function makeGlassMaterial(tier: Tier) {
  if (tier === "low") {
    return new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      roughness: 0.04,
      metalness: 0,
      transparent: true,
      opacity: 0.22,
      envMapIntensity: 1.6,
      clearcoat: 1,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }
  return new THREE.MeshPhysicalMaterial({
    color: "#ffffff",
    roughness: 0.035,
    metalness: 0,
    transmission: 1,
    thickness: 0.08,
    ior: 1.5,
    envMapIntensity: 1.4,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    specularIntensity: 1,
    attenuationColor: new THREE.Color("#f6fbff"),
    attenuationDistance: 2,
    side: THREE.DoubleSide,
  });
}

const lathe = (pts: [number, number][], seg = 40) =>
  new THREE.LatheGeometry(
    pts.map(([r, y]) => new THREE.Vector2(r, y)),
    seg,
  );

/** Calice "ballon" da Spritz. */
const BALLOON: [number, number][] = [
  [0.0, 0.0], [0.27, 0.0], [0.28, 0.012], [0.06, 0.03], [0.026, 0.07], [0.022, 0.5], [0.04, 0.56],
  [0.17, 0.64], [0.3, 0.77], [0.355, 0.92], [0.348, 1.06], [0.31, 1.2], [0.288, 1.29],
];
const BALLOON_LIQUID: [number, number][] = [
  [0.0, 0.585], [0.035, 0.585], [0.16, 0.648], [0.29, 0.775], [0.343, 0.92], [0.338, 1.04], [0.33, 1.075], [0.0, 1.075],
];

/** Calice da vino (tulipano) per il tavolo. */
const TULIP: [number, number][] = [
  [0.0, 0.0], [0.17, 0.0], [0.175, 0.01], [0.04, 0.022], [0.016, 0.05], [0.014, 0.42], [0.03, 0.46],
  [0.13, 0.52], [0.2, 0.62], [0.215, 0.74], [0.2, 0.86], [0.18, 0.95],
];
const TULIP_WINE: [number, number][] = [[0.0, 0.47], [0.03, 0.47], [0.12, 0.525], [0.185, 0.6], [0.195, 0.64], [0.0, 0.64]];

/* ------------------------------------------------------------------ */
/*  Liquido dello Spritz: arancio attraversato dalla luce + bollicine   */
/* ------------------------------------------------------------------ */

function makeLiquidMaterial(colorDeep: string, colorBright: string, bubbles: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(colorDeep) },
      uBright: { value: new THREE.Color(colorBright) },
      uBubbles: { value: bubbles },
      uLight: { value: new THREE.Vector3(-0.4, 0.5, -1).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vLocal;
      void main(){
        vLocal = position;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uBubbles; uniform vec3 uDeep, uBright, uLight;
      varying vec3 vN; varying vec3 vV; varying vec3 vLocal;
      ${NOISE}
      void main(){
        vec3 N = normalize(vN); vec3 V = normalize(vV);
        float ndv = abs(dot(N, V));
        // spessore apparente: più liquido ai bordi → più scuro e saturo
        vec3 col = mix(uDeep, uBright, pow(ndv, 1.4));
        // luce che attraversa il liquido (retroilluminazione)
        float back = pow(max(dot(-V, uLight), 0.0), 3.0);
        col += uBright * back * 0.9;
        // caustiche lente
        float c = fbm(vLocal.xy * 9.0 + vec2(uTime * 0.15, -uTime * 0.1));
        col *= 0.85 + 0.35 * c;
        // bollicine che salgono (coordinate cilindriche)
        float ang = atan(vLocal.z, vLocal.x);
        vec2 buv = vec2(ang * 7.0, vLocal.y * 26.0 - uTime * 1.6);
        vec2 cell = floor(buv);
        float h = hash12(cell);
        vec2 off = vec2(hash12(cell + 3.1), 0.5) - 0.5;
        vec2 f = fract(buv) - 0.5 - off * 0.5;
        float r = length(f * vec2(1.0, 1.4));
        float bub = smoothstep(0.17, 0.12, r) * smoothstep(0.05, 0.11, r) * step(0.72, h);
        col += vec3(1.0, 0.92, 0.75) * bub * uBubbles * 0.9;
        // schiuma/menisco in superficie
        float top = smoothstep(0.03, 0.0, abs(N.y - 1.0));
        col = mix(col, uBright * 1.25 + 0.1, top * 0.5);
        col += vec3(1.0, 0.85, 0.6) * pow(1.0 - ndv, 4.0) * 0.25;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function orangeSliceTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f08a24";
  g.beginPath();
  g.arc(64, 64, 63, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#fff1d8";
  g.beginPath();
  g.arc(64, 64, 55, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 10; i++) {
    const a0 = (i / 10) * Math.PI * 2 + 0.04, a1 = ((i + 1) / 10) * Math.PI * 2 - 0.04;
    g.fillStyle = i % 2 ? "#ffa53a" : "#ff9a2e";
    g.beginPath();
    g.moveTo(64, 64);
    g.arc(64, 64, 51, a0, a1);
    g.closePath();
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------------------------ */
/*  Calice di Aperol Spritz                                             */
/* ------------------------------------------------------------------ */

export function SpritzGlass(props: { position?: [number, number, number]; rotation?: [number, number, number]; seed?: number }) {
  const tier = useUI((s) => s.tier);
  const res = useMemo(() => {
    const glassGeo = lathe(BALLOON, 48);
    glassGeo.computeVertexNormals();
    const liquidGeo = lathe(BALLOON_LIQUID, 40);
    liquidGeo.computeVertexNormals();
    const glass = makeGlassMaterial(tier);
    const liquid = makeLiquidMaterial("#9c2a06", "#ff8a2a", 1);
    const ice = new THREE.MeshPhysicalMaterial({
      color: "#eef6fa",
      roughness: 0.15,
      clearcoat: 1,
      transparent: tier === "low",
      opacity: 0.85,
      emissive: new THREE.Color("#ffb36a"),
      emissiveIntensity: 0.12,
    });
    const iceGeo = new RoundedBoxGeometry(0.17, 0.17, 0.17, 2, 0.035);
    const sliceTex = orangeSliceTexture();
    const slice = [
      new THREE.MeshStandardMaterial({ color: "#e67816", roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ map: sliceTex, roughness: 0.5, emissive: new THREE.Color("#ff8a2a"), emissiveIntensity: 0.25 }),
      new THREE.MeshStandardMaterial({ map: sliceTex, roughness: 0.5, emissive: new THREE.Color("#ff8a2a"), emissiveIntensity: 0.25 }),
    ];
    return { glassGeo, liquidGeo, glass, liquid, ice, iceGeo, slice };
  }, [tier]);

  useFrame(() => {
    res.liquid.uniforms.uTime.value = sceneTime.t + (props.seed ?? 0) * 3.3;
  });

  return (
    <group {...props}>
      <mesh geometry={res.liquidGeo} material={res.liquid} />
      <mesh geometry={res.iceGeo} material={res.ice} position={[-0.1, 1.05, 0.04]} rotation={[0.3, 0.5, 0.1]} />
      <mesh geometry={res.iceGeo} material={res.ice} position={[0.09, 1.04, -0.08]} rotation={[0.7, 0.2, 0.4]} />
      <mesh geometry={res.iceGeo} material={res.ice} position={[0.02, 1.02, 0.13]} rotation={[0.1, 0.9, 0.6]} scale={0.85} />
      <mesh position={[0.16, 1.08, 0.12]} rotation={[Math.PI / 2, 0.15, 0.9]} material={res.slice}>
        <cylinderGeometry args={[0.15, 0.15, 0.025, 32]} />
      </mesh>
      <mesh geometry={res.glassGeo} material={res.glass} renderOrder={3} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Calice da vino con un dito di rosso                                 */
/* ------------------------------------------------------------------ */

export function WineGlass(props: { position?: [number, number, number]; rotation?: [number, number, number]; scale?: number }) {
  const tier = useUI((s) => s.tier);
  const res = useMemo(() => {
    const g = lathe(TULIP, 40);
    g.computeVertexNormals();
    const w = lathe(TULIP_WINE, 32);
    w.computeVertexNormals();
    return { g, w, glass: makeGlassMaterial(tier), wine: makeLiquidMaterial("#2a0610", "#8a1e34", 0) };
  }, [tier]);
  return (
    <group {...props}>
      <mesh geometry={res.w} material={res.wine} />
      <mesh geometry={res.g} material={res.glass} renderOrder={3} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Fiamma di candela (billboard con shader)                            */
/* ------------------------------------------------------------------ */

export function CandleFlame({ position = [0, 0, 0] as [number, number, number], scale = 1 }) {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main(){
            vUv = uv;
            vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            vec2 s = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
            mv.xy += position.xy * s;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime; varying vec2 vUv;
          ${NOISE}
          void main(){
            vec2 p = vUv - vec2(0.5, 0.22);
            float flick = vnoise(vec2(uTime * 6.0, 1.0)) * 0.12;
            p.x += sin(uTime * 3.0 + p.y * 6.0) * 0.02 * p.y * 3.0 + (flick - 0.06) * p.y;
            float w = mix(0.2, 0.02, clamp(p.y / 0.7, 0.0, 1.0));
            float body = smoothstep(w, 0.0, abs(p.x)) * smoothstep(-0.12, 0.02, p.y) * smoothstep(0.75 - flick, 0.15, p.y);
            float core = smoothstep(0.08, 0.0, length(p * vec2(1.6, 0.9) - vec2(0.0, 0.04)));
            vec3 col = mix(vec3(1.0, 0.45, 0.12), vec3(1.0, 0.86, 0.55), body) * body * 1.4 + vec3(0.6, 0.7, 1.0) * core * 0.35;
            float halo = exp(-dot(p, p) * 18.0) * 0.25;
            col += vec3(1.0, 0.6, 0.3) * halo;
            gl_FragColor = vec4(col, max(body, halo));
          }`,
      }),
    [],
  );
  useFrame(() => {
    mat.uniforms.uTime.value = sceneTime.t;
  });
  return (
    <mesh ref={ref} position={position} scale={scale} material={mat} renderOrder={10} frustumCulled={false}>
      <planeGeometry args={[0.3, 0.5]} />
    </mesh>
  );
}
