/**
 * Ground the real GLBs using their evaluated triangles and low foot vertices.
 * This module never changes source geometry/materials/textures or GLB files.
 * The returned skirt/bottom are explicitly local support hardware, not Tripo.
 * Caller owns removal/disposal of the previous returned supports group.
 */
export function settleGarageAssets(THREE, scene, entries) {
  const supports = new THREE.Group();
  supports.name = 'LOCAL_STREET_UNDERSIDE_SUPPORT';
  supports.userData = {locallyAuthored: true, supportHardware: true};
  const report = {version: 1, method: 'evaluated foot vertices and downward triangle rays', assets: {}, warnings: [], support: null};
  const ready = (id) => {
    const entry = entries.get(id);
    return entry?.state === 'ready' && entry.mount && entry.model ? entry : null;
  };
  const vector = new THREE.Vector3();
  const updateBounds = (entry) => {
    // SkinnedMesh.updateMatrixWorld also refreshes its attached bind inverse;
    // updateWorldMatrix alone leaves stale skinning after a mount translation.
    entry.mount.parent?.updateWorldMatrix(true, false);
    entry.mount.updateMatrixWorld(true);
    entry.model.traverse((mesh) => mesh.skeleton?.update());
    entry.bounds = new THREE.Box3().setFromObject(entry.model, true);
  };
  // Re-running after a retry must not add the previous settlement a second time.
  const allEntries = [...entries.values()].flatMap((entry) => [entry, ...(entry.instances || [])]);
  for (const entry of allEntries) {
    if (entry.state !== 'ready' || !entry.mount || !entry.model) continue;
    const p = entry.config.position;
    entry.mount.position.fromArray(Array.isArray(p) && p.length === 3 && p.every(Number.isFinite) ? p : [0, 0, 0]);
    updateBounds(entry);
  }
  scene.updateMatrixWorld(true);

  function evaluatedMeshes(entry, visit) {
    entry.model.traverse((mesh) => {
      if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
      mesh.skeleton?.update();
      const count = mesh.geometry.attributes.position.count;
      const points = new Float64Array(count * 3);
      for (let i = 0; i < count; i++) {
        mesh.getVertexPosition(i, vector).applyMatrix4(mesh.matrixWorld);
        vector.toArray(points, i * 3);
      }
      visit(mesh, points);
    });
  }

  function upwardSurface(entry, minY = -Infinity, maxY = Infinity) {
    const triangles = [];
    const cells = new Map();
    const cellSize = 0.3;
    evaluatedMeshes(entry, (mesh, points) => {
      const geometry = mesh.geometry;
      const index = geometry.index;
      const available = index ? index.count : points.length / 3;
      const start = Math.max(0, geometry.drawRange.start || 0);
      const end = Math.min(available, start + geometry.drawRange.count);
      for (let i = start; i + 2 < end; i += 3) {
        const ids = [0, 1, 2].map((offset) => (index ? index.getX(i + offset) : i + offset) * 3);
        const a = Array.from(points.subarray(ids[0], ids[0] + 3));
        const b = Array.from(points.subarray(ids[1], ids[1] + 3));
        const c = Array.from(points.subarray(ids[2], ids[2] + 3));
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const length = Math.hypot(nx, ny, nz);
        // World-space normal: correct even with the runtime nonuniform fit.
        if (length < 1e-12 || ny / length < 0.2) continue;
        if (Math.max(a[1], b[1], c[1]) < minY || Math.min(a[1], b[1], c[1]) > maxY) continue;
        const triangle = {a, b, c, ux, uy, uz, vx, vy, vz, denominator: ux * vz - uz * vx};
        const ordinal = triangles.push(triangle) - 1;
        const x0 = Math.floor(Math.min(a[0], b[0], c[0]) / cellSize), x1 = Math.floor(Math.max(a[0], b[0], c[0]) / cellSize);
        const z0 = Math.floor(Math.min(a[2], b[2], c[2]) / cellSize), z1 = Math.floor(Math.max(a[2], b[2], c[2]) / cellSize);
        for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
          const key = `${x},${z}`;
          if (!cells.has(key)) cells.set(key, []);
          cells.get(key).push(ordinal);
        }
      }
    });
    return {
      triangles,
      // Exact barycentric intersection with a ray descending along world -Y.
      ray(x, z) {
        let result = -Infinity;
        const candidates = cells.get(`${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`) || [];
        for (const index of candidates) {
          const t = triangles[index], dx = x - t.a[0], dz = z - t.a[2];
          const u = (dx * t.vz - dz * t.vx) / t.denominator;
          const v = (t.ux * dz - t.uz * dx) / t.denominator;
          if (u < -1e-7 || v < -1e-7 || u + v > 1 + 1e-7) continue;
          const y = t.a[1] + u * t.uy + v * t.vy;
          if (y >= minY && y <= maxY && y > result) result = y;
        }
        return Number.isFinite(result) ? result : null;
      },
    };
  }

  function footSamples(entry) {
    const cells = new Map();
    const band = THREE.MathUtils.clamp(entry.bounds.max.y - entry.bounds.min.y, 0.5, 1.5) * 0.035;
    evaluatedMeshes(entry, (_mesh, points) => {
      for (let i = 0; i < points.length; i += 3) {
        const x = points[i], y = points[i + 1], z = points[i + 2];
        if (y > entry.bounds.min.y + band) continue;
        const key = `${Math.round(x / 0.065)},${Math.round(z / 0.065)}`;
        if (!cells.has(key) || cells.get(key)[1] > y) cells.set(key, [x, y, z]);
      }
    });
    const all = [...cells.values()];
    if (all.length <= 256) return all;
    // Uniform deterministic sampling retains spatial coverage on large feet.
    return Array.from({length: 256}, (_, i) => all[Math.floor(i * all.length / 256)]);
  }

  function record(entry, data) {
    updateBounds(entry);
    const item = {...data, finalPosition: entry.mount.position.toArray(), finalScale: entry.mount.scale.toArray(), bounds: {min: entry.bounds.min.toArray(), max: entry.bounds.max.toArray()}};
    entry.normalization = {...entry.normalization, groundContact: item};
    report.assets[entry.config.id] = item;
  }
  function settle(entry, surface, supportId) {
    if (!entry) return;
    if (!surface) {
      record(entry, {status: 'support-unavailable', supportId});
      report.warnings.push(`${entry.config.id}: supporting asset ${supportId} is unavailable; configured placement retained.`);
      return;
    }
    const samples = footSamples(entry), offsets = [], heights = [];
    for (const [x, y, z] of samples) {
      const supportY = surface.ray(x, z);
      if (supportY === null) continue;
      offsets.push(supportY - y); heights.push(supportY);
    }
    if (!offsets.length) {
      record(entry, {status: 'no-support-under-feet', supportId, sampleCount: samples.length, supportedSamples: 0});
      report.warnings.push(`${entry.config.id}: no real support under sampled feet; configured placement retained.`);
      return;
    }
    // Highest constraint is first contact for rigid feet; never average feet
    // across a curb. 2 mm seating overlap prevents an artificial bright gap.
    const deltaY = Math.max(...offsets) - 0.002;
    entry.mount.position.y += deltaY;
    const spread = Math.max(...heights) - Math.min(...heights);
    record(entry, {status: offsets.length === samples.length ? 'settled' : 'settled-partial-support', supportId, deltaY, sampleCount: samples.length, supportedSamples: offsets.length, supportY: [Math.min(...heights), Math.max(...heights)], supportHeightSpread: spread, seatingOverlap: 0.002});
    if (offsets.length < samples.length) report.warnings.push(`${entry.config.id}: ${samples.length - offsets.length}/${samples.length} foot samples extend beyond the real supporting surface.`);
    if (spread > 0.065) report.warnings.push(`${entry.config.id}: foot support crosses ${spread.toFixed(3)} m of height variation; inspect the placement.`);
  }

  const street = ready('13_street_base');
  const streetSurface = street ? upwardSurface(street) : null;
  if (street) record(street, {status: 'source-placement-preserved', deltaY: 0});
  const shell = ready('01_garage_shell');
  if (shell && street) {
    shell.mount.position.y -= 0.22;
    record(shell, {status: 'reviewed-native-plinth-offset', supportId: '13_street_base', deltaY: -0.22, nativeInteriorFloorAboveMount: [0.20, 0.25]});
  } else if (shell) record(shell, {status: 'support-unavailable', supportId: '13_street_base'});

  for (const id of ['04_lucky_cat', '05_project_vending', '08_street_lamp', '09_trash_bin', '10_utility_cabinet', '11_tree', '12_plants_grass']) settle(ready(id), streetSurface, '13_street_base');
  const floor = shell ? upwardSurface(shell, shell.mount.position.y + 0.08, shell.mount.position.y + 0.40) : null;
  settle(ready('06_showcase_zone'), floor, '01_garage_shell/interior-floor');

  // Equipment is supported by the real floor or real tabletop triangles. A
  // failed parent never leaves its devices suspended at their nominal height.
  const workshop = allEntries.filter((entry) => entry.state === 'ready' && entry.config.supportAsset);
  const surfaces = new Map();
  function placeWorkshop(entry, surface, supportId) {
    settle(entry, surface, supportId);
    const contact = report.assets[entry.config.id];
    const supported = contact?.status === 'settled';
    entry.placementStatus = supported ? 'supported' : 'support-unavailable';
    entry.mount.visible = supported;
    if (!supported) return;
    const samples = footSamples(entry);
    const gaps = samples.map(([x, y, z]) => {
      const supportY = surface.ray(x, z);
      return supportY === null ? null : y - supportY;
    }).filter((gap) => gap !== null);
    contact.actualFootGapRange = gaps.length ? [Math.min(...gaps), Math.max(...gaps)] : null;
    // The native floor is uneven. Local adjustable pads connect each real
    // furniture foot to that floor while keeping the tabletop level.
    if (entry.config.levelFeet) {
      const center = entry.bounds.getCenter(new THREE.Vector3());
      const groups = new Map();
      for (const point of samples) {
        const key = `${point[0] < center.x ? -1 : 1},${point[2] < center.z ? -1 : 1}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(point);
      }
      contact.adjustableFeet = [];
      for (const points of groups.values()) {
        const x = points.reduce((sum, p) => sum + p[0], 0) / points.length;
        const z = points.reduce((sum, p) => sum + p[2], 0) / points.length;
        const top = Math.min(...points.map((p) => p[1])) + 0.004;
        const bottom = surface.ray(x, z);
        if (bottom === null || top - bottom > 0.10) {
          entry.placementStatus = 'support-unavailable'; entry.mount.visible = false;
          report.warnings.push(`${entry.config.id}: adjustable foot has no suitable real floor.`);
          continue;
        }
        const height = Math.max(0.004, top - bottom + 0.002);
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.032, height, 12),
          new THREE.MeshStandardMaterial({color: '#20252b', roughness: 0.78, metalness: 0.25}));
        pad.position.set(x, bottom + height / 2 - 0.001, z);
        pad.castShadow = true; pad.receiveShadow = true;
        pad.name = `${entry.config.id}_LOCAL_ADJUSTABLE_FOOT`;
        pad.userData = {locallyAuthored: true, supportHardware: true, assetId: entry.config.id};
        supports.add(pad);
        contact.adjustableFeet.push({x, z, bottom, top, height, locallyAuthored: true});
      }
    }
    entry.normalization.groundContact = contact;
  }
  for (const entry of workshop.filter((item) => item.config.supportAsset === '01_garage_shell')) {
    placeWorkshop(entry, floor, '01_garage_shell/interior-floor');
    if (entry.config.tabletop && entry.mount.visible) {
      surfaces.set(entry.config.id, upwardSurface(entry, entry.bounds.max.y - 0.045, entry.bounds.max.y + 0.005));
    }
  }
  for (const entry of workshop.filter((item) => item.config.supportAsset !== '01_garage_shell')) {
    placeWorkshop(entry, surfaces.get(entry.config.supportAsset), entry.config.supportAsset);
  }
  for (const [id, y, z] of [['02_roller_shutter', 0.20, 1.13], ['03_profile_sign', 2.55, 1.25]]) {
    const entry = ready(id);
    if (!entry) continue;
    if (!shell) { record(entry, {status: 'support-unavailable', supportId: '01_garage_shell'}); continue; }
    entry.mount.position.y = shell.mount.position.y + y;
    entry.mount.position.z = shell.mount.position.z + z;
    if (id === '02_roller_shutter') {
      // Fit the measured 1.57 m clear height while keeping local slat motion.
      entry.mount.position.x = shell.mount.position.x + 0.30;
      entry.mount.scale.set(1, 0.71, 1);
    }
    record(entry, {status: 'reviewed-facade-anchor', supportId: '01_garage_shell', facadeZ: 1.05, localAnchor: [entry.mount.position.x - shell.mount.position.x, y, z]});
  }

  if (streetSurface) {
    // Use actual upward source triangles as the exact upper outline. No new
    // top surface is made: the original textured road stays fully visible.
    const floorY = -0.36, positions = [], edges = new Map();
    const key = (p) => p.map((value) => Math.round(value * 100000)).join(',');
    const emit = (a, b, c) => positions.push(...a, ...b, ...c);
    let bottomTriangles = 0, skirtTriangles = 0, ambiguousEdges = 0;
    for (const {a, b, c} of streetSurface.triangles) {
      if (Math.min(a[1], b[1], c[1]) <= floorY + 1e-5) continue;
      const aa = [a[0], floorY, a[2]], bb = [b[0], floorY, b[2]], cc = [c[0], floorY, c[2]];
      emit(aa, cc, bb); bottomTriangles++;
      for (const [p, q] of [[a, b], [b, c], [c, a]]) {
        const pk = key(p), qk = key(q), edgeKey = pk < qk ? `${pk}|${qk}` : `${qk}|${pk}`;
        const edge = edges.get(edgeKey);
        if (edge) edge.count++;
        else edges.set(edgeKey, {p, q, count: 1});
      }
    }
    for (const {p, q, count} of edges.values()) {
      if (count > 2) ambiguousEdges++;
      if (count !== 1) continue;
      const lowP = [p[0], floorY, p[2]], lowQ = [q[0], floorY, q[2]];
      emit(q, p, lowP); emit(q, lowP, lowQ); skirtTriangles += 2;
    }
    if (positions.length) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const material = new THREE.MeshStandardMaterial({color: '#26303b', roughness: 0.96, metalness: 0, side: THREE.DoubleSide});
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = 'REAL_ROAD_OUTLINE_LOCAL_SKIRT_AND_BOTTOM';
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData = {locallyAuthored: true, supportHardware: true, sourceTaskId: street.config.taskId, sourceAssetId: street.config.id, topSurfaceAdded: false};
      supports.userData = {...mesh.userData, floorY};
      supports.add(mesh);
    }
    report.support = {sourceTaskId: street.config.taskId, floorY, sourceUpwardTriangles: streetSurface.triangles.length, bottomTriangles, skirtTriangles, ambiguousEdges, topSurfaceAdded: false, provenance: 'Local underside closure from real street triangle boundaries; original GLB and textures unchanged', limitation: 'Retains source irregular outline and holes; not a watertight manufacturing certification.'};
    if (ambiguousEdges) report.warnings.push(`Street source has ${ambiguousEdges} ambiguous upward-surface edges; underside closure is a preview support, not a watertight repair.`);
  }
  supports.userData.report = report.support;
  scene.add(supports);
  scene.updateMatrixWorld(true);
  const roof = shell ? upwardSurface(shell, shell.mount.position.y + 2.0) : null;
  report.instances = {};
  function settleInstance(model, supportId, id) {
    const entry = {model, mount: model, config: {id}, normalization: {}};
    updateBounds(entry);
    settle(entry, supportId === 'roof' ? roof : streetSurface, supportId === 'roof' ? '01_garage_shell/roof' : '13_street_base');
    report.instances[id] = report.assets[id];
    delete report.assets[id];
    return entry.normalization.groundContact;
  }
  return {supports, report, settleInstance};
}
