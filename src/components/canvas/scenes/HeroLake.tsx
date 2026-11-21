"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { scrollState } from "@/lib/scroll";
import { useUI } from "@/lib/store";
import { PARTICLE_SCALE } from "@/lib/device";
import { sceneTime } from "../clock";
import { easeInOut, placeCamera, rig } from "../rig";
import { LakeWater, type SharedSkyUniforms } from "../objects/LakeWater";
import { BokehDust, MistLayer, SkyDome } from "../objects/Atmosphere";
import { ShoreLights, Terrain } from "../objects/Landscape";

const pos = new THREE.Vector3();
const target = new THREE.Vector3();

/** Lago al crepuscolo: la camera avanza lentamente sopra l'acqua verso la città. */
export function HeroLake() {
  const tier = useUI((s) => s.tier);
  const sky = useMemo<SharedSkyUniforms>(
    () => ({ uNight: { value: 0.1 }, uSunDir: { value: new THREE.Vector3(0.32, 0.05, -1).normalize() } }),
    [],
  );
  const drift = useRef(0);

  useFrame(({ camera, size }, delta) => {
    if (scrollState.active !== "hero") return;
    const p = scrollState.progress.hero;
    const dive = easeInOut(scrollState.dive);
    drift.current = Math.min(drift.current + delta * sceneTime.scale, 240);
    const autoNight = Math.min(drift.current / 240, 1) * 0.12;

    // cielo: dal tramonto alla notte
    const night = THREE.MathUtils.clamp(0.2 + autoNight + p * 0.55 + dive * 0.3, 0, 1);
    sky.uNight.value = night;
    sky.uSunDir.value.set(0.32, 0.06 - night * 0.16, -1).normalize();

    // camera: avanzamento lento + scroll + "tuffo" verso la città
    const t = sceneTime.t;
    const z = 70 - drift.current * 0.18 - p * 38 - dive * 150;
    const y = 3.3 - p * 0.9 + Math.sin(t * 0.21) * 0.12 - dive * 1.4 + dive * dive * 3;
    pos.set(Math.sin(t * 0.07) * 1.2, y, z);
    target.set(Math.sin(t * 0.05) * 3, 5.5 - p * 1.5 - dive * 2.5, z - 120);
    const portrait = size.width / size.height < 1;
    placeCamera(camera, pos, target, (portrait ? 60 : 46) - dive * 8);

    rig.hemi = 0.2;
    rig.key = 0;
    rig.a = 0;
    rig.b = 0;
    rig.fog.set("#2a1a26").lerp(new THREE.Color("#0a0a12"), night);
    rig.fogDensity = 0.0;
    rig.exposure = 0.8;
    rig.viewShift = 0;
    rig.viewShiftX = 0;
  });

  const lightsDensity = tier === "high" ? 1 : tier === "medium" ? 0.8 : 0.5;
  const tex = tier === "high" ? 1024 : tier === "medium" ? 512 : 256;

  return (
    <group>
      <SkyDome sky={sky} />
      <Terrain sky={sky} />
      <LakeWater sky={sky} size={700} position={[0, 0, -150]} textureSize={tex} distort={0.07} deep="#04050b" />
      <ShoreLights sky={sky} density={lightsDensity} />
      <MistLayer position={[0, 5, -70]} scale={[220, 16]} color="#8a6a76" opacity={0.16} seed={1} />
      <MistLayer position={[0, 7, -150]} scale={[260, 22]} color="#6e5468" opacity={0.2} seed={2} speed={0.006} />
      <MistLayer position={[0, 9, -215]} scale={[300, 26]} color="#5c4660" opacity={0.22} seed={3} speed={0.004} />
      <BokehDust
        count={Math.round(160 * PARTICLE_SCALE[tier])}
        box={[30, 10, 50]}
        center={[0, 0, -16]}
        follow
        color="#e7c99a"
        size={22}
        focus={14}
        opacity={0.45}
        rise={0.05}
      />
    </group>
  );
}
