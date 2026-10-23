/** Accurate local labels/screens on verified Tripo surfaces, not generated assets. */
export function createWorkshopDetails(THREE, scene, entries) {
  const group = new THREE.Group();
  group.name = 'LOCAL_WORKSHOP_LABELS_AND_SCREEN_ART';
  group.userData.locallyAuthored = true;
  const anchors = [];

  function textureFor(spec) {
    const canvas = document.createElement('canvas');
    canvas.width = 768; canvas.height = spec.screen ? 432 : 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = spec.screen ? '#07141b' : '#c9ced0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (spec.screen) {
      ctx.strokeStyle = '#15333e'; ctx.lineWidth = 1;
      for (let x = 32; x < 768; x += 40) { ctx.beginPath(); ctx.moveTo(x, 76); ctx.lineTo(x, 400); ctx.stroke(); }
      for (let y = 76; y < 420; y += 40) { ctx.beginPath(); ctx.moveTo(24, y); ctx.lineTo(744, y); ctx.stroke(); }
      ctx.fillStyle = '#86e0d5'; ctx.font = 'bold 24px monospace'; ctx.fillText(spec.text, 26, 44);
      if (spec.screen === 'scope') {
        ctx.strokeStyle = '#98ed79'; ctx.lineWidth = 5; ctx.beginPath();
        for (let x = 28; x <= 740; x += 2) {
          const y = 245 + Math.sin((x - 28) / 45) * 85;
          if (x === 28) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else if (spec.screen === 'cad') {
        ctx.strokeStyle = '#7de5e1'; ctx.lineWidth = 4;
        const corners = [[225, 180], [475, 180], [475, 350], [225, 350], [325, 120], [575, 120], [575, 290], [325, 290]];
        for (const [a, b] of [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]) {
          ctx.beginPath(); ctx.moveTo(...corners[a]); ctx.lineTo(...corners[b]); ctx.stroke();
        }
        ctx.fillStyle = '#d5976c'; ctx.font = '20px monospace'; ctx.fillText('TECHLAND / DESIGN STUDY', 26, 405);
      } else {
        ctx.font = '23px monospace';
        for (const [i, line] of ['> workspace: techland', '> board: maker prototype', '> source / build / test', '> ready for the next idea'].entries()) {
          ctx.fillStyle = i === 3 ? '#e8b382' : '#8db3bd'; ctx.fillText(line, 45, 140 + i * 55);
        }
      }
    } else {
      ctx.fillStyle = '#141c20'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `bold ${spec.text.length > 16 ? 56 : 74}px Arial, sans-serif`;
      ctx.fillText(spec.text, 384, spec.subtext ? 105 : 128, 714);
      if (spec.subtext) { ctx.font = '30px Arial, sans-serif'; ctx.fillText(spec.subtext, 384, 184, 700); }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function label(entry, spec) {
    if (!entry?.mount?.visible) return;
    const placement = entry.mount.children[0];
    placement.updateWorldMatrix(true, true);
    const localNormal = spec.face === 'left' ? new THREE.Vector3(-1, 0, 0) : spec.face === 'right' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    const normal = localNormal.transformDirection(placement.matrixWorld);
    const point = placement.localToWorld(new THREE.Vector3(...spec.center));
    const ray = new THREE.Raycaster(point.clone().addScaledVector(normal, 0.5), normal.clone().negate(), 0, 1.1);
    const hit = ray.intersectObject(entry.model, true)[0];
    if (!hit) return;
    const texture = textureFor(spec);
    const material = spec.screen
      ? new THREE.MeshBasicMaterial({map: texture, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2})
      : new THREE.MeshStandardMaterial({map: texture, roughness: 0.7, metalness: 0.12, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2});
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(...spec.size), material);
    plane.position.copy(hit.point).addScaledVector(normal, 0.0009);
    plane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    plane.name = `${entry.config.id}_AUTHORED_${spec.screen || 'LABEL'}`;
    plane.userData = {assetId: entry.config.sourceAssetId || entry.config.id, locallyAuthored: true};
    group.add(plane);
    anchors.push({assetId: entry.config.id, text: spec.text, surface: hit.point.toArray(), position: plane.position.toArray(), surfaceOffset: 0.0009});
  }
  for (const entry of entries.values()) {
    if (entry.state !== 'ready' || !entry.mount.visible) continue;
    for (const spec of entry.config.labels || []) label(entry, spec);
    for (const instance of entry.instances || []) {
      instance.config.sourceAssetId = entry.config.id;
      for (const spec of instance.config.labels || []) label(instance, spec);
    }
  }
  group.userData.anchors = anchors;
  scene.add(group);
  return group;
}
