attribute vec3 instanceStart;
attribute vec3 instanceEnd;

uniform float uLineWidth;
uniform vec2 uResolution;

varying vec3 vPos;
varying vec3 vViewDir;
varying float vFogDepth;

void main() {
  vec3 pos = (position.y < 0.5) ? instanceStart : instanceEnd;

  vPos = pos;
  vViewDir = normalize(cameraPosition - pos);

  vec4 viewStart = modelViewMatrix * vec4(instanceStart, 1.0);
  vec4 viewEnd = modelViewMatrix * vec4(instanceEnd, 1.0);
  vec4 clipStart = projectionMatrix * viewStart;
  vec4 clipEnd = projectionMatrix * viewEnd;

  vFogDepth = -((position.y < 0.5) ? viewStart.z : viewEnd.z);

  float aspect = uResolution.x / uResolution.y;
  vec2 dir = clipEnd.xy / clipEnd.w - clipStart.xy / clipStart.w;
  dir.x *= aspect;
  dir = normalize(dir);

  vec2 offset = vec2(-dir.y, dir.x);
  offset.x /= aspect;
  offset *= position.x * uLineWidth / uResolution.y;

  vec4 clip = (position.y < 0.5) ? clipStart : clipEnd;
  clip.xy += offset * clip.w;

  gl_Position = clip;
}
