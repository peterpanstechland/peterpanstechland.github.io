const embedded = new URLSearchParams(location.search).has('embed');
if (embedded) document.documentElement.classList.add('embedded');
import * as THREE from 'three';
import { GLTFLoader } from './vendor/three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from './vendor/three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from './vendor/three/examples/jsm/environments/RoomEnvironment.js';

const canvas = document.querySelector('#model-canvas');
const stage = document.querySelector('#stage');
const resetButton = document.querySelector('#reset-view');
const rotateToggle = document.querySelector('#auto-rotate');
const statusPanel = document.querySelector('#status-panel');
const statusTitle = document.querySelector('#status-title');
const statusDetail = document.querySelector('#status-detail');
const loadingMark = document.querySelector('#loading-mark');
const interactionHint = document.querySelector('#interaction-hint');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const modelURL = new URL('../assets/all-in-one/model.glb', import.meta.url);
let renderer;
let contextLost = false;
let inView = true;

function fail(title, detail) {
  document.documentElement.classList.remove('model-ready');
  statusPanel.hidden = false;
  statusPanel.classList.add('error');
  loadingMark.hidden = true;
  statusTitle.textContent = title;
  statusDetail.textContent = detail;
  resetButton.disabled = true;
  rotateToggle.disabled = true;
  document.querySelector('#retry-model').hidden = false;
}

try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch {
  fail('当前浏览器无法显示三维预览', '请启用 WebGL，或换用支持 WebGL 的浏览器。');
}

if (renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(embedded ? '#e9edde' : '#f5f3eb');
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.enablePan = false;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 1;

  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environmentMap = pmrem.fromScene(environment, 0.04);
  scene.environment = environmentMap.texture;
  environment.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x7c8068, 1.5));
  const keyLight = new THREE.DirectionalLight(0xfff8e9, 2.5);
  keyLight.position.set(3, 5, 4);
  scene.add(keyLight);

  let radius = 1;
  const modelSize = new THREE.Vector3(1, 1, 1);
  let ready = false;
  let frameID = null;
  let lastFrameTime = null;

  function frameModel() {
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const halfHorizontalFov = Math.atan(Math.tan(halfFov) * camera.aspect);
    const direction = new THREE.Vector3(1.6, 0.35, 1.3).normalize();
    const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
    const up = new THREE.Vector3().crossVectors(direction, right).normalize();
    // Fit the actual bounding box in the current camera basis, leaving a small margin.
    let distance = 0;
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
      const corner = new THREE.Vector3(x * modelSize.x / 2, y * modelSize.y / 2, z * modelSize.z / 2);
      const depth = corner.dot(direction);
      distance = Math.max(distance,
        depth + Math.abs(corner.dot(right)) * 1.1 / Math.tan(halfHorizontalFov),
        depth + Math.abs(corner.dot(up)) * 1.1 / Math.tan(halfFov));
    }
    camera.position.copy(direction.multiplyScalar(distance));
    camera.near = Math.max(radius / 100, 0.00001);
    camera.far = Math.max(distance + radius * 20, camera.near * 100);
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.minDistance = radius * 1.2;
    controls.maxDistance = distance * 5;
    controls.update();
    controls.saveState();
  }

  function resize() {
    const width = Math.max(stage.clientWidth, 1);
    const height = Math.max(stage.clientHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (ready) frameModel();
  }

  function syncMotionPreference() {
    if (reducedMotion.matches) rotateToggle.checked = false;
    rotateToggle.disabled = !ready || reducedMotion.matches;
    controls.autoRotate = ready && rotateToggle.checked && !reducedMotion.matches;
    interactionHint.textContent = reducedMotion.matches
      ? '拖动旋转 · 滚轮 / 双指缩放 · 已尊重减少动态效果设置'
      : '拖动旋转 · 滚轮 / 双指缩放';
  }

  function render(time) {
    frameID = null;
    if (document.hidden || !inView || contextLost) return;
    // The generated mesh is dense; cap visible rendering at approximately 30 fps.
    if (lastFrameTime !== null && time - lastFrameTime < 1000 / 30) {
      frameID = requestAnimationFrame(render);
      return;
    }
    const delta = lastFrameTime === null ? 0 : Math.min((time - lastFrameTime) / 1000, 0.1);
    lastFrameTime = time;
    controls.update(delta);
    renderer.render(scene, camera);
    frameID = requestAnimationFrame(render);
  }

  function resume() {
    if (!document.hidden && inView && !contextLost && frameID === null) {
      lastFrameTime = null;
      frameID = requestAnimationFrame(render);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if ((document.hidden || !inView) && frameID !== null) {
      cancelAnimationFrame(frameID);
      frameID = null;
      lastFrameTime = null;
    } else resume();
  });
  resetButton.addEventListener('click', frameModel);
  rotateToggle.addEventListener('change', syncMotionPreference);
  reducedMotion.addEventListener('change', syncMotionPreference);
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    contextLost = true;
    if (frameID !== null) cancelAnimationFrame(frameID);
    frameID = null;
    fail('三维显示暂时中断', '浏览器的图形上下文已丢失，请刷新页面重新载入。');
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (!inView && frameID !== null) {
        cancelAnimationFrame(frameID);
        frameID = null;
        lastFrameTime = null;
      } else resume();
    }).observe(stage);
  }
  new ResizeObserver(resize).observe(stage);
  resize();
  syncMotionPreference();
  resume();

  const manager = new THREE.LoadingManager();
  // Embedded GLB resources and sibling local files are allowed; remote assets are not.
  manager.setURLModifier((url) => {
    if (url.startsWith('blob:') || url.startsWith('data:')) return url;
    const resolved = new URL(url, modelURL);
    const directory = new URL('.', modelURL).pathname;
    if (resolved.origin !== modelURL.origin || !resolved.pathname.startsWith(directory)) {
      throw new Error('外部模型资源已禁用');
    }
    return resolved.href;
  });
  const loader = new GLTFLoader(manager);
  loader.load(modelURL.href, (gltf) => {
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    if (box.isEmpty() || !Number.isFinite(sphere.radius) || sphere.radius <= 0) {
      fail('模型没有可显示的几何内容', '请返回预览图，或稍后重新加载。');
      return;
    }
    const pivot = new THREE.Group();
    pivot.add(model);
    pivot.position.copy(sphere.center).negate();
    scene.add(pivot);
    radius = sphere.radius;
    box.getSize(modelSize);
    ready = true;
    frameModel();
    statusPanel.hidden = true;
    document.documentElement.classList.add('model-ready');
    resetButton.disabled = false;
    syncMotionPreference();
  }, (event) => {
    statusDetail.textContent = event.lengthComputable && event.total > 0
      ? `${Math.min(100, Math.round(event.loaded / event.total * 100))}%`
      : '正在读取本地 GLB 文件';
  }, () => {
    fail('暂时无法载入模型', '可以返回图片继续浏览，或点击下方按钮重试。');
  });
}

document.querySelector('#retry-model').addEventListener('click', () => location.reload());
