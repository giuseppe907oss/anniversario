"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { NOISE } from "../shaders/common";
import { sceneTime } from "../clock";

/** Fascio di luce volumetrico finto: cono additivo con polvere in sospensione. */
export function LightShaft({
  position = [0, 4, 0],
  height = 5,
  radiusTop = 0.15,
  radiusBottom = 1.6,
  color = "#ffd9a8",
  opacity = 0.18,
  rotation = [0, 0, 0],
}: {
  position?: [number, number, number];
  height?: number;
  radiusTop?: number;
  radiusBottom?: number;
  color?: THREE.ColorRepresentation;
  opacity?: number;
  rotation?: [number, number, number];
}) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        fog: false,
        uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uTime: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv; varying vec3 vN; varying vec3 vV;
          void main(){
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vN = normalize(mat3(modelMatrix) * normal);
            vV = normalize(cameraPosition - wp.xyz);
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; uniform float uOpacity; uniform float uTime;
          varying vec2 vUv; varying vec3 vN; varying vec3 vV;
          ${NOISE}
          void main(){
            float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
            float along = smoothstep(0.0, 0.25, vUv.y) * pow(vUv.y, 0.6);
            float dust = 0.75 + 0.25 * fbm(vec2(vUv.x * 8.0, vUv.y * 3.0 - uTime * 0.05));
            float a = edge * along * dust * uOpacity;
            gl_FragColor = vec4(uColor * a, a);
          }`,
      }),
    [color, opacity],
  );
  useFrame(() => {
    mat.uniforms.uTime.value = sceneTime.t;
  });
  return (
    <mesh position={position} rotation={rotation} material={mat} renderOrder={7}>
      <cylinderGeometry args={[radiusTop, radiusBottom, height, 32, 1, true]} />
    </mesh>
  );
}
