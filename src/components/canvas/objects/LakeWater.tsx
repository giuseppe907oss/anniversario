"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { NOISE, SKY_FN } from "../shaders/common";
import { sceneTime } from "../clock";

export interface SharedSkyUniforms {
  uNight: { value: number };
  uSunDir: { value: THREE.Vector3 };
}

const vertex = /* glsl */ `
uniform mat4 textureMatrix;
varying vec4 vUv;
varying vec3 vWorld;
#include <common>
#include <fog_pars_vertex>
void main() {
  vUv = textureMatrix * vec4(position, 1.0);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const fragment = /* glsl */ `
uniform vec3 color;
uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uDistort;
uniform vec3 uDeep;
uniform float uSun;
uniform float uReflect;
uniform vec2 uCenter;
uniform float uFade;
uniform float uWave;
uniform vec3 uSunColor;
uniform float uNightFade;
varying vec4 vUv;
varying vec3 vWorld;
#include <common>
#include <fog_pars_fragment>
${NOISE}
${SKY_FN}

vec2 waveGrad(vec2 p, float t) {
  vec2 g = vec2(0.0);
  vec2 d1 = vec2(0.8, 0.6), d2 = vec2(-0.5, 0.86), d3 = vec2(0.97, -0.24), d4 = vec2(-0.2, -0.98);
  g += 0.022 * 0.9 * d1 * cos(dot(d1, p) * 0.9 + t * 1.1);
  g += 0.016 * 1.7 * d2 * cos(dot(d2, p) * 1.7 + t * 1.5);
  g += 0.011 * 3.1 * d3 * cos(dot(d3, p) * 3.1 + t * 2.1);
  g += 0.006 * 5.7 * d4 * cos(dot(d4, p) * 5.7 + t * 2.9);
  vec2 q = p * 1.4 + vec2(t * 0.11, -t * 0.07);
  float e = 0.2;
  float n0 = vnoise(q), nx = vnoise(q + vec2(e, 0.0)), nz = vnoise(q + vec2(0.0, e));
  g += vec2(nx - n0, nz - n0) / e * 0.05;
  return g * uWave;
}

void main() {
  vec3 V = cameraPosition - vWorld;
  float dist = length(V);
  V /= dist;
  float lod = 1.0 / (1.0 + dist * 0.03);
  vec2 g = waveGrad(vWorld.xz, uTime) * lod;
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);

  vec2 uv = vUv.xy / vUv.w + vec2(g.x * 0.6, g.y * 2.2) * uDistort;
  vec3 refl = texture2D(tDiffuse, uv).rgb * color;

  vec3 R = reflect(-V, N);
  vec3 col = mix(uDeep, refl, clamp(fres * uReflect + 0.3, 0.0, 0.92));

  // scia dorata del sole al tramonto
  float sp = max(dot(R, uSunDir), 0.0);
  col += uSunColor * (pow(sp, 700.0) * 9.0 * smoothstep(0.02, 0.2, lod) + pow(sp, 60.0) * 0.22) * uSun * (1.0 - uNight * uNightFade);

  float a = 1.0;
  if (uFade > 0.0) {
    float r = length(vWorld.xz - uCenter);
    a = 1.0 - smoothstep(uFade * 0.55, uFade, r);
  }
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

interface Props {
  size?: number;
  sky: SharedSkyUniforms;
  deep?: THREE.ColorRepresentation;
  reflect?: number;
  sun?: number;
  distort?: number;
  fade?: number;
  wave?: number;
  textureSize?: number;
  position?: [number, number, number];
  sunColor?: THREE.ColorRepresentation;
  /** 1 = la scia del sole sparisce di notte; 0 = resta (luna). */
  nightFade?: number;
}

export function LakeWater({
  size = 600,
  sky,
  deep = "#05060c",
  reflect = 1,
  sun = 1,
  distort = 0.06,
  fade = 0,
  wave = 1,
  textureSize = 512,
  position = [0, 0, 0],
  sunColor = "#ffc275",
  nightFade = 1,
}: Props) {
  const mirror = useMemo(() => {
    const geo = new THREE.PlaneGeometry(size, size, 1, 1);
    const r = new Reflector(geo, {
      textureWidth: textureSize,
      textureHeight: textureSize,
      clipBias: 0.002,
      multisample: 0,
      color: 0xffffff,
      shader: {
        name: "LakeWater",
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib.fog,
          {
            color: { value: null },
            tDiffuse: { value: null },
            textureMatrix: { value: null },
            uTime: { value: 0 },
            uDistort: { value: distort },
            uDeep: { value: new THREE.Color(deep) },
            uSun: { value: sun },
            uReflect: { value: reflect },
            uCenter: { value: new THREE.Vector2(position[0], position[2]) },
            uFade: { value: fade },
            uWave: { value: wave },
            uSunColor: { value: new THREE.Color(sunColor) },
            uNightFade: { value: nightFade },
            uNight: { value: 0 },
            uSunDir: { value: new THREE.Vector3(0, 0.1, -1) },
          },
        ]),
        vertexShader: vertex,
        fragmentShader: fragment,
      },
    });
    const mat = r.material as THREE.ShaderMaterial;
    mat.fog = true;
    mat.transparent = fade > 0;
    mat.depthWrite = true;
    mat.uniforms.uNight = sky.uNight;
    mat.uniforms.uSunDir = sky.uSunDir;
    r.rotation.x = -Math.PI / 2;
    r.position.set(...position);
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, textureSize, sky]);

  useEffect(() => {
    const mat = mirror.material as THREE.ShaderMaterial;
    mat.uniforms.uDeep.value.set(deep);
    mat.uniforms.uReflect.value = reflect;
    mat.uniforms.uSun.value = sun;
    mat.uniforms.uDistort.value = distort;
    mat.uniforms.uWave.value = wave;
    mat.uniforms.uFade.value = fade;
  }, [mirror, deep, reflect, sun, distort, wave, fade]);

  useEffect(() => () => mirror.dispose(), [mirror]);

  const wp = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const u = (mirror.material as THREE.ShaderMaterial).uniforms;
    u.uTime.value = sceneTime.t;
    // il centro della dissolvenza dei bordi è in coordinate mondo
    mirror.getWorldPosition(wp);
    u.uCenter.value.set(wp.x, wp.z);
  });

  return <primitive object={mirror} />;
}
