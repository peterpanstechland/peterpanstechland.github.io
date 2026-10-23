import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createGarageGraphics } from './art-direction.js?v=interior-v1';
import { createNightEnvironment, addPracticalLights } from './night-environment.js?v=interior-v2';
import { settleGarageAssets } from './ground-contact.js?v=interior-v1';
import { createWorkshopDetails } from './workshop-details.js?v=interior-v1';

const zh = new URLSearchParams(location.search).get('lang') === 'zh-Hans' || location.pathname.startsWith('/zh-Hans/');
const copy = {
  badge: ['LIVE ASSET PREVIEW', '真实资产预览'], overview: ['Overview', '整体视角'], front: ['Front view', '正面视角'],
  interior: ['Workshop', '室内工具'], supportMissing: ['Its supporting surface is unavailable; this device is temporarily hidden.', '支撑面暂不可用，此设备暂时隐藏。'],
  wave: ['Beckon', '招财猫招手'], effects: ['Local effects', '局部特效'], shutter: ['Garage door', '卷帘门'], assets: ['Assets', '资产清单'],
  retryFailed: ['Retry failed loads', '重试加载失败项'], hint: ['Drag to orbit · Pinch to zoom\nClick an object to explore', '拖动旋转 · 双指缩放\n点选模型查看详情'],
  assetTitle: ['Independent assets', '独立资产'], unavailable: ['The garage could not open', '车库预览暂时无法打开'], reload: ['Reload preview', '重新加载预览'],
  pending: ['In production', '制作中'], loading: ['Loading', '加载中'], ready: ['Real GLB loaded', '真实 GLB 已加载'], error: ['Unavailable', '暂不可用'],
  open: ['Explore this project →', '查看相关内容 →'], close: ['Close', '关闭'],
  empty: ['This asset has not been delivered yet. Its place is left empty.', '该资产尚未交付，场景中保留空位。'],
  loadError: ['This real model could not load. Other assets remain available; use “Retry failed loads” to try again.', '该真实模型加载失败，其他模型仍可使用。可点击“重试加载失败项”。'],
  notDelivered: ['This asset has not passed preview acceptance. No replacement model is shown.', '该资产尚未通过接入验收，未显示替代模型。'],
  real: ['An independently generated Tripo asset. Rotate the view to inspect its geometry and textures.', '独立生成的 Tripo 资产。旋转视角可检查几何与贴图。'],
  waveMissing: ['Waiting for the cat’s authored beckoning clip.', '等待招财猫的本地招手动画片段。'],
  shutterPending: ['The independent shutter is waiting for its slat animation.', '独立卷帘门正在接入分片开关动画。'],
  shutterOpen: ['Open garage door', '打开卷帘门'], shutterClose: ['Close garage door', '关闭卷帘门'],
  reduced: ['Effects are off because reduced motion is enabled.', '已根据减少动态效果偏好关闭特效。'],
  webgl: ['WebGL is unavailable. Try a browser with hardware acceleration enabled.', 'WebGL 不可用，请使用支持硬件加速的浏览器。'],
  context: ['The graphics context was lost. Reload this preview to recover.', '图形上下文已丢失，请重新加载预览。'],
};
const t = (key) => copy[key]?.[zh ? 1 : 0] ?? key;
const $ = (id) => document.getElementById(id);
for (const element of document.querySelectorAll('[data-i18n]')) element.textContent = t(element.dataset.i18n);
for (const element of document.querySelectorAll('.close')) element.setAttribute('aria-label', t('close'));
$('stage').setAttribute('aria-label', zh ? '可交互车库。方向键旋转，加减键缩放。' : 'Interactive garage. Arrow keys rotate; plus and minus zoom.');
$('cat-wave').title = t('waveMissing');
$('shutter').title = t('shutterPending');
const stage = $('stage');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const smallScreen = matchMedia('(max-width: 650px)');
// Fix the texture tier for this visit so rotating a phone cannot raise its
// resident texture budget. Raw GLBs remain unchanged on disk.
const textureLimit = smallScreen.matches || matchMedia('(pointer: coarse)').matches ? 512 : 1024;
const releasedImages = new WeakSet();
const entries = new Map();
let renderer;
let scene;
let camera;
let controls;
let contextLost = false;
let selectedId = null;
let cat = null;
let effectsEnabled = false;
let waveEnabled = false;
let framing = new URLSearchParams(location.search).get('view') === 'interior' ? 'interior' : 'overview';
let configurationLoaded = false;
let frameRequested = false;
let lastFrame = 0;
let elapsed = 0;
let branding = null;
let practicalLights = null;
let plantInstances = null;
let composer = null;
let groundSupports = null;
let workshopDetails = null;
let shutter = null;
const nominalBounds = new THREE.Box3(new THREE.Vector3(-3.1, -0.3, -1.8), new THREE.Vector3(3.1, 3.38, 2.95));
const worldBounds = nominalBounds.clone();

function displayState(entry) {
  if (entry.state === 'ready' && entry.config.supportAsset && !entry.mount?.visible) return entry.placementStatus === 'support-unavailable' ? 'error' : 'pending';
  return entry.state;
}
function statusCounts() {
  const all = [...entries.values()];
  return { loaded: all.filter((entry) => displayState(entry) === 'ready').length, total: all.length, failed: all.filter((entry) => displayState(entry) === 'error').length };
}
function notifyStatus() {
  const counts = statusCounts();
  const loading = [...entries.values()].some((entry) => entry.state === 'loading');
  const pending = counts.total - counts.loaded - counts.failed;
  if (!contextLost) stage.dataset.state = loading ? 'loading' : counts.loaded ? 'ready' : counts.failed ? 'error' : 'pending';
  $('load-state').textContent = zh
    ? `${counts.loaded} / ${counts.total} 个真实资产已加载${loading ? ' · 正在加载其余模型' : pending ? ` · ${pending} 项制作中` : ''}${counts.failed ? ` · ${counts.failed} 项暂不可用` : ''}`
    : `${counts.loaded} / ${counts.total} real assets loaded${loading ? ' · Loading models' : pending ? ` · ${pending} in production` : ''}${counts.failed ? ` · ${counts.failed} unavailable` : ''}`;
  $('retry-failed').hidden = ![...entries.values()].some((entry) => entry.state === 'error' && entry.config.file);
  const resources = textureSummary(scene);
  const resourceState = $('texture-state');
  resourceState.dataset.textureLimit = String(textureLimit);
  resourceState.dataset.textureCount = String(resources.textureCount);
  resourceState.dataset.maxTextureEdge = String(resources.maxTextureEdge);
  resourceState.dataset.estimatedRgbaMiB = resources.estimatedRgbaMiB.toFixed(2);
  resourceState.textContent = zh
    ? `预览贴图：${resources.textureCount} 张 · 最大 ${resources.maxTextureEdge} px · 估算 ${resources.estimatedRgbaMiB.toFixed(1)} MiB`
    : `Preview textures: ${resources.textureCount} maps · max ${resources.maxTextureEdge} px · approx. ${resources.estimatedRgbaMiB.toFixed(1)} MiB`;
  const parentCounts = contextLost ? { loaded: 0, total: Math.max(counts.total, 1), failed: Math.max(counts.total, 1) } : counts;
  window.parent.postMessage({ type: 'techland-garage-status', ...parentCounts }, location.origin);
  window.techlandGarageState = { ...counts, state: stage.dataset.state, effectsEnabled, waveEnabled, textureLimit, resources, shutter: shutterSnapshot(), assets: [...entries.values()].map((entry) => ({ id: entry.config.id, state: entry.state, error: entry.error || null, file: entry.config.file || null, normalization: entry.normalization || null, branding: entry.branding || null })) };
}
function fatal(message) {
  stage.dataset.state = 'error';
  $('fatal').hidden = false;
  $('fatal-message').textContent = message;
  $('load-state').textContent = t('unavailable');
  renderer?.setAnimationLoop(null);
  const total = Math.max(entries.size, 1);
  window.parent.postMessage({ type: 'techland-garage-status', loaded: 0, total, failed: total }, location.origin);
}
function labelFor(config) { return config.label?.[zh ? 'zh' : 'en'] || config.label?.en || config.id; }
function updateRow(entry) {
  entry.button.dataset.state = displayState(entry);
  if (entry.normalization) entry.button.dataset.normalization = JSON.stringify(entry.normalization);
  else delete entry.button.dataset.normalization;
  if (entry.model) entry.button.dataset.textures = JSON.stringify(textureSummary(entry.model));
  else delete entry.button.dataset.textures;
  entry.stateLabel.textContent = t(displayState(entry));
  if (selectedId === entry.config.id) showInfo(entry.config.id, false);
}
function showInfo(id, focus = false) {
  const entry = entries.get(id);
  if (!entry) return;
  selectedId = id;
  $('info-title').textContent = labelFor(entry.config);
  $('info-state').textContent = t(displayState(entry));
  $('info-description').textContent = entry.state === 'ready' ? t('real') : entry.state === 'error' ? t(entry.config.file ? 'loadError' : 'notDelivered') : entry.state === 'loading' ? t('loading') : t('empty');
  if ((entry.state === 'ready' || entry.config.status === 'rejected') && entry.config.description) $('info-description').textContent += ` ${entry.config.description[zh ? 'zh' : 'en']}`;
  if (entry.state === 'ready' && entry.config.supportAsset && !entry.mount.visible) $('info-description').textContent = t('supportMissing');
  if (entry.state === 'ready' && entry.normalization?.strategy === 'per-axis-static') {
    const size = entry.normalization.targetSize.map((value) => Number(value.toFixed(3))).join(' × ');
    $('info-description').textContent += zh ? ` 展示时按轴适配为 ${size} m；这是场景适配尺寸，原始 GLB 保留。` : ` Fitted per axis to ${size} m for this scene; the original GLB is preserved.`;
  }
  if (entry.state === 'ready' && entry.branding) $('info-description').textContent += zh ? ' 品牌文字采用后期准确贴图。' : 'Brand lettering uses accurate post-production labels.';
  const link = $('info-link');
  link.hidden = true;
  link.removeAttribute('href');
  if (entry.config.href && entry.state === 'ready') {
    try {
      const url = new URL(entry.config.href, location.href);
      if (zh && url.origin === location.origin && !/^\/zh-Hans(?:\/|$)/.test(url.pathname)) {
        url.pathname = `/zh-Hans${url.pathname}`;
      }
      if (['http:', 'https:'].includes(url.protocol)) {
        link.href = url.href;
        link.textContent = t('open');
        link.hidden = false;
      }
    } catch { /* Invalid configured links stay absent. */ }
  }
  $('info').hidden = false;
  if (focus) $('info-close').focus();
}
function closeInfo() { $('info').hidden = true; selectedId = null; }
$('info-close').addEventListener('click', closeInfo);
const toggleAssetPanel = (open) => {
  $('asset-panel').hidden = !open;
  $('asset-toggle').setAttribute('aria-expanded', String(open));
};
$('asset-toggle').addEventListener('click', () => toggleAssetPanel($('asset-panel').hidden));
$('asset-close').addEventListener('click', () => { toggleAssetPanel(false); $('asset-toggle').focus(); });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { closeInfo(); toggleAssetPanel(false); }
});

function fitCamera(view = framing) {
  if (!camera || !controls) return;
  framing = view;
  if (view === 'interior') {
    camera.fov = camera.aspect < 0.9 ? 90 : 80;
    controls.target.set(0.55, 0.9, -0.4);
    // Step just inside the opening so the exterior vending machine cannot
    // obscure the near end of the equipment bench.
    camera.position.set(-0.65, 1.2, camera.aspect < 0.9 ? 2.2 : 1.0);
    camera.near = 0.02; camera.far = 150; camera.updateProjectionMatrix();
    controls.minDistance = 0.55; controls.maxDistance = 9;
    controls.update(); requestFrame(); return;
  }
  camera.fov = 36;
  const size = worldBounds.getSize(new THREE.Vector3());
  const center = worldBounds.getCenter(new THREE.Vector3());
  const vertical = THREE.MathUtils.degToRad(camera.fov);
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect);
  const direction = (view === 'front' ? new THREE.Vector3(0, 0.09, 1) : new THREE.Vector3(0.43, 0.22, 1.3)).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  let distance = 1;
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    const corner = new THREE.Vector3(x * size.x / 2, y * size.y / 2, z * size.z / 2);
    distance = Math.max(distance, corner.dot(direction) + Math.abs(corner.dot(right)) / Math.tan(horizontal / 2), corner.dot(direction) + Math.abs(corner.dot(up)) / Math.tan(vertical / 2));
  }
  distance *= smallScreen.matches ? 1.03 : 0.96;
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(direction, distance);
  camera.near = 0.03;
  camera.far = Math.max(150, distance * 4);
  camera.updateProjectionMatrix();
  controls.minDistance = 1.1;
  controls.maxDistance = distance * 2.3;
  controls.update();
  requestFrame();
}
function requestFrame() {
  if (frameRequested || document.hidden || contextLost || !renderer) return;
  frameRequested = true;
  requestAnimationFrame(renderFrame);
}
function renderFrame(now) {
  frameRequested = false;
  if (document.hidden || contextLost) { lastFrame = 0; return; }
  const delta = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0;
  lastFrame = now;
  elapsed += delta;
  if (waveEnabled && cat?.mixer) cat.mixer.update(delta);
  if (shutter?.moving) animateShutter(delta);
  if (effectsEnabled && cat?.fx) animateEffects(elapsed);
  const cameraChanged = controls.update();
  if (composer) composer.render(delta);
  else renderer.render(scene, camera);
  if (waveEnabled || effectsEnabled || shutter?.moving || cameraChanged) requestFrame();
}
document.addEventListener('visibilitychange', () => { lastFrame = 0; if (!document.hidden) requestFrame(); });

function shutterSnapshot() {
  return shutter ? { progress: shutter.progress, target: shutter.target, moving: shutter.moving, slatCount: shutter.slats.length, top: shutter.spec.top, radius: shutter.spec.radius, travel: shutter.spec.travel } : null;
}
function applyShutter(progress) {
  if (!shutter) return;
  shutter.progress = THREE.MathUtils.clamp(progress, 0, 1);
  const { top, radius, travel } = shutter.spec;
  const rotation = new THREE.Quaternion();
  const axis = new THREE.Vector3(1, 0, 0);
  for (const slat of shutter.slats) {
    const liftedY = slat.closedY + travel * shutter.progress;
    const theta = liftedY > top ? (liftedY - top) / radius : 0;
    slat.node.position.set(slat.closedX, theta ? top + radius * Math.sin(theta) : liftedY, theta ? slat.closedZ - radius * (1 - Math.cos(theta)) : slat.closedZ);
    slat.node.quaternion.copy(slat.originalQuaternion).multiply(rotation.setFromAxisAngle(axis, -theta));
  }
  shutter.entry.mount.updateMatrixWorld(true);
  $('shutter').dataset.progress = shutter.progress.toFixed(4);
  if (window.techlandGarageState) window.techlandGarageState.shutter = shutterSnapshot();
}
function setShutterOpen(open) {
  if (!shutter) return false;
  shutter.target = open ? 1 : 0;
  shutter.start = shutter.progress;
  shutter.elapsed = 0;
  shutter.duration = 2.2 * Math.abs(shutter.target - shutter.start);
  shutter.moving = !motion.matches && shutter.duration > 0.001;
  $('shutter').setAttribute('aria-pressed', String(open));
  $('shutter').textContent = t(open ? 'shutterClose' : 'shutterOpen');
  if (!shutter.moving) applyShutter(shutter.target);
  notifyStatus(); requestFrame();
  return true;
}
function animateShutter(delta) {
  shutter.elapsed += delta;
  const time = Math.min(1, shutter.elapsed / shutter.duration);
  const eased = time * time * (3 - 2 * time);
  applyShutter(THREE.MathUtils.lerp(shutter.start, shutter.target, eased));
  if (time === 1) {
    shutter.moving = false;
    applyShutter(shutter.target);
    notifyStatus();
  }
}
function configureShutter(entry) {
  let root = null;
  entry.model.traverse((node) => { if (node.userData.shutter && node.name === 'ROLLER_SHUTTER_ROOT') root = node; });
  if (!root) throw new Error('The real shutter has no ROLLER_SHUTTER_ROOT metadata.');
  const spec = root.userData.shutter;
  if (![spec.top, spec.radius, spec.travel, spec.slatCount].every(Number.isFinite) || spec.radius <= 0 || spec.travel <= 0 || spec.rollAxis !== 'X' || spec.frontAxis !== '+Z') throw new Error('Invalid real shutter roll metadata.');
  const slats = [];
  root.traverse((node) => {
    if (!/^SHUTTER_SLAT_\d+$/.test(node.name)) return;
    const { closedX, closedY, closedZ } = node.userData;
    if (![closedX, closedY, closedZ].every(Number.isFinite)) throw new Error(`Missing original coordinates for ${node.name}.`);
    slats.push({ node, closedX, closedY, closedZ, originalQuaternion: node.quaternion.clone() });
  });
  if (slats.length !== spec.slatCount) throw new Error('The real shutter slat count does not match its metadata.');
  shutter = { entry, spec, slats, progress: 1, target: 1, moving: false, elapsed: 0, duration: 0, start: 1 };
  entry.shutter = shutter;
  // Present the workshop open immediately. There is no autoplay animation.
  applyShutter(1);
  $('shutter').disabled = false;
  $('shutter').title = zh ? `真实 ${slats.length} 片卷帘门` : `${slats.length} real articulated shutter slats`;
  $('shutter').textContent = t('shutterClose');
  $('shutter').setAttribute('aria-pressed', 'true');
}
$('shutter').addEventListener('click', () => setShutterOpen(shutter?.target !== 1));
$('interior').addEventListener('click', () => { closeInfo(); if (shutter) setShutterOpen(true); fitCamera('interior'); });

function refreshArtDirection() {
  if (branding) { branding.removeFromParent(); disposeObject(branding); }
  if (practicalLights) { practicalLights.removeFromParent(); disposeObject(practicalLights); }
  if (groundSupports) { groundSupports.removeFromParent(); disposeObject(groundSupports); }
  if (workshopDetails) { workshopDetails.removeFromParent(); disposeObject(workshopDetails); }
  const grounded = settleGarageAssets(THREE, scene, entries);
  groundSupports = grounded.supports;
  worldBounds.copy(nominalBounds);
  for (const entry of entries.values()) {
    if (entry.state !== 'ready') continue;
    if (entry.config.id !== '13_street_base') worldBounds.union(entry.bounds);
    entry.normalization.displaySize = entry.bounds.getSize(new THREE.Vector3()).toArray();
    if (entry.lamp) {
      entry.lamp.position.copy(entry.bounds.getCenter(new THREE.Vector3()));
      entry.lamp.position.y = entry.bounds.max.y - 0.1;
      entry.lamp.position.z += 0.1;
    }
    updateRow(entry);
  }
  // Instances share their source GLB resources: remove nodes, never dispose
  // the original plant's geometry or textures when rebuilding this dressing.
  plantInstances?.removeFromParent();
  plantInstances = new THREE.Group();
  plantInstances.name = 'PLACED_INSTANCES_OF_REAL_TRIPO_PLANTS';
  scene.add(plantInstances);
  const plant = entries.get('12_plants_grass');
  if (plant?.state === 'ready') {
    const placements = [[-1.85, 0, 2.05, 0.55, 'street']];
    const shell = entries.get('01_garage_shell');
    if (shell?.state === 'ready') placements.push([-0.6, shell.mount.position.y + 2.925, -0.1, 0.4, 'roof'], [0.9, shell.mount.position.y + 2.841, 0.2, 0.4, 'roof']);
    for (const [index, [x, y, z, scale, support]] of placements.entries()) {
      const instance = plant.model.clone(true);
      instance.position.set(x, y, z);
      instance.scale.multiplyScalar(scale);
      instance.userData = {...instance.userData, locallyPlacedInstance: true, sourceTaskId: plant.config.taskId};
      plantInstances.add(instance);
      instance.userData.groundContact = grounded.settleInstance(instance, support, `plant-instance-${index}`);
    }
  }
  branding = createGarageGraphics(THREE, scene, entries);
  workshopDetails = createWorkshopDetails(THREE, scene, entries);
  practicalLights = addPracticalLights(THREE, scene, entries);
  preparePreviewTextures(branding);
  preparePreviewTextures(workshopDetails);
  $('asset-panel').dataset.groundContact = JSON.stringify(grounded.report);
  $('asset-panel').dataset.workshopLabels = JSON.stringify(workshopDetails.userData.anchors);
  notifyStatus();
  fitCamera();
  requestFrame();
}

function createVendingBranding(entry) {
  // These are accurate, authored labels applied after generation. The Tripo
  // vending-machine geometry and its product display remain unchanged.
  const size = entry.bounds.getSize(new THREE.Vector3());
  const center = entry.bounds.getCenter(new THREE.Vector3());
  const labels = new THREE.Group();
  labels.name = 'VENDING_ACCURATE_BRAND_LABELS';
  entry.mount.add(labels);
  entry.postBranding = labels;
  const makeTexture = (lines, vertical = false, accent = '#83e6ef', square = false) => {
    const canvas = document.createElement('canvas');
    canvas.width = vertical || square ? 768 : 1536;
    canvas.height = square ? 768 : vertical ? 1536 : 384;
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#271124'); gradient.addColorStop(1, '#42112d');
    context.fillStyle = gradient; context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#b83275'; context.lineWidth = 12;
    context.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
    context.textAlign = 'center'; context.textBaseline = 'middle';
    const rowHeight = canvas.height / (lines.length + 1);
    lines.forEach((line, index) => {
      context.fillStyle = index === lines.length - 1 && vertical ? '#ffc69b' : accent;
      context.font = `700 ${square ? 104 : vertical ? 102 : lines.length > 1 ? 100 : 172}px Arial, sans-serif`;
      context.fillText(line, canvas.width / 2, rowHeight * (index + 1), canvas.width - 100);
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    return texture;
  };
  const addLabel = (name, width, height, position, rotationY, texture) => {
    const label = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    label.name = name;
    label.position.copy(entry.mount.worldToLocal(position));
    label.rotation.y = rotationY;
    label.userData.assetId = entry.config.id;
    labels.add(label);
  };
  const frontZ = entry.bounds.max.z;
  const decalAnchors = [];
  const attachToSurface = (position, rotationY) => {
    const normal = new THREE.Vector3(Math.sin(rotationY), 0, Math.cos(rotationY));
    const origin = position.clone().addScaledVector(normal, 0.5);
    const hit = new THREE.Raycaster(origin, normal.clone().negate(), 0, 2.5).intersectObject(entry.model, true)[0];
    if (!hit) return null;
    const anchor = hit.point.clone().addScaledVector(normal, 0.002);
    decalAnchors.push({position: anchor.toArray(), sourceSurface: hit.point.toArray(), offset: 0.002});
    return anchor;
  };
  const addAttachedLabel = (name, width, height, position, rotationY, texture) => {
    const anchor = attachToSurface(position, rotationY);
    if (anchor) addLabel(name, width, height, anchor, rotationY, texture);
    else texture.dispose();
  };
  addAttachedLabel('VENDING_HEADER_PROJECTS', size.x * 0.86, size.y * 0.115,
    new THREE.Vector3(center.x, entry.bounds.min.y + size.y * 0.903, frontZ), 0, makeTexture(['PROJECTS']));
  addAttachedLabel('VENDING_FRONT_BRAND', size.x * 0.48, size.y * 0.235,
    new THREE.Vector3(center.x + size.x * 0.245, entry.bounds.min.y + size.y * 0.155, frontZ), 0, makeTexture(['Peter Pan’s', 'Techland'], false, '#ffd3e8', true));
  const sideTexture = makeTexture(['Peter Pan’s', 'Techland', 'PROJECTS'], true, '#f7b5d9');
  for (const side of [-1, 1]) {
    addAttachedLabel(side > 0 ? 'VENDING_RIGHT_BRAND' : 'VENDING_LEFT_BRAND', size.z * 0.79, size.y * 0.73,
      new THREE.Vector3(center.x + side * (size.x / 2 + 0.005), entry.bounds.min.y + size.y * 0.51, center.z), side * Math.PI / 2, sideTexture);
  }
  preparePreviewTextures(labels);
  entry.branding = { authoredPostprocess: true, text: ['Peter Pan’s Techland', 'PROJECTS'], regions: ['front-header', 'front-lower-right', 'left-side', 'right-side'], decalAnchors };
}

function createEffects(entry) {
  const spriteCanvas = document.createElement('canvas');
  spriteCanvas.width = 64; spriteCanvas.height = 64;
  const context = spriteCanvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, '#fff'); gradient.addColorStop(0.2, '#fffd'); gradient.addColorStop(0.6, '#fff3'); gradient.addColorStop(1, '#fff0');
  context.fillStyle = gradient; context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(spriteCanvas);
  const points = new THREE.BufferGeometry();
  points.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18 * 3), 3));
  const sparks = new THREE.Points(points, new THREE.PointsMaterial({ color: '#ffb761', size: 0.055, map: texture, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  const arcGeometry = new THREE.BufferGeometry();
  arcGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9 * 3), 3));
  const arc = new THREE.Line(arcGeometry, new THREE.LineBasicMaterial({ color: '#70e2ef', transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false }));
  const group = new THREE.Group(); group.add(sparks, arc); group.visible = false; scene.add(group);
  let anchor = entry.model.getObjectByName('bone_22') || null;
  entry.model.traverse((node) => {
    if (!anchor && node.isBone && /(?:palm|hand|wrist)/i.test(node.name)) anchor = node;
  });
  const fallback = entry.bounds.getCenter(new THREE.Vector3());
  fallback.y = entry.bounds.min.y + entry.bounds.getSize(new THREE.Vector3()).y * 0.72;
  fallback.z = entry.bounds.max.z + 0.025;
  return { group, points, arcGeometry, anchor, fallback };
}
function animateEffects(time) {
  const fx = cat.fx;
  if (fx.anchor) fx.anchor.getWorldPosition(fx.group.position); else fx.group.position.copy(fx.fallback);
  const particles = fx.points.attributes.position;
  for (let index = 0; index < particles.count; index++) {
    const phase = (time * 0.24 + index * 0.618) % 1;
    const angle = index * 2.4 + time * 0.35;
    particles.setXYZ(index, Math.cos(angle) * 0.035 * (1 - phase), phase * 0.16, Math.sin(angle) * 0.035);
  }
  particles.needsUpdate = true;
  const arc = fx.arcGeometry.attributes.position;
  for (let index = 0; index < arc.count; index++) {
    const factor = index / (arc.count - 1);
    const envelope = Math.sin(factor * Math.PI);
    arc.setXYZ(index, (factor - 0.5) * 0.17, 0.04 + Math.sin(index * 3.2 + time * 4) * 0.018 * envelope, Math.cos(index * 2.1 + time * 3) * 0.016 * envelope);
  }
  arc.needsUpdate = true;
}
function setEffects(enabled) {
  effectsEnabled = Boolean(enabled && cat?.fx && !motion.matches);
  if (cat?.fx) cat.fx.group.visible = effectsEnabled;
  $('effects').setAttribute('aria-pressed', String(effectsEnabled));
  $('effects').disabled = !cat?.fx || motion.matches;
  $('effects').title = motion.matches ? t('reduced') : '';
  notifyStatus(); requestFrame();
}
function setWave(enabled) {
  waveEnabled = Boolean(enabled && cat?.action);
  if (cat?.action) {
    if (waveEnabled) cat.action.reset().play();
    else { cat.mixer.stopAllAction(); cat.mixer.update(0); }
  }
  $('cat-wave').setAttribute('aria-pressed', String(waveEnabled));
  notifyStatus(); requestFrame();
}
$('effects').addEventListener('click', () => setEffects(!effectsEnabled));
$('cat-wave').addEventListener('click', () => setWave(!waveEnabled));
motion.addEventListener('change', () => {
  if (controls) controls.enableDamping = !motion.matches;
  if (motion.matches) setWave(false);
  setEffects(false);
  if (motion.matches && shutter) setShutterOpen(shutter.target === 1);
});

function allowedModelURL(file) {
  if (typeof file !== 'string' || !/^models\/[a-zA-Z0-9_./ -]+\.glb$/i.test(file) || file.split('/').includes('..')) throw new Error('Only local models/*.glb files are allowed.');
  const url = new URL(file, document.baseURI);
  if (url.origin !== location.origin || !url.href.startsWith(new URL('./models/', document.baseURI).href)) throw new Error('Invalid local model path.');
  return url.href;
}
function materialTextures(root) {
  const textures = new Set();
  root?.traverse((node) => {
    const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
    for (const material of materials) {
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  return textures;
}
function releaseTextureImage(image) {
  if (!image || typeof image !== 'object' || releasedImages.has(image)) return;
  releasedImages.add(image);
  if (typeof image.close === 'function') image.close();
  else if (image.tagName === 'CANVAS') { image.width = 1; image.height = 1; }
  else if (image.tagName === 'IMG') image.removeAttribute('src');
}
function preparePreviewTextures(root) {
  // Texture clones can share a Source or an ImageBitmap. Replace every reference
  // before closing the original bitmap; retain all texture/UV/material settings.
  const byImage = new Map();
  for (const texture of materialTextures(root)) {
    if (!texture.image) continue;
    if (!byImage.has(texture.image)) byImage.set(texture.image, []);
    byImage.get(texture.image).push(texture);
  }
  for (const [image, textures] of byImage) {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) throw new Error('A texture has invalid image dimensions.');
    if (Math.max(sourceWidth, sourceHeight) <= textureLimit) continue;
    const scale = textureLimit / Math.max(sourceWidth, sourceHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Could not prepare preview texture resolution.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const texture of textures) {
      texture.image = canvas;
      texture.needsUpdate = true;
    }
    releaseTextureImage(image);
  }
}
function textureSummary(root) {
  let textureCount = 0;
  let maxTextureEdge = 0;
  let estimatedBytes = 0;
  const sizes = [];
  for (const texture of materialTextures(root)) {
    let width = texture.image?.naturalWidth || texture.image?.width || 0;
    let height = texture.image?.naturalHeight || texture.image?.height || 0;
    if (!width || !height) continue;
    textureCount++;
    maxTextureEdge = Math.max(maxTextureEdge, width, height);
    sizes.push([width, height]);
    estimatedBytes += width * height * 4;
    // This is an RGBA8 material-texture estimate, not total GPU or CPU memory.
    if (texture.generateMipmaps) {
      while (width > 1 || height > 1) {
        width = Math.max(1, Math.floor(width / 2));
        height = Math.max(1, Math.floor(height / 2));
        estimatedBytes += width * height * 4;
      }
    }
  }
  return { textureCount, maxTextureEdge, estimatedRgbaMiB: estimatedBytes / 1048576, sizes };
}
function disposeObject(root) {
  const textures = new Set();
  const geometries = new Set();
  const materials = new Set();
  const skeletons = new Set();
  root.traverse((node) => {
    if (node.geometry) geometries.add(node.geometry);
    if (node.skeleton) skeletons.add(node.skeleton);
    const nodeMaterials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
    for (const material of nodeMaterials) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  const images = new Set([...textures].map((texture) => texture.image));
  textures.forEach((texture) => texture.dispose());
  images.forEach(releaseTextureImage);
  skeletons.forEach((skeleton) => skeleton.dispose());
}
async function loadAsset(entry) {
  if (entry.state === 'loading' || entry.state === 'ready' || !entry.config.file) return;
  entry.state = 'loading'; entry.error = null; entry.normalization = null;
  updateRow(entry); notifyStatus();
  let timeout;
  let expired = false;
  let loadedModel = null;
  let loadedMount = null;
  try {
    const manager = new THREE.LoadingManager();
    const failedResources = [];
    manager.onError = (url) => failedResources.push(url);
    const request = new GLTFLoader(manager).loadAsync(allowedModelURL(entry.config.file));
    request.then((result) => { if (expired) disposeObject(result.scene); }, () => {});
    const gltf = await Promise.race([request, new Promise((_, reject) => { timeout = setTimeout(() => { expired = true; reject(new Error('Model loading timed out.')); }, 90000); })]);
    clearTimeout(timeout);
    const model = loadedModel = gltf.scene;
    if (failedResources.length) throw new Error('A model texture or resource failed to load.');
    preparePreviewTextures(model);
    const mount = loadedMount = new THREE.Group();
    mount.name = entry.config.id;
    if (entry.config.normalized) {
      const placement = new THREE.Group();
      placement.name = `${entry.config.id}_PLACEMENT`;
      placement.rotation.y = Number.isFinite(entry.config.rotationY) ? entry.config.rotationY : 0;
      if (entry.config.uniformScale > 0) placement.scale.setScalar(entry.config.uniformScale);
      placement.add(model);
      mount.add(placement);
      entry.normalization = { strategy: 'preprocessed-placement-only', scaleXYZ: placement.scale.toArray(), rotationY: placement.rotation.y };
    }
    else {
      const oriented = new THREE.Group();
      oriented.add(model);
      oriented.rotation.y = Number.isFinite(entry.config.rotationY) ? entry.config.rotationY : -Math.PI / 2;
      oriented.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(oriented, true);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      if (bounds.isEmpty() || !size.toArray().every(Number.isFinite) || Math.max(...size.toArray()) <= 0) throw new Error('Model geometry has no valid bounds.');
      const fit = new THREE.Group();
      fit.name = `${entry.config.id}_SCENE_FIT`;
      fit.add(oriented);
      let strategy = 'uniform';
      if (entry.config.targetSize !== undefined) {
        const targetSize = entry.config.targetSize;
        if (!Array.isArray(targetSize) || targetSize.length !== 3 || !targetSize.every((value) => Number.isFinite(value) && value > 0)) throw new Error('targetSize must contain three positive dimensions.');
        let hasSkin = false;
        model.traverse((node) => { if (node.isSkinnedMesh) hasSkin = true; });
        if (hasSkin) throw new Error('Per-axis targetSize fitting is not allowed on skinned models. Use normalized or uniform sizing.');
        if (size.toArray().some((value) => value <= 1e-8)) throw new Error('Cannot fit a zero-width geometry axis to targetSize.');
        // The fit group is outside the rotation group: these scales act on the
        // measured front-facing scene axes, not the original mesh axes.
        fit.scale.set(targetSize[0] / size.x, targetSize[1] / size.y, targetSize[2] / size.z);
        strategy = 'per-axis-static';
      } else {
        const scale = entry.config.targetHeight > 0 && size.y > 0 ? entry.config.targetHeight / size.y : entry.config.targetWidth > 0 && size.x > 0 ? entry.config.targetWidth / size.x : 1;
        fit.scale.setScalar(scale);
      }
      fit.position.set(-center.x * fit.scale.x, -bounds.min.y * fit.scale.y, -center.z * fit.scale.z);
      mount.add(fit);
      entry.normalization = {
        strategy, originalOrientedSize: size.toArray(), scaleXYZ: fit.scale.toArray(), rotationY: oriented.rotation.y,
        ...(strategy === 'per-axis-static' ? { targetSize: [...entry.config.targetSize] } : {}),
      };
    }
    const position = entry.config.position;
    if (Array.isArray(position) && position.length === 3 && position.every(Number.isFinite)) mount.position.fromArray(position);
    model.traverse((node) => {
      node.userData.assetId = entry.config.id;
      if (node.isMesh) {
        node.castShadow = true; node.receiveShadow = true;
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          if (!material?.isMeshStandardMaterial) continue;
          // Runtime lighting calibration only; original maps/GLBs stay intact.
          material.envMapIntensity = 0.5;
          material.roughness = Math.max(material.roughness, /street_base/.test(entry.config.id) ? 0.28 : 0.52);
          material.metalness = Math.min(material.metalness, 0.65);
          const minimumRoughness = /street_base/.test(entry.config.id) ? '0.24' : '0.48';
          material.onBeforeCompile = (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>',
              `#include <roughnessmap_fragment>\nroughnessFactor = max(roughnessFactor, ${minimumRoughness});`);
          };
          material.customProgramCacheKey = () => `techland-night-${minimumRoughness}`;
        }
      }
    });
    scene.add(mount);
    mount.updateMatrixWorld(true);
    entry.bounds = new THREE.Box3().setFromObject(mount, true);
    if (entry.bounds.isEmpty() || !entry.bounds.getSize(new THREE.Vector3()).toArray().every(Number.isFinite)) throw new Error('Placed model geometry has invalid bounds.');
    entry.normalization.displaySize = entry.bounds.getSize(new THREE.Vector3()).toArray();
    if (entry.config.id !== '13_street_base') worldBounds.union(entry.bounds);
    entry.mount = mount; entry.model = model; entry.animations = gltf.animations; entry.state = 'ready';
    if (entry.config.supportAsset) mount.visible = false;
    entry.instances = [];
    for (const [index, instanceConfig] of (entry.config.instances || []).entries()) {
      const instanceMount = mount.clone(true);
      const config = {...entry.config, ...instanceConfig, id: `${entry.config.id}_instance_${index + 1}`};
      instanceMount.position.fromArray(config.position);
      instanceMount.name = config.id;
      scene.add(instanceMount);
      entry.instances.push({config, mount: instanceMount, model: instanceMount, state: 'ready', normalization: {...entry.normalization}});
    }
    if (/project_vending/i.test(entry.config.id)) createVendingBranding(entry);
    if (/roller_shutter/i.test(entry.config.id)) configureShutter(entry);
    if (/lucky_cat/i.test(entry.config.id)) {
      const clip = gltf.animations.find((animation) => animation.name === 'Techland_Beckon');
      cat = { entry, mixer: new THREE.AnimationMixer(model), action: null, fx: null };
      if (clip) cat.action = cat.mixer.clipAction(clip);
      cat.fx = createEffects(entry);
      $('cat-wave').disabled = !clip;
      $('cat-wave').title = clip ? '' : t('waveMissing');
      setEffects(false);
    }
    if (/street_lamp/i.test(entry.config.id)) {
      const lamp = new THREE.PointLight('#ffc17a', 10, 5, 2);
      lamp.position.set(entry.bounds.getCenter(new THREE.Vector3()).x, entry.bounds.max.y - 0.1, entry.bounds.getCenter(new THREE.Vector3()).z + 0.1);
      scene.add(lamp);
      entry.lamp = lamp;
    }
    fitCamera();
  } catch (error) {
    clearTimeout(timeout);
    entry.state = 'error'; entry.error = error.message || String(error);
    loadedMount?.removeFromParent();
    for (const instance of entry.instances || []) instance.mount.removeFromParent();
    entry.instances = [];
    if (loadedModel) disposeObject(loadedModel);
    if (entry.postBranding) { entry.postBranding.removeFromParent(); disposeObject(entry.postBranding); entry.postBranding = null; entry.branding = null; }
    if (shutter?.entry === entry) {
      shutter = null; entry.shutter = null;
      $('shutter').disabled = true; $('shutter').setAttribute('aria-pressed', 'false');
      $('shutter').textContent = t('shutter'); $('shutter').title = t('shutterPending');
    }
    if (branding?.userData.assetId === entry.config.id) {
      branding.removeFromParent(); disposeObject(branding); branding = null;
    }
    if (cat?.entry === entry) {
      cat.mixer.stopAllAction();
      cat.mixer.uncacheRoot(cat.entry.model);
      if (cat.fx) { cat.fx.group.removeFromParent(); disposeObject(cat.fx.group); }
      cat = null; waveEnabled = false; effectsEnabled = false;
      $('cat-wave').disabled = true; $('cat-wave').setAttribute('aria-pressed', 'false');
      $('effects').disabled = true; $('effects').setAttribute('aria-pressed', 'false');
    }
    entry.lamp?.removeFromParent(); entry.lamp = null;
    entry.mount = null; entry.model = null; entry.animations = null; entry.bounds = null; entry.normalization = null;
    worldBounds.copy(nominalBounds);
    for (const other of entries.values()) if (other.state === 'ready' && other.bounds) worldBounds.union(other.bounds);
    console.warn(`Garage asset ${entry.config.id}:`, error);
  }
  updateRow(entry); notifyStatus(); requestFrame();
}

async function loadConfiguration() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  let config;
  try {
    const response = await fetch('./assets.json', { cache: 'no-cache', signal: controller.signal });
    if (!response.ok) throw new Error(zh ? '资产清单加载失败，请重新加载预览。' : 'The asset manifest could not load. Please reload the preview.');
    config = await response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(zh ? '资产清单读取超时，请重新加载预览。' : 'The asset manifest timed out. Please reload the preview.');
    throw error;
  } finally { clearTimeout(timeout); }
  if (!Array.isArray(config.assets)) throw new Error(zh ? '资产清单格式无效。' : 'Invalid asset manifest.');
  for (const asset of config.assets) {
    if (!asset.id || entries.has(asset.id)) continue;
    const item = document.createElement('li');
    const button = document.createElement('button'); button.className = 'asset-row';
    const name = document.createElement('span'); name.textContent = labelFor(asset);
    const stateLabel = document.createElement('span');
    button.append(name, stateLabel); item.append(button); $('asset-list').append(item);
    const state = /fail|error|rejected/i.test(asset.status || '') && !asset.file ? 'error' : 'pending';
    const entry = { config: asset, state, button, stateLabel, error: null };
    entries.set(asset.id, entry);
    button.addEventListener('click', () => { showInfo(asset.id, true); toggleAssetPanel(false); });
    updateRow(entry);
  }
  configurationLoaded = true;
  notifyStatus();
  // Limit simultaneous decoding to keep mobile memory use predictable.
  const queue = [...entries.values()].filter((entry) => entry.config.file);
  await Promise.all([0, 1, 2].map(async () => {
    while (queue.length) await loadAsset(queue.shift());
  }));
  refreshArtDirection();
}
$('retry-failed').addEventListener('click', async () => {
  const failed = [...entries.values()].filter((entry) => entry.state === 'error' && entry.config.file);
  for (const entry of failed) await loadAsset(entry);
  refreshArtDirection();
});

function setupPicking() {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let down = null;
  const activePointers = new Set();
  stage.addEventListener('pointerdown', (event) => {
    activePointers.add(event.pointerId);
    down = activePointers.size === 1 && event.button === 0 ? { x: event.clientX, y: event.clientY, id: event.pointerId, moved: false } : null;
  });
  stage.addEventListener('pointermove', (event) => { if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 7) down.moved = true; });
  stage.addEventListener('pointercancel', (event) => { activePointers.delete(event.pointerId); down = null; });
  stage.addEventListener('pointerup', (event) => {
    activePointers.delete(event.pointerId);
    const click = down && down.id === event.pointerId && !down.moved && Math.hypot(event.clientX - down.x, event.clientY - down.y) <= 7;
    down = null;
    if (!click) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const targets = [...entries.values()].filter((entry) => entry.state === 'ready' && entry.mount.visible).flatMap((entry) => [entry.mount, ...(entry.instances || []).filter((instance) => instance.mount.visible).map((instance) => instance.mount)]);
    if (branding) targets.push(branding);
    if (plantInstances) targets.push(plantInstances);
    const hit = raycaster.intersectObjects(targets, true).find((intersection) => intersection.object.userData.assetId);
    if (hit) showInfo(hit.object.userData.assetId); else closeInfo();
  });
  stage.addEventListener('keydown', (event) => {
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    if (event.key === 'ArrowLeft') spherical.theta -= 0.12;
    else if (event.key === 'ArrowRight') spherical.theta += 0.12;
    else if (event.key === 'ArrowUp') spherical.phi -= 0.08;
    else if (event.key === 'ArrowDown') spherical.phi += 0.08;
    else if (event.key === '+' || event.key === '=') spherical.radius *= 0.9;
    else if (event.key === '-' || event.key === '_') spherical.radius *= 1.1;
    else return;
    event.preventDefault();
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.08, Math.PI * 0.49);
    spherical.radius = THREE.MathUtils.clamp(spherical.radius, controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    controls.update(); requestFrame();
  });
}

async function start() {
  stage.dataset.state = 'loading';
  try { renderer = new THREE.WebGLRenderer({ antialias: !smallScreen.matches, powerPreference: 'high-performance' }); }
  catch { fatal(t('webgl')); return; }
  // A slow module download can complete after the HTML watchdog has fired.
  $('fatal').hidden = true;
  $('fatal-message').textContent = '';
  renderer.setPixelRatio(Math.min(devicePixelRatio, smallScreen.matches ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.append(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', (event) => { event.preventDefault(); contextLost = true; fatal(t('context')); });
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#070b14');
  scene.fog = new THREE.FogExp2('#070b14', 0.025);
  const studio = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio, 0.03).texture;
  scene.environmentIntensity = 0.3;
  studio.dispose(); pmrem.dispose();
  createNightEnvironment(THREE, Reflector, scene, {mobile: textureLimit === 512});
  camera = new THREE.PerspectiveCamera(36, 1, 0.03, 150);
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (textureLimit > 512) composer.addPass(new UnrealBloomPass(new THREE.Vector2(800, 600), 0.28, 0.4, 1.15));
  composer.addPass(new OutputPass());
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !motion.matches; controls.dampingFactor = 0.09;
  controls.maxPolarAngle = Math.PI * 0.49; controls.minPolarAngle = 0.08;
  controls.screenSpacePanning = true;
  controls.addEventListener('change', requestFrame);
  $('overview').addEventListener('click', () => fitCamera('overview'));
  $('front').addEventListener('click', () => fitCamera('front'));
  const resize = () => {
    renderer.setPixelRatio(Math.min(devicePixelRatio, smallScreen.matches ? 1.5 : 2));
    renderer.setSize(stage.clientWidth, stage.clientHeight);
    composer.setPixelRatio(Math.min(devicePixelRatio, textureLimit === 512 ? 1 : 1.5));
    composer.setSize(stage.clientWidth, stage.clientHeight);
    camera.aspect = stage.clientWidth / stage.clientHeight;
    camera.updateProjectionMatrix(); fitCamera();
  };
  new ResizeObserver(resize).observe(stage);
  resize(); setupPicking(); requestFrame();
  window.techlandGarage = {
    getAsset: (id) => entries.get(id), getCounts: statusCounts,
    fitCamera, setWave, setEffects, setShutterOpen,
    get configurationLoaded() { return configurationLoaded; },
  };
  await loadConfiguration();
}
start().catch((error) => { console.error(error); fatal(error.message || String(error)); });
