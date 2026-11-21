"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { scrollState } from "@/lib/scroll";
import { useUI } from "@/lib/store";
import { PARTICLE_SCALE } from "@/lib/device";
import { sceneTime } from "../clock";
import { placeCamera, portraitFactor, rig, smooth } from "../rig";
import { Backdrop, BokehDust, Glow, SoftShadow, backdropUniforms } from "../objects/Atmosphere";
import { Bouquet, FloatingPetals } from "../objects/Flowers";
import { LightShaft } from "../objects/LightShaft";

const pos = new THREE.Vector3();
const target = new THREE.Vector3();

/** "Un pomeriggio. Una città. Noi due." — bouquet sospeso nello spazio. */
export function BouquetScene() {
  const tier = useUI((s) => s.tier);
  const group = useRef<THREE.Group>(null);
  const uniforms = useMemo(() => {
    const u = backdropUniforms();
    u.uTop.value.set("#0a0910");
    u.uMid.value.set("#150c12");
    u.uBottom.value.set("#060508");
    u.uGlow.value.set("#4f1d30");
    u.uGlowDir.value.set(0, 0.25, -1).normalize();
    u.uGlowPower.value = 2.4;
    u.uGlowAmount.value = 0.55;
    u.uStars.value = 0.25;
    return u;
  }, []);

  useFrame(({ camera, size }) => {
    if (scrollState.active !== "intro") return;
    const p = scrollState.progress.intro;
    const t = sceneTime.t;
    const aspect = size.width / size.height;
    const pf = portraitFactor(aspect, 0.9);

    if (group.current) {
      group.current.rotation.y = t * 0.07 + p * 1.4;
      group.current.position.y = Math.sin(t * 0.5) * 0.04;
      group.current.rotation.z = Math.sin(t * 0.31) * 0.025;
    }

    const e = smooth(p);
    const dist = THREE.MathUtils.lerp(4.9, 3.5, e) * pf;
    const ang = THREE.MathUtils.lerp(-0.25, 0.3, e) + Math.sin(t * 0.1) * 0.03;
    pos.set(Math.sin(ang) * dist, THREE.MathUtils.lerp(1.9, 1.25, e) + (pf - 1) * 0.9, Math.cos(ang) * dist);
    target.set(0, 0.95, 0);
    // su iPhone il soggetto sta nella metà alta, il testo in basso
    rig.viewShift = aspect < 1 ? 0.2 : 0;
    rig.viewShiftX = aspect < 1 ? 0 : -0.2;
    placeCamera(camera, pos, target, 38);

    rig.hemiSky.set("#3b2a3a");
    rig.hemiGround.set("#0a0608");
    rig.hemi = 0.55;
    rig.keyColor.set("#ffd5a3");
    rig.key = 2.4;
    rig.keyPos.set(-2.5, 5, 3);
    rig.keyTarget.set(0, 1, 0);
    rig.aColor.set("#e59bb0");
    rig.a = 6;
    rig.aPos.set(2.2, 1.8, -1.8);
    rig.aDist = 8;
    rig.bColor.set("#D8BC8A");
    rig.b = 2.2;
    rig.bPos.set(0.5, 0.4, 2.4);
    rig.bDist = 6;
    rig.fog.set("#0b0810");
    rig.fogDensity = 0.04;
    rig.exposure = 1.1;
  });

  const detail = tier === "low" ? 0.5 : 1;

  return (
    <group>
      <Backdrop uniforms={uniforms} />
      <group ref={group}>
        <Bouquet detail={detail} />
      </group>
      <FloatingPetals count={Math.round(46 * PARTICLE_SCALE[tier]) + 8} radius={2.4} height={3.4} center={[0, 1.1, 0]} />
      <LightShaft position={[-0.6, 3.6, 0.2]} rotation={[0, 0, -0.18]} height={5.2} radiusTop={0.12} radiusBottom={1.5} opacity={0.16} />
      <Glow position={[0, 1.3, -1.6]} color="#7a2d47" scale={6} opacity={0.5} />
      {/* ombra morbida */}
      <SoftShadow position={[0, -0.55, 0]} scale={2.6} opacity={0.5} />
      <BokehDust
        count={Math.round(140 * PARTICLE_SCALE[tier])}
        box={[9, 6, 9]}
        center={[0, 1.2, 0]}
        color="#f0cfa0"
        size={9}
        focus={4}
        opacity={0.6}
        rise={0.06}
        seed={3}
      />
    </group>
  );
}
