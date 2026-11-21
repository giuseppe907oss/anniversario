"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, PerformanceMonitor } from "@react-three/drei";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { scrollState } from "@/lib/scroll";
import { isReducedMotion, useUI } from "@/lib/store";
import { dprRange } from "@/lib/device";
import { sceneTime } from "./clock";
import { Rig } from "./rig";
import { HeroLake } from "./scenes/HeroLake";
import { BouquetScene } from "./scenes/BouquetScene";
import { TimelineWorld } from "./scenes/TimelineWorld";
import { FinaleScene } from "./scenes/FinaleScene";

type SceneKey = "hero" | "intro" | "timeline" | "finale";
const SCENE_FOR: Record<string, SceneKey | null> = {
  hero: "hero",
  intro: "intro",
  timeline: "timeline",
  map: "timeline",
  finale: "finale",
};

/** Orologio di scena, segnale di "pronto" e pausa del rendering quando la mappa copre il canvas. */
function Director() {
  const frames = useRef(0);
  const setFrameloop = useThree((s) => s.setFrameloop);
  const invalidate = useThree((s) => s.invalidate);

  useFrame((_, delta) => {
    sceneTime.scale = isReducedMotion() ? 0.12 : 1;
    sceneTime.t += Math.min(delta, 0.1) * sceneTime.scale;
    frames.current++;
    if (frames.current === 4) useUI.getState().set({ sceneReady: true });
  }, -2);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useUI.subscribe((s, prev) => {
      if (s.activeSection === prev.activeSection) return;
      if (timer) clearTimeout(timer);
      if (s.activeSection === "map") {
        // la sezione mappa ha uno sfondo opaco: sospendiamo il WebGL
        timer = setTimeout(() => setFrameloop("never"), 900);
      } else {
        setFrameloop("always");
        invalidate();
      }
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [setFrameloop, invalidate]);

  return null;
}

/** Monta le scene in modo progressivo e precompila gli shader in anticipo. */
function Scenes() {
  const [mounted, setMounted] = useState<SceneKey[]>(["hero"]);
  const groups = useRef<Partial<Record<SceneKey, THREE.Group | null>>>({});
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    const order: SceneKey[] = ["intro", "timeline", "finale"];
    const timers = order.map((k, i) =>
      setTimeout(() => setMounted((m) => (m.includes(k) ? m : [...m, k])), 900 + i * 900),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const register = (k: SceneKey) => (g: THREE.Group | null) => {
    groups.current[k] = g;
    if (g && !g.userData.compiled) {
      g.userData.compiled = true;
      const was = g.visible;
      g.visible = true;
      try {
        // compilazione asincrona (KHR_parallel_shader_compile) dove disponibile
        const r = gl as THREE.WebGLRenderer & { compileAsync?: (o: THREE.Object3D, c: THREE.Camera, s?: THREE.Scene) => Promise<unknown> };
        if (r.compileAsync) r.compileAsync(g, camera, scene).catch(() => {});
        else gl.compile(g, camera, scene);
      } catch {
        /* la compilazione avverrà al primo render */
      }
      g.visible = was && SCENE_FOR[scrollState.active] === k;
    }
  };

  useFrame(() => {
    const want = SCENE_FOR[scrollState.active];
    (Object.keys(groups.current) as SceneKey[]).forEach((k) => {
      const g = groups.current[k];
      if (g) g.visible = k === want;
    });
  }, -1);

  return (
    <>
      <group ref={register("hero")}>
        <HeroLake />
      </group>
      {mounted.includes("intro") && (
        <group ref={register("intro")} visible={false}>
          <BouquetScene />
        </group>
      )}
      {mounted.includes("timeline") && (
        <group ref={register("timeline")} visible={false}>
          <TimelineWorld />
        </group>
      )}
      {mounted.includes("finale") && (
        <group ref={register("finale")} visible={false}>
          <FinaleScene />
        </group>
      )}
    </>
  );
}

export default function StageCanvas() {
  const tier = useUI((s) => s.tier);
  const set = useUI((s) => s.set);
  const [range] = useState(() => dprRange(tier));
  const [dpr, setDpr] = useState(range[1]);

  return (
    <Canvas
      aria-hidden="true"
      tabIndex={-1}
      dpr={dpr}
      gl={{
        antialias: tier !== "low",
        powerPreference: "high-performance",
        alpha: false,
        stencil: false,
        depth: true,
      }}
      camera={{ fov: 50, near: 0.1, far: 1200, position: [0, 3, 70] }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        scene.background = new THREE.Color("#09090D");
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          set({ webgl: "none" });
        });
      }}
      style={{ position: "absolute", inset: 0 }}
    >
      <PerformanceMonitor
        flipflops={3}
        bounds={() => [42, 58]}
        onDecline={() => setDpr((d) => Math.max(range[0], +(d - 0.25).toFixed(2)))}
        onIncline={() => setDpr((d) => Math.min(range[1], +(d + 0.2).toFixed(2)))}
        onFallback={() => {
          setDpr(range[0]);
          if (useUI.getState().tier !== "low") set({ tier: "low" });
        }}
      />
      <Director />
      <Rig />
      <Suspense fallback={null}>
        <Environment resolution={tier === "high" ? 256 : 128} frames={1}>
          <Lightformer form="rect" intensity={2.4} color="#ffd9b0" position={[0, 5, -6]} scale={[10, 2, 1]} />
          <Lightformer form="ring" intensity={1.4} color="#d6a7b3" position={[-5, 2, 2]} scale={3} />
          <Lightformer form="rect" intensity={1} color="#9fb0ff" position={[6, 1, 0]} rotation-y={-Math.PI / 2} scale={[6, 2, 1]} />
          <Lightformer form="circle" intensity={3} color="#fff2e0" position={[0, 6, 3]} scale={2} />
          <Lightformer form="rect" intensity={0.8} color="#ff9a4a" position={[0, -3, 4]} rotation-x={Math.PI / 2} scale={[8, 4, 1]} />
        </Environment>
        <Scenes />
      </Suspense>
    </Canvas>
  );
}
