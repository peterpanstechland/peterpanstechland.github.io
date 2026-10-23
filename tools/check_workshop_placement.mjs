// Exercise the actual placement code against actual GLB geometry, without a GPU.
// Images are omitted from this CPU-only load; inspect_tripo_glb.py decodes them.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {settleGarageAssets} from '../static/maker-garage-preview/ground-contact.js';

const root = path.resolve('static/maker-garage-preview');
const config = JSON.parse(await fs.readFile(path.join(root, 'assets.json'), 'utf8'));
globalThis.ProgressEvent ??= class {constructor(type, data) {this.type = type; Object.assign(this, data);}};
async function geometryOnlyGLB(file) {
  const bytes = await fs.readFile(file);
  const chunks = [];
  for (let offset = 12; offset < bytes.length;) {
    const length = bytes.readUInt32LE(offset), kind = bytes.readUInt32LE(offset + 4);
    chunks.push({kind, data: bytes.subarray(offset + 8, offset + 8 + length)});
    offset += length + 8;
  }
  const doc = JSON.parse(chunks.find((chunk) => chunk.kind === 0x4e4f534a).data.toString());
  doc.images = []; doc.textures = []; doc.samplers = [];
  doc.materials = (doc.materials || []).map(() => ({pbrMetallicRoughness: {}}));
  const json = Buffer.from(JSON.stringify(doc));
  const padded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  chunks[0].data = padded;
  const output = Buffer.alloc(12 + chunks.reduce((sum, chunk) => sum + 8 + chunk.data.length, 0));
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  let cursor = 12;
  for (const chunk of chunks) {
    output.writeUInt32LE(chunk.data.length, cursor); output.writeUInt32LE(chunk.kind, cursor + 4);
    chunk.data.copy(output, cursor + 8); cursor += chunk.data.length + 8;
  }
  return new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength), '');
}
const scene = new THREE.Scene(), entries = new Map();
for (const item of config.assets.filter((asset) => asset.file)) {
  const {scene: model} = await geometryOnlyGLB(path.join(root, item.file));
  const mount = new THREE.Group();
  if (item.normalized) {
    const placement = new THREE.Group();
    placement.rotation.y = item.rotationY || 0;
    placement.scale.setScalar(item.uniformScale || 1);
    placement.add(model); mount.add(placement);
  } else {
    const oriented = new THREE.Group(); oriented.add(model);
    oriented.rotation.y = item.rotationY ?? -Math.PI / 2;
    oriented.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(oriented, true);
    const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
    const fit = new THREE.Group(); fit.add(oriented);
    if (item.targetSize) fit.scale.set(...item.targetSize.map((value, index) => value / size.getComponent(index)));
    else fit.scale.setScalar(item.targetHeight ? item.targetHeight / size.y : item.targetWidth ? item.targetWidth / size.x : 1);
    fit.position.set(-center.x * fit.scale.x, -bounds.min.y * fit.scale.y, -center.z * fit.scale.z);
    mount.add(fit);
  }
  mount.position.fromArray(item.position); scene.add(mount);
  const entry = {config: item, model, mount, state: 'ready', normalization: {}, instances: []};
  entries.set(item.id, entry);
  for (const [index, instance] of (item.instances || []).entries()) {
    const clone = mount.clone(true), cloneConfig = {...item, ...instance, id: `${item.id}_instance_${index + 1}`};
    clone.position.fromArray(cloneConfig.position); scene.add(clone);
    entry.instances.push({config: cloneConfig, mount: clone, model: clone, state: 'ready', normalization: {}});
  }
}
const first = settleGarageAssets(THREE, scene, entries);
const positions = [...entries.values()].flatMap((entry) => [entry, ...entry.instances]).map((entry) => [entry.config.id, entry.mount.position.toArray()]);
first.supports.removeFromParent();
const second = settleGarageAssets(THREE, scene, entries);
const repeated = [...entries.values()].flatMap((entry) => [entry, ...entry.instances]).map((entry) => [entry.config.id, entry.mount.position.toArray()]);
assert.deepEqual(repeated, positions, 'Repeated placement must not accumulate translations.');
const workshop = [...entries.values()].flatMap((entry) => [entry, ...entry.instances]).filter((entry) => entry.config.supportAsset);
const failures = workshop.filter((entry) => entry.placementStatus !== 'supported').map((entry) => entry.config.id);
const output = {version: 1, workshopInstances: workshop.length, idempotent: true, allSupported: failures.length === 0, failures, report: second.report};
// Explicitly exercise missing-table fallback and recovery on the actual models.
const bench = entries.get('23_workbench');
if (bench) {
  bench.state = 'error'; second.supports.removeFromParent();
  const unavailable = settleGarageAssets(THREE, scene, entries);
  const dependent = workshop.filter((entry) => entry.config.supportAsset === '23_workbench');
  output.missingWorkbenchHidesAllDevices = dependent.every((entry) => !entry.mount.visible);
  assert.ok(output.missingWorkbenchHidesAllDevices);
  bench.state = 'ready'; unavailable.supports.removeFromParent();
  settleGarageAssets(THREE, scene, entries);
  output.workbenchRecoveryRestoresDevices = dependent.every((entry) => entry.mount.visible);
}
await fs.mkdir('assets/tripo/records', {recursive: true});
await fs.writeFile('assets/tripo/records/interior-equipment-placement.qa.json', JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({workshopInstances: output.workshopInstances, allSupported: output.allSupported, failures, idempotent: true, missingWorkbenchHidesAllDevices: output.missingWorkbenchHidesAllDevices, workbenchRecoveryRestoresDevices: output.workbenchRecoveryRestoresDevices}));
if (failures.length) process.exitCode = 1;
