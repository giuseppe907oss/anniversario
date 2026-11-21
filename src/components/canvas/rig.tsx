"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Impianto luci unico e persistente per tutto il canvas.
 * Il numero di luci non cambia mai → nessuna ricompilazione degli shader
 * quando si passa da una scena all'altra. Ogni scena scrive qui i propri valori.
 */
export const rig = {
  hemiSky: new THREE.Color("#3a2f45"),
  hemiGround: new THREE.Color("#09090d"),
  hemi: 0.4,
  keyColor: new THREE.Color("#ffd9a8"),
  key: 1.2,
  keyPos: new THREE.Vector3(4, 6, 4),
  keyTarget: new THREE.Vector3(0, 0, 0),
  aColor: new THREE.Color("#ffb070"),
  a: 0,
  aPos: new THREE.Vector3(0, 2, 2),
  aDist: 10,
  bColor: new THREE.Color("#d6a7b3"),
  b: 0,
  bPos: new THREE.Vector3(0, 2, -2),
  bDist: 10,
  fog: new THREE.Color("#09090d"),
  fogDensity: 0.02,
  exposure: 1,
  /** Spostamento verticale dell'inquadratura (frazione dello schermo): su iPhone il soggetto sale. */
  viewShift: 0,
  /** Spostamento orizzontale (desktop): il soggetto si sposta dal lato opposto alla scheda. */
  viewShiftX: 0,
};

export function Rig() {
  const hemi = useRef<THREE.HemisphereLight>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const a = useRef<THREE.PointLight>(null);
  const b = useRef<THREE.PointLight>(null);
  const { scene, gl, camera, size } = useThree();
  const lastShift = useRef(-1);

  useEffect(() => {
    scene.fog = new THREE.FogExp2(rig.fog.getHex(), rig.fogDensity);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  useFrame(() => {
    if (hemi.current) {
      hemi.current.color.copy(rig.hemiSky);
      hemi.current.groundColor.copy(rig.hemiGround);
      hemi.current.intensity = rig.hemi;
    }
    if (key.current) {
      key.current.color.copy(rig.keyColor);
      key.current.intensity = rig.key;
      key.current.position.copy(rig.keyPos);
      key.current.target.position.copy(rig.keyTarget);
      key.current.target.updateMatrixWorld();
    }
    if (a.current) {
      a.current.color.copy(rig.aColor);
      a.current.intensity = rig.a;
      a.current.position.copy(rig.aPos);
      a.current.distance = rig.aDist;
    }
    if (b.current) {
      b.current.color.copy(rig.bColor);
      b.current.intensity = rig.b;
      b.current.position.copy(rig.bPos);
      b.current.distance = rig.bDist;
    }
    const fog = scene.fog as THREE.FogExp2 | null;
    if (fog) {
      fog.color.copy(rig.fog);
      fog.density = rig.fogDensity;
    }
    gl.toneMappingExposure = rig.exposure;
    const pc = camera as THREE.PerspectiveCamera;
    const sy = Math.round(rig.viewShift * size.height);
    const sx = Math.round(rig.viewShiftX * size.width);
    const shiftKey = sx * 100000 + sy;
    if (shiftKey !== lastShift.current || ((sx || sy) && (!pc.view || pc.view.fullHeight !== size.height || pc.view.fullWidth !== size.width))) {
      lastShift.current = shiftKey;
      if (sx || sy) pc.setViewOffset(size.width, size.height, sx, sy, size.width, size.height);
      else pc.clearViewOffset();
    }
  }, -1);

  return (
    <>
      <hemisphereLight ref={hemi} />
      <directionalLight ref={key} />
      <pointLight ref={a} decay={1.6} />
      <pointLight ref={b} decay={1.6} />
    </>
  );
}

/* --------------------------- utilità di camera --------------------------- */

const _t = new THREE.Vector3();
/** Fattore di distanza per inquadrature verticali (iPhone): allontana la camera. */
export function portraitFactor(aspect: number, base = 0.85) {
  return THREE.MathUtils.clamp(base / aspect, 1, 2.2);
}

export function placeCamera(
  camera: THREE.Camera,
  pos: THREE.Vector3,
  target: THREE.Vector3,
  fov?: number,
) {
  camera.position.copy(pos);
  _t.copy(target);
  camera.lookAt(_t);
  const pc = camera as THREE.PerspectiveCamera;
  if (fov && Math.abs(pc.fov - fov) > 0.01) {
    pc.fov = fov;
    pc.updateProjectionMatrix();
  }
}

export const damp = THREE.MathUtils.damp;
export const smooth = (x: number) => {
  const t = THREE.MathUtils.clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeInOut = (x: number) => {
  const t = THREE.MathUtils.clamp(x, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
