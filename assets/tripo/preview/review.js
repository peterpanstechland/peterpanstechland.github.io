import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const stage = document.querySelector('#stage');
const status = document.querySelector('#status');
const issues = document.querySelector('#issues');
const set = (id, value) => { document.getElementById(id).textContent = value; };
const vector = (value) => value.toArray().map((n) => Number(n.toFixed(5))).join(' / ');
const fail = (message) => {
  stage.dataset.state = 'error';
  status.textContent = message;
  issues.textContent = '未能完成模型验收。请检查上方错误信息及本地文件。';
};

async function start() {
  const modelPath = new URLSearchParams(location.search).get('model');
  if (!modelPath || !/^models\/[a-zA-Z0-9_./ -]+\.glb$/i.test(modelPath) || modelPath.split('/').includes('..')) {
    fail('请通过 ?model=models/…/model.glb 指定本地真实 GLB。');
    return;
  }
  const modelURL = new URL(modelPath, location.href);
  const allowedPrefix = new URL('./models/', location.href).href;
  if (modelURL.origin !== location.origin || !modelURL.href.startsWith(allowedPrefix)) throw new Error('仅允许加载 models 目录内的本地模型。');
  set('source', modelPath);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.prepend(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    fail('WebGL 上下文已丢失。请刷新页面或关闭其他占用显卡的标签页。');
  });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#272a2f');
  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(environment, 0.04);
  scene.environment = envMap.texture;
  environment.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x686b70, 1.3));
  const key = new THREE.DirectionalLight(0xffffff, 3);
  key.position.set(5, 8, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.1, far: 30 });
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 1);
  fill.position.set(-5, 3, -3);
  scene.add(fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#33373c', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.015;
  ground.receiveShadow = true;
  scene.add(ground);
  const axes = new THREE.AxesHelper(5);
  axes.visible = false;
  scene.add(axes);
  document.querySelector('#axes').addEventListener('change', (event) => { axes.visible = event.target.checked; });

  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 300);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 0.6;
  controls.maxDistance = 35;
  let targetHeight = 2;
  const directions = {
    front: [0, 0, 1], back: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0],
    top: [0, 1, 0.0001], 'three-quarter': [1, 0.6, 1],
  };
  const view = (name) => {
    const direction = new THREE.Vector3(...directions[name]).normalize();
    const vertical = THREE.MathUtils.degToRad(camera.fov);
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect);
    const distance = 2.6 / Math.sin(Math.min(vertical, horizontal) / 2);
    controls.target.set(0, targetHeight, 0);
    camera.up.set(0, 1, 0);
    camera.position.copy(controls.target).addScaledVector(direction, distance);
    controls.update();
  };
  const resize = () => {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage);
  resize();
  view('three-quarter');
  const clock = new THREE.Clock();
  let mixer = null;
  let activeAction = null;
  renderer.setAnimationLoop(() => {
    const delta = Math.min(clock.getDelta(), 0.1);
    if (mixer && activeAction) mixer.update(delta);
    controls.update();
    renderer.render(scene, camera);
  });
  for (const button of document.querySelectorAll('[data-view]')) {
    button.addEventListener('click', () => view(button.dataset.view));
  }

  stage.dataset.state = 'loading';
  status.textContent = '正在读取真实 GLB 与内嵌纹理…';
  const resourceErrors = [];
  const manager = new THREE.LoadingManager();
  manager.onError = (url) => { resourceErrors.push(url); };
  let loadingTimeout;
  const gltf = await Promise.race([
    new GLTFLoader(manager).loadAsync(modelURL.href, (event) => {
      if (stage.dataset.state === 'error') return;
      status.textContent = event.total
        ? `正在加载真实 GLB… ${Math.round(event.loaded / event.total * 100)}%`
        : `正在加载真实 GLB… ${(event.loaded / 1048576).toFixed(1)} MB`;
    }),
    new Promise((_, reject) => {
      loadingTimeout = window.setTimeout(() => reject(new Error('GLB 加载超时（90 秒）。请确认本地文件与服务可用。')), 90000);
    }),
  ]).finally(() => window.clearTimeout(loadingTimeout));
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  const rawBounds = new THREE.Box3().setFromObject(model, true);
  const rawSize = rawBounds.getSize(new THREE.Vector3());
  const rawCenter = rawBounds.getCenter(new THREE.Vector3());
  if (rawBounds.isEmpty() || !rawSize.toArray().every(Number.isFinite) || rawSize.lengthSq() === 0) {
    throw new Error('GLB 无有效可见几何边界。');
  }
  const textures = new Set();
  const bones = new Set();
  const boneNodes = [];
  const originalTransforms = new Map();
  let meshes = 0;
  let triangles = 0;
  let skinnedMeshes = 0;
  model.traverse((node) => {
    originalTransforms.set(node.uuid, {
      node, position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone(),
      morphTargetInfluences: node.morphTargetInfluences?.slice(),
    });
    if (node.isBone) {
      bones.add(node.uuid);
      boneNodes.push(node);
    }
    if (!node.isMesh) return;
    meshes++;
    if (node.isSkinnedMesh) skinnedMeshes++;
    const count = node.geometry.index?.count ?? node.geometry.attributes.position?.count ?? 0;
    triangles += Math.floor(count / 3) * (node.isInstancedMesh ? node.count : 1);
    node.castShadow = true;
    node.receiveShadow = true;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value.uuid);
    }
  });

  const scale = 4 / Math.max(rawSize.x, rawSize.y, rawSize.z);
  const display = new THREE.Group();
  display.add(model);
  display.scale.setScalar(scale);
  display.position.set(-rawCenter.x * scale, -rawBounds.min.y * scale, -rawCenter.z * scale);
  scene.add(display);
  targetHeight = rawSize.y * scale / 2;
  view('three-quarter');
  set('meshes', meshes.toLocaleString());
  set('triangles', triangles.toLocaleString());
  set('textures', `${textures.size} 个纹理对象 / ${gltf.parser.json.images?.length ?? 0} 张图片`);
  set('skins', `${gltf.parser.json.skins?.length ?? 0}（${skinnedMeshes} 个蒙皮 Mesh）`);
  set('bones', bones.size);
  set('animations', `${gltf.animations.length}${gltf.animations.length ? '\n' + gltf.animations.map((clip) => `${clip.name || '未命名'} · ${clip.duration.toFixed(2)}s`).join('\n') : '（未包含动画片段）'}`);
  set('size', vector(rawSize));
  set('minimum', vector(rawBounds.min));
  set('maximum', vector(rawBounds.max));
  set('scale', `${scale.toFixed(5)} ×（仅显示）`);
  for (const button of document.querySelectorAll('[data-view]')) button.disabled = false;
  stage.dataset.state = resourceErrors.length ? 'ready-with-errors' : 'ready';
  status.textContent = resourceErrors.length ? 'GLB 已解析，但存在纹理 / 资源加载失败。' : 'GLB 加载成功 · 可旋转检查几何与贴图';
  issues.textContent = resourceErrors.length ? `资源错误：${resourceErrors.join(', ')}` : '';
  window.assetReview = {
    modelPath, state: stage.dataset.state, meshes, triangles, textures: textures.size,
    images: gltf.parser.json.images?.length ?? 0, skins: gltf.parser.json.skins?.length ?? 0,
    bones: bones.size, animations: gltf.animations.map((clip) => ({ name: clip.name, duration: clip.duration })),
    rawBounds: { min: rawBounds.min.toArray(), max: rawBounds.max.toArray(), size: rawSize.toArray() },
    displayScale: scale, resourceErrors,
    rigTest: { skeletonVisible: false, selectedBone: null, rotationAxis: 'x', rotationDegrees: 0, playingClip: null },
  };

  set('rig-summary', `${bones.size ? `检测到 ${bones.size} 个骨骼、${skinnedMeshes} 个蒙皮 Mesh。` : '未检测到骨骼，无法进行骨架或关节测试。'}${gltf.animations.length ? `GLB 包含 ${gltf.animations.length} 个动画片段，默认不播放。` : 'GLB 未包含动画片段。'}`);
  const boneSelect = document.querySelector('#bone-select');
  const boneAxis = document.querySelector('#bone-axis');
  const boneAngle = document.querySelector('#bone-angle');
  const animationSelect = document.querySelector('#animation-select');
  const playButton = document.querySelector('#animation-play');
  const stopButton = document.querySelector('#animation-stop');
  let skeletonHelper = null;
  let boneAxes = null;

  // Capture/restore the imported transforms, including non-bone tracks and morphs.
  // No changes are persisted to the source GLB.
  const restoreOriginalPose = () => {
    mixer?.stopAllAction();
    activeAction = null;
    for (const original of originalTransforms.values()) {
      original.node.position.copy(original.position);
      original.node.quaternion.copy(original.quaternion);
      original.node.scale.copy(original.scale);
      if (original.morphTargetInfluences) {
        original.node.morphTargetInfluences.splice(0, original.node.morphTargetInfluences.length, ...original.morphTargetInfluences);
      }
      original.node.updateMatrix();
    }
    model.updateMatrixWorld(true);
    boneAngle.value = '0';
    set('bone-angle-value', '0°');
    set('animation-status', '未播放；已恢复导入时姿态。');
    stopButton.disabled = true;
    window.assetReview.rigTest.rotationDegrees = 0;
    window.assetReview.rigTest.playingClip = null;
  };

  if (boneNodes.length) {
    document.querySelector('#rig-panel').hidden = false;
    model.updateMatrixWorld(true);
    skeletonHelper = new THREE.SkeletonHelper(model);
    skeletonHelper.visible = false;
    skeletonHelper.material.depthTest = false;
    skeletonHelper.material.transparent = true;
    skeletonHelper.material.opacity = 0.9;
    skeletonHelper.renderOrder = 100;
    scene.add(skeletonHelper);
    boneAxes = new THREE.AxesHelper(0.4 / scale);
    boneAxes.material.depthTest = false;
    boneAxes.renderOrder = 101;
    boneAxes.visible = false;
    for (const [index, bone] of boneNodes.entries()) {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = `${index + 1}. ${bone.name || '未命名骨骼'}`;
      boneSelect.append(option);
    }
    const selectBone = () => {
      restoreOriginalPose();
      const bone = boneNodes[Number(boneSelect.value)];
      bone.add(boneAxes);
      window.assetReview.rigTest.selectedBone = { index: Number(boneSelect.value), name: bone.name || '未命名骨骼' };
    };
    boneSelect.addEventListener('change', selectBone);
    selectBone();
    document.querySelector('#skeleton').addEventListener('change', (event) => {
      skeletonHelper.visible = event.target.checked;
      boneAxes.visible = event.target.checked;
      window.assetReview.rigTest.skeletonVisible = event.target.checked;
    });
    const applyBoneTest = () => {
      const angle = Number(boneAngle.value);
      restoreOriginalPose();
      const bone = boneNodes[Number(boneSelect.value)];
      const axis = new THREE.Vector3();
      axis[boneAxis.value] = 1;
      bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis, THREE.MathUtils.degToRad(angle)));
      bone.updateMatrix();
      model.updateMatrixWorld(true);
      boneAngle.value = String(angle);
      set('bone-angle-value', `${angle}°`);
      window.assetReview.rigTest.rotationAxis = boneAxis.value;
      window.assetReview.rigTest.rotationDegrees = angle;
    };
    boneAngle.addEventListener('input', applyBoneTest);
    boneAxis.addEventListener('change', applyBoneTest);
    document.querySelector('#pose-reset').addEventListener('click', restoreOriginalPose);
  }

  if (gltf.animations.length) {
    mixer = new THREE.AnimationMixer(model);
    document.querySelector('#animation-panel').hidden = false;
    gltf.animations.forEach((clip, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = `${clip.name || `动画 ${index + 1}`}（${clip.duration.toFixed(2)}s）`;
      animationSelect.append(option);
    });
    animationSelect.addEventListener('change', () => {
      restoreOriginalPose();
      playButton.disabled = animationSelect.value === '';
    });
    playButton.addEventListener('click', () => {
      if (animationSelect.value === '') return;
      restoreOriginalPose();
      const clip = gltf.animations[Number(animationSelect.value)];
      activeAction = mixer.clipAction(clip).reset().play();
      stopButton.disabled = false;
      set('animation-status', `正在播放：${clip.name || `动画 ${Number(animationSelect.value) + 1}`}（循环）。`);
      window.assetReview.rigTest.playingClip = { index: Number(animationSelect.value), name: clip.name, duration: clip.duration };
    });
    stopButton.addEventListener('click', restoreOriginalPose);
  }
}

start().catch((error) => {
  console.error(error);
  fail(`加载失败：${error.message || String(error)}`);
});
