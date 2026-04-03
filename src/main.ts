import {
  WebGLRenderer,
  PerspectiveCamera,
  Scene,
  Color,
  Line,
  BufferGeometry,
  BufferAttribute,
  ShaderMaterial,
} from "three";
import vertexShader from "./shaders/vertex.glsl";
import fragmentShader from "./shaders/fragment.glsl";

const DIM = 5;
const BACK_COLOR = 0x08090d;
const CAM_DIST = 7;

type Edge = [number, number];

interface RawHypercube {
  cube: number[][];
  edges: Edge[];
}

interface Hypercube {
  index: number[];
  positions: Float32Array;
  verts: Float64Array;
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

function edgesToIndex(edges: Edge[], n: number): number[] {
  const m: number[][] = Array.from({ length: n }, () => []);
  const addEdge = ([a, b]: Edge): void => {
    m[a].push(b);
    m[b].push(a);
  };
  const removeEdge = ([a, b]: Edge): void => {
    m[a].splice(m[a].indexOf(b), 1);
    m[b].splice(m[b].indexOf(a), 1);
  };
  for (const edge of edges)
    addEdge(edge);
  for (const [i, es] of m.entries())
    if (es.length % 2)
      addEdge([i, es.find((v) => m[v].length % 2)!]);
  const index: number[] = [0];

  const getPath = (start: number): number[] => {
    const path: number[] = [];
    let loc = start;
    while (true) {
      path.push(loc);
      if (m[loc].length === 0)
        return path;
      const next = m[loc][0];
      removeEdge([loc, next]);
      loc = next;
    }
  };

  for (let i = 0; i < index.length; i++) {
    const start = index[i];
    if (m[start].length !== 0)
      index.splice(i, 1, ...getPath(start));
  }
  return index;
}

function makeIdentity(dim: number): Float64Array {
  const m = new Float64Array(dim * dim);
  for (let i = 0; i < dim; i++)
    m[i * dim + i] = 1;
  return m;
}

function makeHypercube(dim: number): Hypercube {
  const { cube, edges } = makeRawHypercube(dim);
  const n = cube.length;
  const verts = new Float64Array(n * dim);
  for (let i = 0; i < n; i++)
    for (let d = 0; d < dim; d++)
      verts[i * dim + d] = cube[i][d];
  return {
    index: edgesToIndex(edges, n),
    positions: new Float32Array(n * 3),
    verts,
  };
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
      for (let k = 0; k < dim; k++)
        sum += a[i * dim + k] * b[k * dim + j];
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
      for (let k = 0; k < dim; k++)
        sum += verts[off + k] * rot[k * dim + d];
      tempRow[d] = sum;
    }
    for (let d = 0; d < dim; d++)
      verts[off + d] = tempRow[d];
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

function resizeRendererToDisplaySize(renderer: WebGLRenderer): boolean {
  const canvas = renderer.domElement;
  const dpr = Math.min(window.devicePixelRatio, 2);
  const width = Math.floor(canvas.clientWidth * dpr);
  const height = Math.floor(canvas.clientHeight * dpr);
  const needResize = canvas.width !== width || canvas.height !== height;
  if (needResize)
    renderer.setSize(width, height, false);
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

const nVerts = 1 << DIM;
const rm = getTumbleMatrix(0.007, DIM);
const { index, positions, verts } = makeHypercube(DIM);
applyRotation(verts, getTumbleMatrix(Math.PI, DIM), nVerts, DIM);

const material = new ShaderMaterial({
  uniforms: {
    uTime: { value: 0.0 },
    uFogColor: { value: new Color(BACK_COLOR) },
    uFogNear: { value: 8.0 },
    uFogFar: { value: 11.0 },
  },
  vertexShader,
  fragmentShader,
});

const geometry = new BufferGeometry();
geometry.setAttribute("position", new BufferAttribute(positions, 3));
geometry.setIndex(index);

const line = new Line(geometry, material);
scene.add(line);

let mouseX = 0;
let mouseY = 0;
let targetMouseX = 0;
let targetMouseY = 0;

function onPointerMove(px: number, py: number): void {
  const rect = canvas.getBoundingClientRect();
  targetMouseX = ((px - rect.left) / rect.width) * 2 - 1;
  targetMouseY = ((py - rect.top) / rect.height) * 2 - 1;
}

canvas.addEventListener("mousemove", (e) => onPointerMove(e.clientX, e.clientY));
canvas.addEventListener("touchmove", (e) => {
  if (e.touches.length > 0)
    onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });
canvas.addEventListener("mouseleave", () => {
  targetMouseX = 0;
  targetMouseY = 0;
});
canvas.addEventListener("touchend", () => {
  targetMouseX = 0;
  targetMouseY = 0;
}, { passive: true });

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
  geometry.attributes.position.needsUpdate = true;

  if (resizeRendererToDisplaySize(renderer)) {
    const canvas = renderer.domElement;
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
  }

  renderer.render(scene, camera);
  requestAnimationFrame(renderLoop);
}

renderLoop();
canvas.style.opacity = "1";
