varying vec3 vPos;
varying vec3 vViewDir;
varying float vFogDepth;

void main() {
  vPos = position;
  vViewDir = normalize(cameraPosition - position);
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  vFogDepth = -mvPos.z;
  gl_Position = projectionMatrix * mvPos;
}
