import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

let scene;
let camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
let renderer = new THREE.WebGLRenderer();
let model = new THREE.Mesh();
let counter = 0;
let hdrPMREMRenderTarget;
let hdrEquirectangularMap;
let controls;
const params = {
    rotate: true,
    heatMap: false
};

const heatMapvertexShader = `
    uniform mat4 observationViewMatrix;
    uniform mat4 observationProjectionMatrix;
    varying vec4 v_observationPosition;
    void main()
    {
        v_observationPosition = observationProjectionMatrix * observationViewMatrix * modelViewMatrix * vec4(position, 1.0);

        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

    }
`;

const heatMapfragmentShader = `
    uniform sampler2D observationTexture;
    uniform float viewportWidth;
    uniform float viewportHeight;
    varying vec4 v_observationPosition;

    void main()
    {
        // Sample mask texture
        vec2 maskUV = v_observationPosition.xy / v_observationPosition.w; // Convert observation space position to NDC
        vec4 maskColor = texture2D(observationTexture, maskUV);
        
        // Check if mask is black (assuming black means don't paint)
        if (maskColor.r < 0.1 && maskColor.g < 0.1 && maskColor.b < 0.1) {
            discard; // Discard fragment if mask is black
        }
        
        // Otherwise, continue with normal rendering
        gl_FragColor = vec4(1.0); // Example color; replace with your fragment shader logic
    }
`;

const planevertexShader = `
    uniform mat4 observationViewMatrix;
    uniform mat4 observationProjectionMatrix;
    varying vec4 v_observationPosition;
    varying vec2 v_uv;

    void main() {
        v_uv = uv;

        // Transform vertex position to observation space
        v_observationPosition = observationProjectionMatrix * observationViewMatrix * vec4(position, 1.0);
        
        // Set gl_Position for normal rendering (clip space)
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const planefragmentShader = `
    uniform sampler2D observationTexture;
    uniform float viewportWidth;
    uniform float viewportHeight;
    uniform float viewportAspectRatio;
    varying vec2 v_uv;
    varying vec4 v_observationPosition;

    void main() {
        vec2 newUv = v_observationPosition.xy / v_observationPosition.w;
        
        newUv.y = newUv.y / (2.0*viewportAspectRatio);
        newUv = newUv * 0.5 + 0.5;

        gl_FragColor = texture2D(observationTexture, newUv);
    }
`;

const heatMapUniforms = {
    observationViewMatrix: { value: new THREE.Matrix4() },
    observationProjectionMatrix: { value: new THREE.Matrix4() },
    observationTexture: { value: new THREE.Texture() },
    viewportWidth: { value: window.innerWidth },
    viewportHeight: { value: window.innerHeight },
    viewportAspectRatio: { value: window.innerWidth / window.innerHeight }
}

const standardMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 1.0,
    roughness: 0.5
});

const heatMapMaterial = new THREE.ShaderMaterial(
    {
        uniforms: heatMapUniforms,
        vertexShader: heatMapvertexShader,
        fragmentShader: heatMapfragmentShader,
    }
)

const heatMapPlaneMaterial = new THREE.ShaderMaterial(
    {
        uniforms: heatMapUniforms,
        vertexShader: planevertexShader,
        fragmentShader: planefragmentShader,
    }
)

let currentMaterial = standardMaterial;

function getRendererParams() {
    return params;
}

// function ToggleHeatMap() {
//     params.heatMap = !params.heatMap;

//     if (params.heatMap) {
//         currentMaterial = heatMapMaterial;
//     }
//     else {
//         currentMaterial = standardMaterial;
//     }
// }

function animate() {
    counter += 0.005;

    if (!model) return;

    if (params.rotate) {
        model.rotation.y = counter;
    }

    if (params.heatMap) {
        currentMaterial = heatMapMaterial;
        model.material = currentMaterial;
    }
    else {
        currentMaterial = standardMaterial;
        model.material = currentMaterial;
    }

    renderer.render(scene, camera);
}



function setupRenderer() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer();
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    THREE.DefaultLoadingManager.onLoad = function () {

        pmremGenerator.dispose();

    };

    hdrEquirectangularMap = new RGBELoader()
        .load('studio_small_04_4k.hdr', function () {
            //.load('spruit_sunrise_1k.hdr', function () {
            hdrPMREMRenderTarget = pmremGenerator.fromEquirectangular(hdrEquirectangularMap);
            hdrEquirectangularMap.mapping = THREE.EquirectangularReflectionMapping;
            hdrEquirectangularMap.minFilter = THREE.LinearFilter;
            hdrEquirectangularMap.magFilter = THREE.LinearFilter;
            hdrEquirectangularMap.needsUpdate = true;
        });

    scene.environment = hdrEquirectangularMap;
    scene.background = hdrEquirectangularMap;
    renderer.toneMappingExposure = 1.0;

    const envTexture = new THREE.CubeTextureLoader().load([
        'box.png',
        'box.png',
        'box2.png',
        'box2.png',
        'box.png',
        'box.png',
    ])

    scene.background = envTexture

    //=====================================
    camera.position.z = 3;

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 0.5;
    controls.maxDistance = 10;

    window.addEventListener('resize', onWindowResize);
}

function onToggleRotation() {
    params.rotate = !params.rotate;
}

function onWindowResize() {

    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);

}

function addObservationToRenderer(data) {

    const { x: px, y: py, z: pz } = data.cameraPosition;
    const { x: rx, y: ry, z: rz } = data.cameraRotation;

    // Create position vector
    const position = new THREE.Vector3(px, py, pz);

    // Create rotation quaternion
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));

    // Create Matrix4
    const observationTransformMatrix = new THREE.Matrix4();
    observationTransformMatrix.compose(position, rotation, new THREE.Vector3(1, 1, 1));

    const aspectRatio = data.cameraWidth / data.cameraHeight;
    const observationperspectiveMatrix = new THREE.Matrix4();
    observationperspectiveMatrix.makePerspective(
        -0.5,  // left
        0.5,   // right
        -0.5 / aspectRatio, // bottom
        0.5 / aspectRatio,  // top
        data.cameraNear,        // near
        data.cameraFar          // far
    );

    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(data.map);

    heatMapUniforms.observationViewMatrix.value = observationTransformMatrix;
    heatMapUniforms.observationProjectionMatrix.value = observationperspectiveMatrix;
    heatMapUniforms.observationTexture.value = texture;
    heatMapUniforms.viewportWidth.value = data.cameraWidth;
    heatMapUniforms.viewportHeight.value = data.cameraHeight;
    heatMapUniforms.viewportAspectRatio.value = aspectRatio;

    let planeMesh = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), heatMapPlaneMaterial);
    scene.add(planeMesh);
    planeMesh.position.set(px, py, pz);
    planeMesh.rotation.set(rx, ry, rz);

}

function uploadSTL(path) {
    const loader = new STLLoader()
    loader.load(
        'randomShape.stl',
        function (geometry) {
            model = new THREE.Mesh(geometry, currentMaterial);
            scene.add(model)
        },
        (xhr) => {
            console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
        },
        (error) => {
            console.log(error)
        }
    )
}
// export default { setupRenderer, getRendererParams };
export { setupRenderer, getRendererParams, addObservationToRenderer, uploadSTL };