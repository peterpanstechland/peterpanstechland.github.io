import fs from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
globalThis.ProgressEvent ??= class {constructor(type, data) {this.type = type; Object.assign(this, data);}};
export async function geometryOnlyGLB(file) {
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
