uniform float uTime;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;

varying vec3 vPos;
varying vec3 vViewDir;
varying float vFogDepth;

void main() {
  vec3 n = normalize(vPos);
  float fresnel = 1.0 - abs(dot(n, vViewDir));
  float phase = fresnel * 2.0 + dot(vPos, vec3(0.7, 1.1, 0.5)) * 0.3 + uTime * 0.1;
  vec3 color = 0.72 + 0.28 * cos(6.28318 * (phase + vec3(0.55, 0.65, 0.80)));
  float fog = smoothstep(uFogNear, uFogFar, vFogDepth);
  color = mix(color, uFogColor, fog);
  gl_FragColor = vec4(color, 1.0);
}
