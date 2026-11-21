"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { scrollState } from "@/lib/scroll";
import { STAGES } from "@/lib/content";
import { useUI } from "@/lib/store";
import { PARTICLE_SCALE } from "@/lib/device";
import { getAudio } from "@/lib/audio";
import { mulberry32 } from "@/lib/noise";
import { sceneTime } from "../clock";
import { easeInOut, placeCamera, portraitFactor, rig, smooth } from "../rig";
import { Backdrop, BokehDust, Glow, MistLayer, SoftShadow, backdropUniforms } from "../objects/Atmosphere";
import { Bouquet, FloatingPetals } from "../objects/Flowers";
import { ComoMap } from "../objects/ComoMap";
import { DuomoStylized, LampPosts, TempioStylized } from "../objects/Architecture";
import { SpritzGlass } from "../objects/Glassware";
import { DinnerTable } from "../objects/DinnerTable";
import { LakeWater, type SharedSkyUniforms } from "../objects/LakeWater";
import { LightPoints, makeLightData } from "../objects/Landscape";

const N = STAGES.length;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Ancore delle tappe nel "mondo" della timeline: un percorso curvo. */
const ANCHORS = [V(0, 0, 0), V(30, -2, -34), V(0, 0, -74), V(-30, 1, -112), V(0, -1, -156), V(30, 0, -198)];

/* ------------------------------------------------------------------ */
/*  Palette per ora del giorno                                          */
/* ------------------------------------------------------------------ */

interface Palette {
  top: string; mid: string; bottom: string; glow: string; glowAmt: number; stars: number;
  fog: string; fogD: number; hemiSky: string; hemiGround: string; hemi: number; exposure: number;
}
const PALETTES: Palette[] = [
  { top: "#141018", mid: "#2a1c1e", bottom: "#080708", glow: "#9a5a32", glowAmt: 0.32, stars: 0, fog: "#26181b", fogD: 0.03, hemiSky: "#ffd7b0", hemiGround: "#2a1810", hemi: 0.6, exposure: 1.1 },
  { top: "#121120", mid: "#2a1b24", bottom: "#08070a", glow: "#a85a40", glowAmt: 0.32, stars: 0.05, fog: "#22161e", fogD: 0.022, hemiSky: "#f4b28a", hemiGround: "#1a1014", hemi: 0.55, exposure: 1.1 },
  { top: "#0a0f24", mid: "#1a1730", bottom: "#06060b", glow: "#5a3048", glowAmt: 0.3, stars: 0.25, fog: "#141329", fogD: 0.016, hemiSky: "#6d7fb8", hemiGround: "#120e14", hemi: 0.45, exposure: 1.05 },
  { top: "#0b090a", mid: "#1c110d", bottom: "#050404", glow: "#7a3412", glowAmt: 0.32, stars: 0, fog: "#160c0a", fogD: 0.03, hemiSky: "#ffb07a", hemiGround: "#140a08", hemi: 0.35, exposure: 1.1 },
  { top: "#04050c", mid: "#0a0c1a", bottom: "#030306", glow: "#22223e", glowAmt: 0.25, stars: 0.9, fog: "#070814", fogD: 0.012, hemiSky: "#3a4a7a", hemiGround: "#05050a", hemi: 0.3, exposure: 1.05 },
  { top: "#090607", mid: "#160b0e", bottom: "#050304", glow: "#4a1a2c", glowAmt: 0.42, stars: 0.1, fog: "#0d0809", fogD: 0.03, hemiSky: "#ffcfa0", hemiGround: "#0a0606", hemi: 0.25, exposure: 1.1 },
].map((p) => p);

const cA = new THREE.Color(), cB = new THREE.Color();
const mixHex = (out: THREE.Color, a: string, b: string, t: number) => out.copy(cA.set(a)).lerp(cB.set(b), t);

/* ------------------------------------------------------------------ */
/*  Pose di camera per tappa (in coordinate locali dell'ancora)         */
/* ------------------------------------------------------------------ */

interface Pose { pos: THREE.Vector3; target: THREE.Vector3; fov: number }

function stationPose(i: number, f: number, aspect: number, out: Pose) {
  const A = ANCHORS[i];
  const pf = portraitFactor(aspect, 0.85);
  const portrait = aspect < 1;
  const e = smooth(f);
  const t = sceneTime.t;
  switch (i) {
    case 0: {
      const ang = -0.5 + e * 0.9 + Math.sin(t * 0.1) * 0.03;
      const d = THREE.MathUtils.lerp(5.2, 4.2, e) * pf;
      out.pos.set(Math.sin(ang) * d, 1.7 + (pf - 1) * 0.8, Math.cos(ang) * d);
      out.target.set(0, 0.95, 0);
      out.fov = 38;
      break;
    }
    case 1: {
      out.pos.set(THREE.MathUtils.lerp(0.4, 2.2, e), THREE.MathUtils.lerp(10, 3.4, e) * Math.min(pf, 1.5), THREE.MathUtils.lerp(7.5, 4.6, e) * Math.min(pf, 1.6));
      out.target.set(THREE.MathUtils.lerp(0, 0.9, e), 0, THREE.MathUtils.lerp(0, 0.3, e));
      out.fov = 40;
      break;
    }
    case 2: {
      const ang = -0.55 + e * 1.1;
      const d = 15 * Math.min(pf, 1.5);
      out.pos.set(Math.sin(ang) * d, THREE.MathUtils.lerp(1.8, 3.4, e), -4 + Math.cos(ang) * d);
      out.target.set(0, 4.2, -6);
      out.fov = portrait ? 52 : 42;
      break;
    }
    case 3: {
      const d = THREE.MathUtils.lerp(3.9, 3.3, e) * pf;
      out.pos.set(Math.sin(t * 0.08) * 0.15, 1.25 + (pf - 1) * 0.6, d);
      out.target.set(0, 0.95, 0);
      out.fov = 36;
      break;
    }
    case 4: {
      out.pos.set(THREE.MathUtils.lerp(6, 2.5, e), THREE.MathUtils.lerp(2.8, 2.1, e), THREE.MathUtils.lerp(13.5, 10, e));
      out.target.set(THREE.MathUtils.lerp(-1, -4, e), 1.6, -12);
      out.fov = portrait ? 58 : 44;
      break;
    }
    default: {
      out.pos.set(THREE.MathUtils.lerp(3.2, 1.3, e) * Math.min(pf, 1.4), THREE.MathUtils.lerp(2.8, 1.65, e) + (pf - 1) * 0.5, THREE.MathUtils.lerp(5.2, 2.0, e) * Math.min(pf, 1.5));
      out.target.set(0, 0.8, 0);
      out.fov = 38;
    }
  }
  out.pos.add(A);
  out.target.add(A);
  return out;
}

const poseA: Pose = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 40 };
const poseB: Pose = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 40 };
const ctrl = new THREE.Vector3();
const camPos = new THREE.Vector3();
const camTarget = new THREE.Vector3();

/** Mappa la posizione di scroll continua in: tappa corrente, progresso locale, transito. */
function decompose(s: number) {
  const c = THREE.MathUtils.clamp(s, -0.5, N - 0.5);
  const k = THREE.MathUtils.clamp(Math.floor(c + 0.5), 0, N - 1);
  const x = c - k; // -0.5..0.5
  const DW = 0.3;
  if (x >= -DW && x <= DW) return { k, f: (x + DW) / (2 * DW), travel: -1, next: k };
  if (x > DW && k < N - 1) return { k, f: 1, travel: (x - DW) / (0.5 - DW) / 2, next: k + 1 };
  if (x < -DW && k > 0) return { k: k - 1, f: 1, travel: 0.5 + (x + 0.5) / (0.5 - DW) / 2, next: k };
  return { k, f: x > 0 ? 1 : 0, travel: -1, next: k };
}

/* ------------------------------------------------------------------ */
/*  Linea luminosa che collega le tappe                                 */
/* ------------------------------------------------------------------ */

function LightPath({ progress }: { progress: { value: number } }) {
  const { geo, mat, nodes } = useMemo(() => {
    const side = [V(-2.2, 0.15, 1.6), V(-4.8, 0.2, 2.5), V(-6.5, 0.15, 6), V(2.4, 0.2, 1.4), V(4, 0.38, 3), V(-2.6, 0.15, 1.6)];
    const pts: THREE.Vector3[] = [V(-2, 0.2, 14)];
    ANCHORS.forEach((a, i) => pts.push(a.clone().add(side[i])));
    pts.push(ANCHORS[N - 1].clone().add(V(-6, 0.3, -12)));
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const geo = new THREE.TubeGeometry(curve, 600, 0.03, 6, false);
    const total = pts.length - 1;
    const nodes = ANCHORS.map((_, i) => ({ p: pts[i + 1], u: (i + 1) / total }));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      uniforms: { uProgress: progress, uTime: { value: 0 }, uColor: { value: new THREE.Color("#ffd49a") } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uProgress, uTime; uniform vec3 uColor; varying vec2 vUv;
        void main(){
          float shown = smoothstep(uProgress + 0.004, uProgress - 0.004, vUv.x);
          float ahead = smoothstep(uProgress + 0.06, uProgress, vUv.x) * 0.25;
          float pulse = 0.65 + 0.35 * sin(vUv.x * 140.0 - uTime * 2.0);
          float head = exp(-pow((vUv.x - uProgress) * 90.0, 2.0)) * 3.0;
          float a = (max(shown * pulse, ahead) + head) * 0.7;
          gl_FragColor = vec4(uColor * a, a);
        }`,
    });
    return { geo, mat, nodes };
  }, [progress]);
  useFrame(() => {
    mat.uniforms.uTime.value = sceneTime.t;
  });
  return (
    <group>
      <mesh geometry={geo} material={mat} renderOrder={6} frustumCulled={false} />
      {nodes.map((n, i) => (
        <Glow key={i} position={[n.p.x, n.p.y, n.p.z]} color="#ffd49a" scale={0.9} opacity={0.8} />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Tappa 04: i calici che si sfiorano                                  */
/* ------------------------------------------------------------------ */

function ClinkingGlasses({ local }: { local: { value: number } }) {
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const sparks = useRef<THREE.Points>(null);
  const state = useRef({ touched: false, burstAt: -10 });
  const spark = useMemo(() => {
    const n = 60;
    const rnd = mulberry32(5);
    const dirs = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(rnd() - 0.5, rnd() * 0.9 + 0.1, rnd() - 0.5).normalize();
      dirs.set([v.x, v.y, v.z], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute("aDir", new THREE.BufferAttribute(dirs, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uAge: { value: 10 } },
      vertexShader: /* glsl */ `
        uniform float uAge; attribute vec3 aDir; varying float vA;
        void main(){
          vec3 p = aDir * (0.05 + uAge * 0.55) + vec3(0.0, -uAge * uAge * 0.25, 0.0);
          vA = exp(-uAge * 2.2);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = 26.0 / -mv.z * (0.6 + vA);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, r) * vA; gl_FragColor = vec4(vec3(1.0, 0.85, 0.55) * a, a); }`,
    });
    return { geo, mat };
  }, []);

  useFrame(() => {
    const f = local.value;
    const e = easeInOut((f - 0.08) / 0.5);
    const sep = smooth((f - 0.72) / 0.28) * 0.06;
    const X = THREE.MathUtils.lerp(1.05, 0.54, e) + sep;
    const tilt = 0.2 * e - sep;
    const t = sceneTime.t;
    if (left.current) {
      left.current.position.set(-X, Math.sin(t * 0.7) * 0.02, 0);
      left.current.rotation.set(0, 0.3, -tilt);
    }
    if (right.current) {
      right.current.position.set(X, Math.sin(t * 0.7 + 1.3) * 0.02, 0.02);
      right.current.rotation.set(0, -0.5, tilt);
    }
    const st = state.current;
    if (e > 0.985 && !st.touched) {
      st.touched = true;
      st.burstAt = sceneTime.t;
      getAudio().chime();
    } else if (e < 0.9) st.touched = false;
    spark.mat.uniforms.uAge.value = sceneTime.t - st.burstAt;
  });

  return (
    <group>
      <group ref={left}>
        <SpritzGlass seed={0} />
      </group>
      <group ref={right}>
        <SpritzGlass seed={1} />
      </group>
      <points ref={sparks} geometry={spark.geo} material={spark.mat} position={[0, 1.27, 0.01]} frustumCulled={false} renderOrder={11} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Mondo della timeline                                                */
/* ------------------------------------------------------------------ */

export function TimelineWorld() {
  const tier = useUI((s) => s.tier);
  const reduced = useUI((s) => s.userReducedMotion ?? s.systemReducedMotion);
  const stations = useRef<(THREE.Group | null)[]>([]);
  const uniforms = useMemo(() => backdropUniforms(), []);
  const pathProgress = useMemo(() => ({ value: 0 }), []);
  const locals = useMemo(() => ANCHORS.map(() => ({ value: 0 })), []);
  const lakeSky = useMemo<SharedSkyUniforms>(() => ({ uNight: { value: 1 }, uSunDir: { value: new THREE.Vector3(-0.153, 0.157, -0.976).normalize() } }), []);
  const mapReveal = useRef(0);
  const smoothS = useRef<number | null>(null);

  const lakeLights = useMemo(() => {
    const rnd = mulberry32(8);
    const L = makeLightData();
    // sponda opposta: luci su colline lontane
    for (let i = 0; i < 260; i++) {
      const x = (rnd() - 0.5) * 140;
      const z = -48 - rnd() * 30;
      const y = 0.4 + Math.pow(rnd(), 2) * 14 * (0.5 + 0.5 * Math.sin(x * 0.05 + 1));
      L.push(x, y, z, 2 + rnd() * 2.4, 0, rnd);
    }
    // paesi sulla riva di fronte, più vicini
    for (let i = 0; i < 60; i++) {
      const x = -50 + rnd() * 100;
      L.push(x, 0.4 + rnd() * 1.2, -38 - rnd() * 4, 2.2, 0, rnd);
    }
    return { positions: L.positions, sizes: L.sizes, seeds: L.seeds, ons: L.ons, colors: L.colors };
  }, []);

  const lamps = useMemo<[number, number, number][]>(
    () => Array.from({ length: 7 }, (_, i) => [-4 + i * 3.6, 0.25, 4.4]),
    [],
  );

  useFrame(({ camera, size }, delta) => {
    if (scrollState.active !== "timeline" && scrollState.active !== "map") return;
    const aspect = size.width / size.height;
    const target = scrollState.stageFloat;
    if (smoothS.current === null || Math.abs(target - smoothS.current) > 3) smoothS.current = target;
    smoothS.current = THREE.MathUtils.damp(smoothS.current, target, reduced ? 30 : 7, delta);
    const s = THREE.MathUtils.clamp(smoothS.current, -0.5, N - 0.5);
    const d = decompose(s);

    // visibilità per prossimità
    stations.current.forEach((g, i) => {
      if (g) g.visible = Math.abs(s - i) < 1.1;
    });
    locals.forEach((l, i) => (l.value = i < d.k ? 1 : i > d.k ? 0 : d.f));
    if (d.travel >= 0) locals[d.next].value = 0;

    // camera
    if (d.travel < 0) {
      stationPose(d.k, d.f, aspect, poseA);
      camPos.copy(poseA.pos);
      camTarget.copy(poseA.target);
      placeCamera(camera, camPos, camTarget, poseA.fov);
    } else {
      const u = reduced ? (d.travel < 0.5 ? 0 : 1) : easeInOut(d.travel);
      stationPose(d.k, 1, aspect, poseA);
      stationPose(d.next, 0, aspect, poseB);
      ctrl.copy(poseA.pos).lerp(poseB.pos, 0.5);
      ctrl.y += 6;
      const om = 1 - u;
      camPos.set(0, 0, 0).addScaledVector(poseA.pos, om * om).addScaledVector(ctrl, 2 * om * u).addScaledVector(poseB.pos, u * u);
      camTarget.copy(poseA.target).lerp(poseB.target, easeInOut(Math.min(1, u * 1.25)));
      placeCamera(camera, camPos, camTarget, THREE.MathUtils.lerp(poseA.fov, poseB.fov, u));
    }

    // linea luminosa: avanza con il viaggio
    const totalSeg = N + 1;
    const along = d.travel >= 0 ? d.k + d.travel * 1 : d.k + d.f * 0.5 - 0.25;
    pathProgress.value = THREE.MathUtils.clamp((along + 1 + 0.25) / totalSeg, 0, 1);

    // palette
    const k0 = Math.floor(THREE.MathUtils.clamp(s, 0, N - 1));
    const k1 = Math.min(N - 1, k0 + 1);
    const w = smooth((THREE.MathUtils.clamp(s, 0, N - 1) - k0 - 0.3) / 0.4);
    const P0 = PALETTES[k0], P1 = PALETTES[k1];
    mixHex(uniforms.uTop.value, P0.top, P1.top, w);
    mixHex(uniforms.uMid.value, P0.mid, P1.mid, w);
    mixHex(uniforms.uBottom.value, P0.bottom, P1.bottom, w);
    mixHex(uniforms.uGlow.value, P0.glow, P1.glow, w);
    uniforms.uGlowAmount.value = THREE.MathUtils.lerp(P0.glowAmt, P1.glowAmt, w);
    uniforms.uStars.value = THREE.MathUtils.lerp(P0.stars, P1.stars, w);
    uniforms.uGlowDir.value.set(-0.3, 0.12, -1).normalize();
    uniforms.uGlowPower.value = 2.2;
    mixHex(rig.fog, P0.fog, P1.fog, w);
    rig.fogDensity = THREE.MathUtils.lerp(P0.fogD, P1.fogD, w);
    mixHex(rig.hemiSky, P0.hemiSky, P1.hemiSky, w);
    mixHex(rig.hemiGround, P0.hemiGround, P1.hemiGround, w);
    rig.hemi = THREE.MathUtils.lerp(P0.hemi, P1.hemi, w);
    rig.exposure = THREE.MathUtils.lerp(P0.exposure, P1.exposure, w);
    rig.viewShift = aspect < 1 ? 0.22 : 0;
    {
      // desktop: la scheda alterna sinistra/destra, il soggetto va dal lato libero
      const side = Math.round(THREE.MathUtils.clamp(s, 0, N - 1)) % 2 === 1 ? 1 : -1;
      rig.viewShiftX = aspect < 1 ? 0 : THREE.MathUtils.damp(rig.viewShiftX, side * 0.17, 4, delta);
    }

    // il lago: il cielo si scurisce durante lo scroll
    if (d.k === 4 || d.next === 4) {
      const lf = locals[4].value;
      uniforms.uTop.value.multiplyScalar(1 - lf * 0.5);
      uniforms.uMid.value.multiplyScalar(1 - lf * 0.55);
      uniforms.uStars.value = Math.min(1, uniforms.uStars.value + lf * 0.3);
    }

    // luci della tappa corrente (sfumate nel transito)
    const kk = d.travel >= 0 ? (d.travel < 0.5 ? d.k : d.next) : d.k;
    const A = ANCHORS[kk];
    const t = sceneTime.t;
    switch (kk) {
      case 0:
        rig.keyColor.set("#ffcf98"); rig.key = 2.6; rig.keyPos.set(A.x - 3, A.y + 6, A.z + 3); rig.keyTarget.copy(A);
        rig.aColor.set("#e59bb0"); rig.a = 5; rig.aPos.set(A.x + 2, A.y + 1.8, A.z - 1.8); rig.aDist = 8;
        rig.bColor.set("#ffb070"); rig.b = 1.5; rig.bPos.set(A.x, A.y + 0.4, A.z + 2.5); rig.bDist = 6;
        break;
      case 1:
        rig.keyColor.set("#ffb48a"); rig.key = 1.6; rig.keyPos.set(A.x - 8, A.y + 4, A.z - 6); rig.keyTarget.copy(A);
        rig.aColor.set("#ffc070"); rig.a = 4; rig.aPos.set(A.x + 2.6, A.y + 1, A.z + 0.5); rig.aDist = 6;
        rig.bColor.set("#7f8fd0"); rig.b = 2; rig.bPos.set(A.x - 2, A.y + 3, A.z - 4); rig.bDist = 10;
        break;
      case 2:
        rig.keyColor.set("#8fa2e0"); rig.key = 0.5; rig.keyPos.set(A.x + 10, A.y + 14, A.z - 20); rig.keyTarget.set(A.x, A.y, A.z - 6);
        rig.aColor.set("#ffd2a6"); rig.a = 18; rig.aPos.set(A.x, A.y + 0.6, A.z + 0.5); rig.aDist = 16;
        rig.bColor.set("#9fb0e8"); rig.b = 8; rig.bPos.set(A.x - 6, A.y + 3, A.z - 2); rig.bDist = 14;
        break;
      case 3:
        rig.keyColor.set("#ffcc90"); rig.key = 2.2; rig.keyPos.set(A.x - 2, A.y + 3, A.z - 4); rig.keyTarget.set(A.x, A.y + 1, A.z);
        rig.aColor.set("#ff9a4a"); rig.a = 3.5; rig.aPos.set(A.x + 0.4, A.y + 1.0, A.z - 1.6); rig.aDist = 5;
        rig.bColor.set("#e59bb0"); rig.b = 2.4; rig.bPos.set(A.x + 1.8, A.y + 1.8, A.z + 1.5); rig.bDist = 6;
        break;
      case 4:
        rig.keyColor.set("#8a9ad8"); rig.key = 0.35; rig.keyPos.set(A.x - 5, A.y + 10, A.z - 20); rig.keyTarget.copy(A);
        rig.aColor.set("#ffc27a"); rig.a = 22; rig.aPos.set(A.x - 7, A.y + 1, A.z - 0.5); rig.aDist = 12;
        rig.bColor.set("#ffd9a0"); rig.b = 4; rig.bPos.set(A.x + 4, A.y + 3, A.z + 3); rig.bDist = 10;
        break;
      default: {
        const flick = 1 + Math.sin(t * 11) * 0.06 + Math.sin(t * 23 + 1) * 0.04;
        rig.keyColor.set("#ffd2a0"); rig.key = 0.35; rig.keyPos.set(A.x, A.y + 5, A.z + 1); rig.keyTarget.copy(A);
        rig.aColor.set("#ffa850"); rig.a = 5.5 * flick; rig.aPos.set(A.x + 0.18, A.y + 1.18, A.z - 0.05); rig.aDist = 5;
        rig.bColor.set("#c46d84"); rig.b = 2; rig.bPos.set(A.x - 2.5, A.y + 2, A.z - 2.5); rig.bDist = 7;
      }
    }

    mapReveal.current = locals[1].value;
  });

  const ps = PARTICLE_SCALE[tier];
  const tex = tier === "high" ? 1024 : tier === "medium" ? 512 : 256;
  const set = (i: number) => (g: THREE.Group | null) => {
    stations.current[i] = g;
  };

  return (
    <group>
      <Backdrop uniforms={uniforms} />
      <LightPath progress={pathProgress} />

      {/* 01 — Il bouquet */}
      <group ref={set(0)} position={ANCHORS[0].toArray()}>
        <Bouquet detail={tier === "low" ? 0.5 : 0.8} scale={0.9} />
        <FloatingPetals count={Math.round(30 * ps) + 6} radius={2} height={3} center={[0, 1.1, 0]} />
        <SoftShadow position={[0, -0.5, 0]} scale={2.4} opacity={0.45} />
        <BokehDust count={Math.round(90 * ps)} box={[8, 5, 8]} center={[0, 1.2, 0]} color="#f2c88f" size={8} focus={4.5} opacity={0.55} seed={21} />
      </group>

      {/* 02 — Arrivo a Como: mappa stilizzata */}
      <group ref={set(1)} position={ANCHORS[1].toArray()}>
        <ComoMap reveal={mapReveal} />
      </group>

      {/* 03 — Centro storico: Duomo stilizzato */}
      <group ref={set(2)} position={ANCHORS[2].toArray()}>
        <DuomoStylized position={[0, 0, -6]} />
        <LampPosts points={[[-6, 0, 2], [6, 0, 2], [-7, 0, -3], [7, 0, -3]]} />
        <BokehDust count={Math.round(120 * ps)} box={[24, 10, 20]} center={[0, 4, 0]} color="#ffd9a8" size={20} focus={14} opacity={0.4} seed={31} />
      </group>

      {/* 04 — Aperitivo: due calici di Spritz */}
      <group ref={set(3)} position={ANCHORS[3].toArray()}>
        <ClinkingGlasses local={locals[3]} />
        <SoftShadow position={[0, 0, 0]} scale={[3.4, 1.6]} opacity={0.5} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <circleGeometry args={[5, 48]} />
          <meshStandardMaterial color="#140c09" roughness={0.55} metalness={0.1} envMapIntensity={0.3} />
        </mesh>
        <BokehDust count={Math.round(80 * ps) + 10} box={[10, 4, 4]} center={[0, 1.6, -4]} color="#ff9a4a" size={30} focus={2} opacity={0.5} rise={0.02} seed={41} />
        <BokehDust count={Math.round(50 * ps) + 6} box={[8, 3, 3]} center={[0, 1.4, -6]} color="#ffd9a8" size={34} focus={2} opacity={0.35} rise={0.01} seed={42} />
      </group>

      {/* 05 — Il lago di notte */}
      <group ref={set(4)} position={ANCHORS[4].toArray()}>
        <LakeWater sky={lakeSky} size={160} position={[0, 0, -24]} fade={80} textureSize={tex} distort={0.06} reflect={1} sun={0.55} sunColor="#cdd6ff" nightFade={0} deep="#020308" />
        {/* luna: la sua scia d'argento attraversa il lago */}
        <mesh position={[-30, 38, -205]}>
          <circleGeometry args={[3.2, 40]} />
          <meshBasicMaterial color="#f3efe6" fog={false} />
        </mesh>
        <Glow position={[-30, 38, -204]} color="#cfd8ff" scale={34} opacity={0.45} />
        {/* lungolago */}
        <mesh position={[0, 0.1, 8.5]}>
          <boxGeometry args={[60, 0.3, 9]} />
          <meshStandardMaterial color="#17151a" roughness={0.6} />
        </mesh>
        <mesh position={[-12, 0.1, -3]}>
          <boxGeometry args={[12, 0.3, 11]} />
          <meshStandardMaterial color="#141217" roughness={0.7} />
        </mesh>
        <TempioStylized position={[-10, 0.25, -4]} rotation={[0, 0.75, 0]} scale={0.9} />
        <LampPosts points={lamps} />
        <LightPoints data={lakeLights} night={lakeSky.uNight} brightness={1.5} sizeScale={2.6} />
        <MistLayer position={[0, 2, -30]} scale={[120, 10]} color="#6d6a8a" opacity={0.25} seed={5} />
        <BokehDust count={Math.round(120 * ps)} box={[30, 8, 26]} center={[0, 3, 0]} color="#dfe6ff" size={16} focus={8} opacity={0.35} seed={51} />
      </group>

      {/* 06 — La cena */}
      <group ref={set(5)} position={ANCHORS[5].toArray()}>
        <DinnerTable />
        <BokehDust count={Math.round(70 * ps) + 10} box={[16, 5, 4]} center={[0, 2.2, -6]} color="#ffb870" size={60} focus={2} opacity={0.4} rise={0.01} seed={61} />
        <Glow position={[0, 2, -5]} color="#551E32" scale={12} opacity={0.5} />
      </group>
    </group>
  );
}
