const DIM = 5;
const BACK_COLOR = 0x081d58;
const CUBE_COLOR = 0xfee391;

function makeRawHypercube(dim) {
    if (dim == 1) return { cube: [[1], [-1]], edges: [[0, 1]] };
    const { cube, edges } = makeRawHypercube(dim - 1);
    return {
        cube: [...cube.map((v) => [...v, 1]), ...cube.map((v) => [...v, -1])],
        edges: [
            ...edges,
            ...edges.map((e) => [e[0] + cube.length, e[1] + cube.length]),
            ...cube.map((_, i) => [i, i + cube.length]),
        ],
    };
}

function edgesToIndex(edges, n) {
    console.log(edges);
    const m = Array.from({ length: n }, () => []);
    const add_edge = (e) => {
        console.log({ add: e.toString() });
        m[e[0]].push(e[1]);
        m[e[1]].push(e[0]);
    };
    const remove_edge = (e) => {
        console.log({ remove: e.toString() });
        m[e[0]].splice(m[e[0]].indexOf(e[1]), 1);
        m[e[1]].splice(m[e[1]].indexOf(e[0]), 1);
    };
    edges.forEach(add_edge);
    m.forEach((es, i) => {
        if (es.length % 2) {
            add_edge([i, es.find((n) => m[n].length % 2)]);
        }
    });
    console.log(m);
    const index = [0];

    const get_path = (start) => {
        const path = [];
        let loc = start;
        while (true) {
            path.push(loc);
            if (m[loc].length === 0) {
                return path;
            }
            let next = m[loc][0];
            remove_edge([loc, next]);
            loc = next;
        }
    };

    for (let i = 0; i < index.length; i++) {
        const start = index[i];
        if (m[start].length !== 0) {
            const path = get_path(start);
            index.splice(i, 1, ...path);
        }
    }

    console.log({ index });

    return index;
}

function makeHypercube(dim) {
    const { cube, edges } = makeRawHypercube(dim);
    return {
        index: edgesToIndex(edges, cube.length),
        vertices: new Float32Array(Array(cube.length * 3).fill(0)),
        matrix: math.matrix(cube),
    };
}

function getRotationMatrix(theta, dim1, dim2, dims) {
    const mat = math.identity(dims);
    mat.set([dim1, dim1], math.cos(theta));
    mat.set([dim2, dim2], math.cos(theta));
    mat.set([dim1, dim2], -math.sin(theta));
    mat.set([dim2, dim1], math.sin(theta));
    return mat;
}

function writePositionArray(matrix, position) {
    matrix.rows().forEach((r, i) => {
        position[i * 3] = r.get([0, 0]);
        position[i * 3 + 1] = r.get([0, 1]);
        position[i * 3 + 2] = r.get([0, 2]);
    });
}

function getTumbleMatrix(maxTheta, dims) {
    let mat = math.identity(dims);
    for (let i = 0; i < dims; i++) {
        for (let j = i + 1; j < dims; j++) {
            const theta = Math.random() * maxTheta * 2 - maxTheta;
            const rotationIJ = getRotationMatrix(theta, i, j, dims);
            mat = math.multiply(mat, rotationIJ);
        }
    }
    return mat;
}

function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
        renderer.setSize(width, height, false);
    }
    return needResize;
}

//function init() {
const canvas = document.querySelector("#canvas");
const renderer = new THREE.WebGLRenderer({
    antiailias: true,
    canvas: canvas,
});

const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    1,
    500
);
camera.position.set(0, 0, 10);
camera.lookAt(0, 0, 0);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(BACK_COLOR, 8, 15);
scene.background = new THREE.Color(BACK_COLOR);

const rm = getTumbleMatrix(0.01, DIM);
const im = getTumbleMatrix(Math.PI, DIM);
const { index, vertices, matrix } = makeHypercube(DIM);
let m = math.multiply(matrix, im);
//create a blue LineBasicMaterial
const material = new THREE.LineBasicMaterial({ color: CUBE_COLOR });

const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
geometry.setIndex(index);

const line = new THREE.Line(geometry, material);

scene.add(line);

function renderLoop() {
    m = math.multiply(m, rm);
    //console.log(m)
    writePositionArray(m, geometry.attributes.position.array);
    geometry.attributes.position.needsUpdate = true;
    //console.log(vectors)
    // for (let i = 0; i < butterflies.length; i++) {
    //   butterflies[i].animate();
    // }
    renderer.render(scene, camera);

    if (resizeRendererToDisplaySize(renderer)) {
        const canvas = renderer.domElement;
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
      }

    requestAnimationFrame(renderLoop);
}

renderLoop();
// };

// init();
