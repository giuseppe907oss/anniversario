/** Funzioni GLSL condivise: hash, value-noise, fbm. */
export const NOISE = /* glsl */ `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  float a = hash12(i), b = hash12(i+vec2(1,0)), c = hash12(i+vec2(0,1)), d = hash12(i+vec2(1,1));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0; float a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for(int i=0;i<4;i++){ v += a*vnoise(p); p = r*p*2.03; a *= 0.5; }
  return v;
}
`;

/** Gradiente del cielo crepuscolo → notte, usato da cielo e acqua. */
export const SKY_FN = /* glsl */ `
uniform float uNight;
uniform vec3 uSunDir;
vec3 skyColor(vec3 d){
  float h = d.y;
  // crepuscolo
  vec3 zD = vec3(0.03, 0.03, 0.075);
  vec3 mD = vec3(0.17, 0.085, 0.16);
  vec3 hD = vec3(0.78, 0.36, 0.24);
  // notte
  vec3 zN = vec3(0.006, 0.007, 0.018);
  vec3 mN = vec3(0.018, 0.02, 0.05);
  vec3 hN = vec3(0.11, 0.06, 0.10);
  vec3 z = mix(zD, zN, uNight), m = mix(mD, mN, uNight), hc = mix(hD, hN, uNight);
  float t = clamp(h, 0.0, 1.0);
  vec3 col = mix(hc, m, smoothstep(0.0, 0.18, t));
  col = mix(col, z, smoothstep(0.12, 0.75, t));
  // alone del sole basso sull'orizzonte
  float s = max(dot(d, uSunDir), 0.0);
  vec3 sunCol = mix(vec3(1.0, 0.72, 0.42), vec3(0.45, 0.18, 0.25), uNight);
  col += sunCol * (pow(s, 8.0) * 0.45 + pow(s, 80.0) * 1.6) * (1.0 - uNight * 0.85) * smoothstep(-0.1, 0.2, h + 0.1);
  // sotto l'orizzonte: foschia
  col = mix(col, hc * 0.55, smoothstep(0.0, -0.08, h));
  return col;
}
`;
