import {
  WebGLRenderer,
  PerspectiveCamera,
  Scene,
  Color,
  DoubleSide,
  Mesh,
  InstancedBufferGeometry,
  InstancedBufferAttribute,
  Float32BufferAttribute,
  ShaderMaterial,
  Vector2,
} from "three";
import vertexShader from "./shaders/vertex.glsl";
import fragmentShader from "./shaders/fragment.glsl";

const DIM = 5;
const BACK_COLOR = 0x08090d;
const CAM_DIST = 7;
const LINE_WIDTH = 1.4;

type Edge = [number, number];

interface RawHypercube {
  cube: number[][];
  edges: Edge[];
}

function makeRawHypercube(dim: number): RawHypercube {
  if (dim === 1) return { cube: [[1], [-1]], edges: [[0, 1]] };
  const { cube, edges } = makeRawHypercube(dim - 1);
  return {
    cube: [...cube.map((v) => [...v, 1]), ...cube.map((v) => [...v, -1])],
    edges: [
      ...edges,
      ...edges.map((e): Edge => [e[0] + cube.length, e[1] + cube.length]),
      ...cube.map((_, i): Edge => [i, i + cube.length]),
    ],
  };
}

function makeIdentity(dim: number): Float64Array {
  const m = new Float64Array(dim * dim);
  for (let i = 0; i < dim; i++) m[i * dim + i] = 1;
  return m;
}

function matMulSquare(
  a: Float64Array,
  b: Float64Array,
  dim: number,
): Float64Array {
  const out = new Float64Array(dim * dim);
  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) {
      let sum = 0;
      for (let k = 0; k < dim; k++) sum += a[i * dim + k] * b[k * dim + j];
      out[i * dim + j] = sum;
    }
  }
  return out;
}

function getRotationMatrix(
  theta: number,
  dim1: number,
  dim2: number,
  dims: number,
): Float64Array {
  const mat = makeIdentity(dims);
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  mat[dim1 * dims + dim1] = c;
  mat[dim2 * dims + dim2] = c;
  mat[dim1 * dims + dim2] = -s;
  mat[dim2 * dims + dim1] = s;
  return mat;
}

function getTumbleMatrix(maxTheta: number, dims: number): Float64Array {
  let mat = makeIdentity(dims);
  for (let i = 0; i < dims; i++) {
    for (let j = i + 1; j < dims; j++) {
      const theta = Math.random() * maxTheta * 2 - maxTheta;
      mat = matMulSquare(mat, getRotationMatrix(theta, i, j, dims), dims);
    }
  }
  return mat;
}

const tempRow = new Float64Array(DIM);

function applyRotation(
  verts: Float64Array,
  rot: Float64Array,
  nVerts: number,
  dim: number,
): void {
  for (let i = 0; i < nVerts; i++) {
    const off = i * dim;
    for (let d = 0; d < dim; d++) {
      let sum = 0;
      for (let k = 0; k < dim; k++) sum += verts[off + k] * rot[k * dim + d];
      tempRow[d] = sum;
    }
    for (let d = 0; d < dim; d++) verts[off + d] = tempRow[d];
  }
}

function writePositions(
  verts: Float64Array,
  positions: Float32Array,
  nVerts: number,
  dim: number,
): void {
  for (let i = 0; i < nVerts; i++) {
    const srcOff = i * dim;
    const dstOff = i * 3;
    positions[dstOff] = verts[srcOff];
    positions[dstOff + 1] = verts[srcOff + 1];
    positions[dstOff + 2] = verts[srcOff + 2];
  }
}

function writeSegments(
  edges: Edge[],
  positions: Float32Array,
  starts: Float32Array,
  ends: Float32Array,
): void {
  for (let i = 0; i < edges.length; i++) {
    const [a, b] = edges[i];
    const sa = a * 3;
    const sb = b * 3;
    const d = i * 3;
    starts[d] = positions[sa];
    starts[d + 1] = positions[sa + 1];
    starts[d + 2] = positions[sa + 2];
    ends[d] = positions[sb];
    ends[d + 1] = positions[sb + 1];
    ends[d + 2] = positions[sb + 2];
  }
}

function resizeRendererToDisplaySize(renderer: WebGLRenderer): boolean {
  const canvas = renderer.domElement;
  const dpr = Math.min(window.devicePixelRatio, 2);
  const width = Math.floor(canvas.clientWidth * dpr);
  const height = Math.floor(canvas.clientHeight * dpr);
  const needResize = canvas.width !== width || canvas.height !== height;
  if (needResize) renderer.setSize(width, height, false);
  return needResize;
}

const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!;
const renderer = new WebGLRenderer({
  antialias: true,
  canvas,
});

const camera = new PerspectiveCamera(45, canvas.width / canvas.height, 1, 500);
camera.position.set(0, 0, CAM_DIST);
camera.lookAt(0, 0, 0);

const scene = new Scene();
scene.background = new Color(BACK_COLOR);

const { cube, edges } = makeRawHypercube(DIM);
const nVerts = cube.length;
const nSegments = edges.length;

const verts = new Float64Array(nVerts * DIM);
for (let i = 0; i < nVerts; i++)
  for (let d = 0; d < DIM; d++) verts[i * DIM + d] = cube[i][d];

const positions = new Float32Array(nVerts * 3);
const segStarts = new Float32Array(nSegments * 3);
const segEnds = new Float32Array(nSegments * 3);

const rm = getTumbleMatrix(0.007, DIM);
applyRotation(verts, getTumbleMatrix(Math.PI, DIM), nVerts, DIM);

const geometry = new InstancedBufferGeometry();
geometry.setAttribute(
  "position",
  new Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0], 3),
);
geometry.setIndex([0, 1, 2, 0, 2, 3]);
const segStartAttr = new InstancedBufferAttribute(segStarts, 3);
const segEndAttr = new InstancedBufferAttribute(segEnds, 3);
geometry.setAttribute("instanceStart", segStartAttr);
geometry.setAttribute("instanceEnd", segEndAttr);

const material = new ShaderMaterial({
  uniforms: {
    uTime: { value: 0.0 },
    uFogColor: { value: new Color(BACK_COLOR) },
    uFogNear: { value: 6.0 },
    uFogFar: { value: 10.0 },
    uLineWidth: { value: LINE_WIDTH },
    uResolution: {
      value: new Vector2(canvas.clientWidth, canvas.clientHeight),
    },
  },
  vertexShader,
  fragmentShader,
  side: DoubleSide,
});

const mesh = new Mesh(geometry, material);
mesh.frustumCulled = false;
scene.add(mesh);

let mouseX = 0;
let mouseY = 0;
let targetMouseX = 0;
let targetMouseY = 0;

function onPointerMove(px: number, py: number): void {
  const rect = canvas.getBoundingClientRect();
  targetMouseX = ((px - rect.left) / rect.width) * 2 - 1;
  targetMouseY = ((py - rect.top) / rect.height) * 2 - 1;
}

canvas.addEventListener("mousemove", (e) =>
  onPointerMove(e.clientX, e.clientY),
);
canvas.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length > 0)
      onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
  },
  { passive: true },
);
canvas.addEventListener("mouseleave", () => {
  targetMouseX = 0;
  targetMouseY = 0;
});
canvas.addEventListener(
  "touchend",
  () => {
    targetMouseX = 0;
    targetMouseY = 0;
  },
  { passive: true },
);

function renderLoop(): void {
  mouseX += (targetMouseX - mouseX) * 0.08;
  mouseY += (targetMouseY - mouseY) * 0.08;

  const azimuth = mouseX * Math.PI * 0.4;
  const elevation = -mouseY * Math.PI * 0.25;
  camera.position.set(
    CAM_DIST * Math.sin(azimuth) * Math.cos(elevation),
    CAM_DIST * Math.sin(elevation),
    CAM_DIST * Math.cos(azimuth) * Math.cos(elevation),
  );
  camera.lookAt(0, 0, 0);

  material.uniforms.uTime.value = performance.now() * 0.001;

  applyRotation(verts, rm, nVerts, DIM);
  writePositions(verts, positions, nVerts, DIM);
  writeSegments(edges, positions, segStarts, segEnds);
  segStartAttr.needsUpdate = true;
  segEndAttr.needsUpdate = true;

  if (resizeRendererToDisplaySize(renderer)) {
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
  }
  material.uniforms.uResolution.value.set(
    canvas.clientWidth,
    canvas.clientHeight,
  );

  renderer.render(scene, camera);
  requestAnimationFrame(renderLoop);
}

renderLoop();
canvas.style.opacity = "1";
