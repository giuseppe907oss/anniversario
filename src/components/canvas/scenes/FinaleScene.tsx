"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { scrollState } from "@/lib/scroll";
import { useUI } from "@/lib/store";
import { PARTICLE_SCALE } from "@/lib/device";
import { mulberry32 } from "@/lib/noise";
import { sceneTime } from "../clock";
import { placeCamera, rig, smooth } from "../rig";
import { Backdrop, BokehDust, backdropUniforms } from "../objects/Atmosphere";

const pos = new THREE.Vector3();
const target = new THREE.Vector3(0, 0.6, 0);

/** Pulviscolo d'oro che sale lento e si raccoglie in una spirale, poi si apre. */
function GoldDust({ count }: { count: number }) {
  const dpr = useThree((s) => s.viewport.dpr);
  const { geo, mat } = useMemo(() => {
    const rnd = mulberry32(2111);
    const a = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      a[i * 4] = rnd(); // fase
      a[i * 4 + 1] = Math.pow(rnd(), 0.7); // raggio
      a[i * 4 + 2] = rnd(); // velocità
      a[i * 4 + 3] = rnd(); // dimensione
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute("aData", new THREE.BufferAttribute(a, 4));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uGather: { value: 0 }, uDpr: { value: 1 } },
      vertexShader: /* glsl */ `
        uniform float uTime, uGather, uDpr;
        attribute vec4 aData;
        varying float vA; varying float vHue;
        void main(){
          float ph = aData.x, rad = aData.y, sp = aData.z, sz = aData.w;
          float y = mod(ph * 8.0 + uTime * (0.08 + sp * 0.12), 8.0) - 3.0;
          float spiral = ph * 6.2831 * 3.0 + uTime * (0.05 + sp * 0.08) + y * 0.6;
          float r = mix(rad * 6.0 + 0.5, 0.35 + rad * 1.6 + max(y, 0.0) * 0.35, uGather);
          vec3 p = vec3(cos(spiral) * r, y, sin(spiral) * r);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float life = smoothstep(-3.0, -2.0, y) * smoothstep(5.0, 3.0, y);
          vA = life * (0.35 + 0.65 * sz) * (0.7 + 0.3 * sin(uTime * 2.0 + ph * 40.0));
          vHue = sz;
          gl_PointSize = (30.0 + sz * 110.0) * uDpr / max(-mv.z, 0.5) * (1.0 + uGather * 0.3);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA; varying float vHue;
        void main(){
          float r = length(gl_PointCoord - 0.5) * 2.0;
          float a = pow(smoothstep(1.0, 0.0, r), 2.2) * vA;
          vec3 col = mix(vec3(0.85, 0.66, 0.4), vec3(1.0, 0.9, 0.7), vHue);
          gl_FragColor = vec4(col * a * 1.6, a);
        }`,
    });
    return { geo, mat };
  }, [count]);

  useFrame(() => {
    mat.uniforms.uTime.value = sceneTime.t;
    mat.uniforms.uDpr.value = dpr;
    mat.uniforms.uGather.value = smooth(scrollState.progress.finale * 1.3);
  });
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={8} />;
}

export function FinaleScene() {
  const tier = useUI((s) => s.tier);
  const uniforms = useMemo(() => {
    const u = backdropUniforms();
    u.uTop.value.set("#050509");
    u.uMid.value.set("#120a10");
    u.uBottom.value.set("#030304");
    u.uGlow.value.set("#551E32");
    u.uGlowDir.value.set(0, -0.1, -1).normalize();
    u.uGlowPower.value = 2.5;
    u.uGlowAmount.value = 0.6;
    u.uStars.value = 1;
    return u;
  }, []);

  useFrame(({ camera, size }) => {
    if (scrollState.active !== "finale") return;
    const p = scrollState.progress.finale;
    const t = sceneTime.t;
    const portrait = size.width / size.height < 1;
    const d = (portrait ? 11 : 8.5) - smooth(p) * 2;
    pos.set(Math.sin(t * 0.05) * 0.6, 0.8 + p * 0.6, d);
    target.set(0, 0.8, 0);
    placeCamera(camera, pos, target, 45);
    rig.hemi = 0.2;
    rig.key = 0;
    rig.a = 0;
    rig.b = 0;
    rig.fog.set("#050508");
    rig.fogDensity = 0.01;
    rig.exposure = 1.1;
    rig.viewShift = 0;
    rig.viewShiftX = 0;
  });

  const n = Math.round(1400 * PARTICLE_SCALE[tier]) + 200;
  return (
    <group>
      <Backdrop uniforms={uniforms} />
      <GoldDust count={n} />
      <BokehDust count={Math.round(60 * PARTICLE_SCALE[tier]) + 10} box={[16, 10, 10]} center={[0, 1, 2]} color="#D8BC8A" size={40} focus={3} opacity={0.35} rise={0.04} seed={71} />
    </group>
  );
}
