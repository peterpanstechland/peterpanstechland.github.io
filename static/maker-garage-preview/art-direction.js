/**
 * Locally authored mounted signs for the existing, real Tripo garage.
 * Typography and sign hardware are post-production additions, not Tripo assets.
 * No remote fonts, images, dependencies, lighting, or animation are required.
 */
export function createGarageGraphics(THREE, scene, entries) {
  const groupName = 'TECHLAND_LOCAL_GARAGE_GRAPHICS';
  const existing = scene.getObjectByName(groupName);
  if (existing) return existing;

  const attribution = {
    locallyAuthored: true,
    graphicOnly: true,
    assetId: '01_garage_shell',
    provenance: 'Local CanvasTexture typography applied after Tripo generation; source GLB unchanged',
  };
  const group = new THREE.Group();
  group.name = groupName;
  group.userData = { ...attribution, graphicOnly: false, containsLocalSignHardware: true };
  scene.add(group);

  const shell = entries?.get('01_garage_shell');
  if (!shell || shell.state !== 'ready' || !shell.bounds) {
    group.userData.status = 'No verified garage shell; no graphic overlays created';
    return group;
  }

  const mobile = typeof matchMedia === 'function' && matchMedia('(max-width: 650px)').matches;
  const maximumTextureSize = mobile ? 512 : 1024;
  const bounds = shell.bounds;
  const center = bounds.getCenter(new THREE.Vector3());
  const groundY = bounds.min.y;
  const shellCenterZ = center.z;
  const hardwareAttribution = {
    ...attribution,
    graphicOnly: false,
    supportHardware: true,
    provenance: 'Locally authored sign backing, frame and fasteners mounted to inspected Tripo geometry; source GLB unchanged',
  };

  function canvasWithLogicalSize(logicalWidth, logicalHeight, pixelWidth) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(pixelWidth, maximumTextureSize);
    canvas.height = Math.round(canvas.width * logicalHeight / logicalWidth);
    // Tall signs have a separately bounded long edge as well.
    if (canvas.height > maximumTextureSize) {
      canvas.height = maximumTextureSize;
      canvas.width = Math.round(canvas.height * logicalWidth / logicalHeight);
    }
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable for garage lettering.');
    context.scale(canvas.width / logicalWidth, canvas.height / logicalHeight);
    return { canvas, context };
  }

  function makeGraphic(name, canvas, width, height, position, content, parent = group) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = mobile ? 2 : 4;
    texture.userData = { ...attribution, content, pixelSize: [canvas.width, canvas.height] };
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.012,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    material.name = `${name}_LOCAL_PRINT`;
    material.userData = { ...attribution, boundedColorOutput: true, lightingAuthoredHere: false };
    const geometry = new THREE.PlaneGeometry(width, height);
    geometry.userData = { ...attribution };
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.copy(position);
    mesh.renderOrder = 3;
    mesh.userData = { ...attribution, content };
    parent.add(mesh);
    return mesh;
  }

  const metal = new THREE.MeshStandardMaterial({ color: '#24212b', metalness: 0.72, roughness: 0.48 });
  const edgeMetal = new THREE.MeshStandardMaterial({ color: '#6c6174', metalness: 0.78, roughness: 0.36 });
  const boltMetal = new THREE.MeshStandardMaterial({ color: '#b2a6b1', metalness: 0.85, roughness: 0.32 });
  for (const material of [metal, edgeMetal, boltMetal]) material.userData = { ...hardwareAttribution };

  function hardware(name, geometry, material, position, parent = group) {
    geometry.userData = { ...hardwareAttribution };
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; mesh.position.copy(position);
    mesh.userData = { ...hardwareAttribution };
    mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function box(name, size, position, material = metal, parent = group) {
    return hardware(name, new THREE.BoxGeometry(...size), material, new THREE.Vector3(...position), parent);
  }

  function rod(name, start, end, radius, material = metal, parent = group) {
    const direction = new THREE.Vector3().subVectors(end, start);
    const mesh = hardware(name, new THREE.CylinderGeometry(radius, radius, direction.length(), 8), material,
      new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5), parent);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return mesh;
  }

  function signCase(name, width, height, depth, position, rotationY = 0) {
    const sign = new THREE.Group(); sign.name = name;
    sign.position.copy(position); sign.rotation.y = rotationY;
    sign.userData = { ...hardwareAttribution, dimensions: [width, height, depth] };
    group.add(sign);
    const cut = Math.min(width, height) * 0.055;
    const shape = new THREE.Shape();
    const outline = [[-width / 2 + cut, -height / 2], [width / 2 - cut, -height / 2], [width / 2, -height / 2 + cut], [width / 2, height / 2 - cut], [width / 2 - cut, height / 2], [-width / 2 + cut, height / 2], [-width / 2, height / 2 - cut], [-width / 2, -height / 2 + cut]];
    outline.forEach(([x, y], index) => index ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath();
    const casing = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, steps: 1 });
    casing.translate(0, 0, -depth / 2);
    hardware(`${name}_METAL_CASING`, casing, metal, new THREE.Vector3(), sign);
    for (const side of [-1, 1]) {
      const z = side * (depth / 2 + 0.004);
      for (const edge of [-1, 1]) {
        box(`${name}_FRAME_HORIZONTAL_${side}_${edge}`, [width - 2 * cut, 0.018, 0.012], [0, edge * (height / 2 - 0.018), z], edgeMetal, sign);
        box(`${name}_FRAME_VERTICAL_${side}_${edge}`, [0.018, height - 2 * cut, 0.012], [edge * (width / 2 - 0.018), 0, z], edgeMetal, sign);
      }
      for (const x of [-width / 2 + 0.045, width / 2 - 0.045]) for (const y of [-height / 2 + 0.045, height / 2 - 0.045]) {
        const tip = side * (depth / 2 + 0.011);
        rod(`${name}_BOLT_${side}_${x}_${y}`, new THREE.Vector3(x, y, tip - 0.004), new THREE.Vector3(x, y, tip + 0.004), 0.009, boltMetal, sign);
      }
    }
    return sign;
  }

  // These rays target the inspected fascia rather than bounds.max.z, which is
  // extended almost a metre by the generated pavement and foreground props.
  const mountingRay = new THREE.Raycaster();
  const fasciaAnchors = [];
  shell.mount.updateWorldMatrix(true, true);
  for (const x of [-0.9, 0.9]) for (const y of [2.57, 2.85]) {
    mountingRay.set(new THREE.Vector3(center.x + x, groundY + y, shellCenterZ + 3), new THREE.Vector3(0, 0, -1));
    const hit = mountingRay.intersectObject(shell.model || shell.mount, true).find((item) => item.point.z > shellCenterZ + 0.7 && item.point.z < shellCenterZ + 1.35);
    if (hit) fasciaAnchors.push(hit.point.clone());
  }

  // The brand is an original alphabet of hand-drawn outlines, not rendered
  // system-font text. Coordinates are deliberately uneven: cut corners, kicked
  // stems and open counters keep a painted street hand instead of a logo font.
  const brand = canvasWithLogicalSize(1024, 280, maximumTextureSize);
  const ink = brand.context;
  const glyphs = {
    P: { width: 70, path: 'M3 99 L10 5 L43 1 L69 15 L66 49 L51 59 L30 61 L27 96 Z M32 23 L30 42 L48 38 L49 23 Z' },
    E: { width: 68, path: 'M9 4 L67 0 L62 25 L33 26 L30 41 L59 36 L57 59 L29 61 L27 77 L65 71 L59 97 L2 100 Z' },
    T: { width: 75, path: 'M0 9 L75 1 L69 29 L48 28 L42 98 L15 100 L22 31 L3 35 Z' },
    R: { width: 73, path: 'M3 99 L10 4 L45 1 L68 14 L65 48 L49 58 L72 91 L46 100 L29 64 L27 96 Z M32 22 L30 41 L48 37 L49 23 Z' },
    A: { width: 76, path: 'M0 99 L29 4 L52 0 L76 95 L49 100 L45 77 L25 80 L20 99 Z M30 59 L42 56 L37 28 Z' },
    N: { width: 77, path: 'M2 99 L9 6 L32 0 L51 51 L51 7 L76 2 L69 99 L46 96 L27 48 L26 94 Z' },
    S: { width: 73, path: 'M68 5 L65 29 L41 22 L27 28 L29 38 L53 41 L70 57 L65 84 L45 99 L3 93 L7 68 L30 77 L44 72 L43 61 L18 57 L3 42 L8 15 L30 1 Z' },
    C: { width: 73, path: 'M68 4 L65 31 L47 25 L31 31 L26 66 L37 75 L62 65 L67 90 L41 101 L13 90 L2 70 L9 21 L33 0 Z' },
    H: { width: 75, path: 'M8 4 L34 0 L30 37 L48 34 L50 7 L74 1 L68 95 L43 100 L46 61 L28 64 L25 96 L2 100 Z' },
    L: { width: 65, path: 'M11 3 L38 0 L29 73 L64 67 L59 95 L3 100 Z' },
    D: { width: 76, path: 'M9 4 L43 0 L68 15 L74 43 L66 80 L43 96 L2 100 Z M32 26 L27 73 L42 68 L49 52 L49 35 L43 25 Z' },
    '’': { width: 25, path: 'M3 3 L25 0 L21 21 L9 35 L2 31 L10 17 L2 19 Z' },
  };
  for (const glyph of Object.values(glyphs)) glyph.outline = new Path2D(glyph.path);

  function polygon(points, fill, stroke, lineWidth = 1) {
    const path = new Path2D();
    points.forEach(([x, y], index) => index ? path.lineTo(x, y) : path.moveTo(x, y));
    path.closePath();
    ink.fillStyle = fill;
    ink.fill(path);
    if (stroke) {
      ink.strokeStyle = stroke; ink.lineWidth = lineWidth; ink.stroke(path);
    }
  }

  // Deterministic overspray: tiny dots never interfere with a counter or letter.
  let spraySeed = 719;
  function random() {
    spraySeed = (1664525 * spraySeed + 1013904223) >>> 0;
    return spraySeed / 4294967296;
  }
  for (let index = 0; index < 84; index++) {
    const side = index % 4;
    const x = side === 0 ? 28 + random() * 50 : side === 1 ? 929 + random() * 64 : 75 + random() * 850;
    const y = side < 2 ? 30 + random() * 201 : side === 2 ? 9 + random() * 21 : 244 + random() * 26;
    ink.fillStyle = index % 7 === 0 ? '#d0ff58' : index % 2 ? 'rgba(247,49,148,.68)' : 'rgba(43,204,242,.66)';
    ink.beginPath(); ink.arc(x, y, 0.6 + random() * 2.2, 0, Math.PI * 2); ink.fill();
  }

  // Freehand flicks and a broken underline sit behind the letters. No crest,
  // enclosing badge, symmetry, or continuous rectangular sign is introduced.
  polygon([[31, 91], [102, 65], [86, 79], [158, 56], [119, 89], [42, 109]], '#d82492', '#150d25', 5);
  polygon([[890, 169], [971, 143], [958, 163], [992, 155], [954, 192], [921, 193]], '#45d9ef', '#150d25', 5);
  polygon([[117, 246], [546, 240], [517, 247], [828, 235], [808, 224], [965, 244], [812, 270], [832, 254], [579, 260], [608, 253], [135, 260]], '#29cdeb', '#100c1e', 6);
  polygon([[175, 249], [452, 247], [416, 251], [169, 254]], '#bdff6a');

  function drawGlyph(glyph, placement, palette, index, layer) {
    const { x, y, scaleX, scaleY, angle, shear } = placement;
    ink.save();
    ink.translate(x, y); ink.rotate(angle); ink.transform(1, 0, shear, 1, 0, 0);
    ink.scale(scaleX, scaleY);
    ink.lineJoin = 'round'; ink.lineCap = 'round';
    const outline = glyph.outline;
    if (layer === 'extrusion') {
      // Short, stepped purple-black extrusion follows every hand-drawn glyph.
      for (let offset = 7; offset >= 2; offset -= 1) {
        ink.save(); ink.translate(offset * 0.9, offset);
        ink.lineWidth = 13; ink.strokeStyle = '#29b6d5'; ink.stroke(outline);
        ink.fillStyle = offset > 4 ? '#170d30' : '#5c205f';
        ink.fill(outline, 'evenodd');
        ink.lineWidth = 8; ink.strokeStyle = '#170d25'; ink.stroke(outline);
        ink.restore();
      }
      ink.restore(); return;
    }

    ink.lineWidth = 13; ink.strokeStyle = '#4be2f2'; ink.stroke(outline);
    ink.lineWidth = 8.5; ink.strokeStyle = '#100b1b'; ink.stroke(outline);
    const gradient = ink.createLinearGradient(12, 0, glyph.width - 7, 103);
    palette.forEach(([stop, color]) => gradient.addColorStop(stop, color));
    ink.fillStyle = gradient; ink.fill(outline, 'evenodd');

    ink.save(); ink.clip(outline, 'evenodd');
    // Large paint facets, jagged edge glints and a few dry cuts are clipped to
    // the exact silhouette; counters remain empty and readable at 512 px.
    polygon([[2, 10], [glyph.width - 1, -1], [glyph.width - 19, 18], [17, 28], [20, 16]], 'rgba(255,246,255,.65)');
    polygon([[8, 91], [glyph.width, 64], [glyph.width + 6, 94], [26, 110]], 'rgba(56,12,102,.32)');
    polygon([[10, 38], [18, 25], [13, 72], [7, 85]], 'rgba(250,255,255,.75)');
    if (index % 3 === 1) {
      polygon([[glyph.width - 20, 10], [glyph.width + 2, 3], [glyph.width - 8, 22], [glyph.width - 24, 25]], '#c9ff65');
    }
    ink.strokeStyle = 'rgba(255,255,255,.54)'; ink.lineWidth = 1.5;
    ink.beginPath(); ink.moveTo(23, 11); ink.lineTo(glyph.width - 13, 7); ink.stroke();
    ink.fillStyle = 'rgba(24,12,49,.38)';
    ink.fillRect(11 + index % 3 * 5, 84, 14, 1.4);
    ink.restore(); ink.restore();
  }

  function paintWordLine(text, x, y, targetWidth, height, palette, offset) {
    const characters = [...text];
    const advances = characters.map((letter) => letter === ' ' ? 26 : glyphs[letter].width - 1);
    const scaleX = targetWidth / advances.reduce((sum, value) => sum + value, 0);
    const angles = [-0.075, 0.045, -0.025, 0.065, -0.045, 0.018, -0.055, 0.035, -0.018, 0.045];
    const lifts = [1, -4, 2, -2, 4, 0, -3, 3, -2, 2];
    const placements = [];
    let cursor = x;
    characters.forEach((letter, index) => {
      if (letter !== ' ') {
        const variation = (index + offset) % angles.length;
        placements.push({ glyph: glyphs[letter], index, placement: {
          x: cursor, y: y + lifts[variation], angle: angles[variation],
          shear: -0.075 + (index % 3) * 0.018,
          scaleX: scaleX * (index % 4 === 0 ? 1.025 : 1),
          scaleY: height / 100 * (index % 3 === 0 ? 1.035 : 0.98),
        } });
      }
      cursor += advances[index] * scaleX;
    });
    // Draw all depth before all faces so overlapping outlines interlock without
    // letting a neighbouring letter's extrusion bury a coloured letter face.
    for (const layer of ['extrusion', 'face']) {
      placements.forEach(({ glyph, placement, index }) => drawGlyph(glyph, placement, palette, index + offset, layer));
    }
  }

  paintWordLine('PETER PAN’S', 64, 24, 885, 91,
    [[0, '#ffd1f3'], [0.27, '#ff4bad'], [0.68, '#ef238f'], [1, '#a128c9']], 0);
  paintWordLine('TECHLAND', 112, 132, 806, 91,
    [[0, '#cbffff'], [0.3, '#4ef3ed'], [0.66, '#21bbf3'], [1, '#476cda']], 3);

  // A handful of short paint runs remain outside glyph counters and do not
  // turn the readable letter edges into a noisy spray texture.
  for (const [x, y, length, color] of [[85, 116, 13, '#ed339c'], [356, 119, 9, '#f64baf'], [747, 119, 14, '#ea369f'], [271, 227, 12, '#49ddee'], [695, 225, 14, '#2fceef']]) {
    ink.strokeStyle = '#150b22'; ink.lineWidth = 6; ink.lineCap = 'round';
    ink.beginPath(); ink.moveTo(x, y); ink.lineTo(x - 1, y + length); ink.stroke();
    ink.strokeStyle = color; ink.lineWidth = 2.7; ink.stroke();
  }

  // The 55 mm metal tray sits just in front of the true upper wall. Four short
  // standoffs terminate inside actual ray-hit fascia faces, not empty bounds.
  const brandWidth = 3.1;
  const brandHeight = 0.80;
  const brandDepth = 0.055;
  const fasciaFrontZ = Math.max(shellCenterZ + 1.14, ...fasciaAnchors.map((point) => point.z));
  const brandPosition = new THREE.Vector3(center.x + 0.15, groundY + 2.96, fasciaFrontZ + 0.065 + brandDepth / 2);
  if (fasciaAnchors.length >= 2) {
    const brandCase = signCase('LOCAL_TECHLAND_BOLTED_SIGN', brandWidth, brandHeight, brandDepth, brandPosition);
    const brandMesh = makeGraphic('LOCAL_TECHLAND_GRAFFITI_LETTERING', brand.canvas, brandWidth - 0.055, brandHeight - 0.055,
      new THREE.Vector3(0, 0, brandDepth / 2 + 0.006), ['PETER PAN’S', 'TECHLAND'], brandCase);
    brandMesh.userData.letteringMethod = 'Original per-letter Path2D silhouettes; no font-rendered brand glyphs';
    for (const [index, anchor] of fasciaAnchors.entries()) {
      const end = new THREE.Vector3(anchor.x, anchor.y, brandPosition.z - brandDepth / 2 + 0.008);
      const embeddedStart = anchor.clone(); embeddedStart.z -= 0.014;
      rod(`LOCAL_BRAND_WALL_STANDOFF_${index}`, embeddedStart, end, 0.018);
      box(`LOCAL_BRAND_WALL_FOOT_${index}`, [0.12, 0.10, 0.025], [anchor.x, anchor.y, anchor.z + 0.003], edgeMetal);
      // Lower wall anchors join visible vertical rails; the rails overlap the
      // tray even when an anchor is just below the lettering's lower edge.
      box(`LOCAL_BRAND_REAR_RAIL_${index}`, [0.055, 0.58, 0.032], [anchor.x, groundY + 2.76, end.z], metal);
    }
    brandCase.userData.mounting = { method: 'Four ray-sampled fascia contacts and rear rails', contactsWorld: fasciaAnchors.map((point) => point.toArray()) };
  }

  const city = canvasWithLogicalSize(512, 768, maximumTextureSize);
  const panel = city.context;
  panel.fillStyle = '#36212f'; panel.fillRect(0, 0, 512, 768);
  panel.strokeStyle = '#f197a9'; panel.lineWidth = 5;
  panel.strokeRect(19, 19, 474, 730);
  panel.strokeStyle = '#8b506b'; panel.lineWidth = 2;
  panel.strokeRect(31, 31, 450, 706);
  panel.textAlign = 'center'; panel.textBaseline = 'middle';
  panel.font = '700 255px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';
  panel.fillStyle = '#fff7e8';
  panel.fillText('深', 256, 218);
  panel.fillText('圳', 256, 492);
  panel.font = '700 44px Arial, sans-serif'; panel.fillStyle = '#ffd5c9';
  panel.fillText('SHENZHEN', 256, 679, 398);

  // The source GLB contains the old orange, misspelled plaque on its left side:
  // x=-1.660..-1.586, y=1.44..2.30, z=.23...78 in the fitted shell before its
  // ground offset. This removable metal sleeve encloses that actual plaque.
  // Its two independent prints face opposite ways; neither uses DoubleSide or
  // mirrored lettering. The inherited original plaque/mount remains unchanged.
  const cityPosition = new THREE.Vector3(center.x - 1.625, groundY + 1.88, shellCenterZ + 0.505);
  const cityWidth = 0.64, cityHeight = 1.00, cityDepth = 0.16;
  const cityCase = signCase('LOCAL_SHENZHEN_METAL_SIGN', cityWidth, cityHeight, cityDepth, cityPosition, -Math.PI / 2);
  for (const side of [1, -1]) {
    const cityFace = makeGraphic(`LOCAL_VERTICAL_SHENZHEN_SIGN_${side === 1 ? 'OUTER' : 'INNER'}`, city.canvas,
      cityWidth - 0.055, cityHeight - 0.055, new THREE.Vector3(0, 0, side * (cityDepth / 2 + 0.006)), ['深圳', 'SHENZHEN'], cityCase);
    cityFace.rotation.y = side === 1 ? 0 : Math.PI;
    cityFace.userData.face = side === 1 ? 'Outer left-facing print' : 'Independent right-facing print; not mirrored';
  }

  // Four clamping bolts engage the inspected original plaque substrate. Two
  // short lateral tabs visibly connect the sleeve to the surviving upper and
  // lower original mounting area instead of suspending a new front-facing card.
  for (const y of [groundY + 1.49, groundY + 2.27]) {
    for (const z of [shellCenterZ + 0.27, shellCenterZ + 0.74]) {
      rod('LOCAL_CITY_SUBSTRATE_CLAMP', new THREE.Vector3(center.x - 1.716, y, z), new THREE.Vector3(center.x - 1.604, y, z), 0.011, boltMetal);
    }
    box('LOCAL_CITY_BACK_MOUNT_TAB', [0.12, 0.065, 0.14], [center.x - 1.584, y, shellCenterZ + 0.505], edgeMetal);
  }
  cityCase.userData.mounting = {
    method: 'Metal sleeve around inspected original garage plaque; four substrate clamps and two rear tabs',
    sourcePlaqueBoundsRelativeToGround: { min: [-1.660, 1.44, 0.23], max: [-1.586, 2.30, 0.78] },
    originalTextureModified: false,
  };

  // The independently generated portrait ring has a real narrow bottom stem.
  // Measure its lower vertices in world space instead of placing a support at
  // the ring's empty centre or inventing a replacement frame/avatar.
  const portrait = entries.get('03_profile_sign');
  if (portrait?.state === 'ready' && portrait.bounds && portrait.model) {
    portrait.mount.updateWorldMatrix(true, true);
    const stem = new THREE.Vector3();
    const sample = new THREE.Vector3();
    const lowerBandTop = portrait.bounds.min.y + Math.min(0.055, portrait.bounds.getSize(new THREE.Vector3()).y * 0.07);
    let stemSamples = 0;
    portrait.model.traverse((object) => {
      const positions = object.isMesh && object.geometry?.getAttribute('position');
      if (!positions) return;
      for (let index = 0; index < positions.count; index++) {
        sample.fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld);
        if (sample.y <= lowerBandTop) { stem.add(sample); stemSamples++; }
      }
    });
    if (stemSamples) {
      stem.divideScalar(stemSamples);
      const contactPoints = [];
      // The original frame stem's straight rear line meets a gap in the
      // garage mesh. The adjacent right-hand jamb is solid at both heights.
      const supportX = stem.x + 0.15;
      for (const y of [portrait.bounds.min.y - 0.20, portrait.bounds.min.y - 0.03]) {
        mountingRay.set(new THREE.Vector3(supportX, y, shellCenterZ + 3), new THREE.Vector3(0, 0, -1));
        const contact = mountingRay.intersectObject(shell.model || shell.mount, true)
          .find((hit) => hit.point.z > shellCenterZ + 0.8 && hit.point.z < stem.z);
        if (contact) contactPoints.push(contact.point.clone());
      }
      if (contactPoints.length === 2) {
        const support = new THREE.Group(); support.name = 'LOCAL_PORTRAIT_FRAME_FIXED_BRACKET';
        support.userData = { ...hardwareAttribution, assetId: '03_profile_sign', connectsAssets: ['03_profile_sign', '01_garage_shell'] };
        group.add(support);
        const stemSeat = stem.clone(); stemSeat.y = portrait.bounds.min.y + 0.018;
        box('LOCAL_PORTRAIT_ORIGINAL_STEM_CLAMP', [0.067, 0.052, 0.078], [stem.x, stem.y, stem.z], edgeMetal, support);
        const elbow = new THREE.Vector3(stem.x, contactPoints[1].y, stem.z);
        rod('LOCAL_PORTRAIT_STEM_UPRIGHT', elbow, stem, 0.018, metal, support);
        for (const [index, point] of contactPoints.entries()) {
          const inserted = point.clone(); inserted.z -= 0.014;
          rod(`LOCAL_PORTRAIT_JAMB_BRACE_${index}`, inserted, index === 0 ? stemSeat : elbow, 0.017, metal, support);
          box(`LOCAL_PORTRAIT_JAMB_FOOT_${index}`, [0.095, 0.075, 0.03], [point.x, point.y, point.z + 0.003], edgeMetal, support);
          for (const offset of [-0.026, 0.026]) {
            rod(`LOCAL_PORTRAIT_JAMB_BOLT_${index}_${offset}`,
              new THREE.Vector3(point.x + offset, point.y, point.z + 0.014),
              new THREE.Vector3(point.x + offset, point.y, point.z + 0.025), 0.007, boltMetal, support);
          }
        }
        support.traverse((object) => {
          object.userData = { ...object.userData, ...hardwareAttribution, assetId: '03_profile_sign' };
          if (object.geometry) object.geometry.userData = { ...hardwareAttribution, assetId: '03_profile_sign' };
        });
        group.userData.portraitFrameMount = {
          method: 'Measured original stem clamp and two ray-sampled jamb braces',
          stemContactWorld: stem.toArray(), jambContactsWorld: contactPoints.map((point) => point.toArray()),
          portraitGeometryModified: false, avatarAdded: false,
        };
      } else {
        group.userData.portraitFrameMount = { status: 'No bracket added: both physical jamb contacts could not be verified' };
      }
    }
  }

  // Preserve world placement while parenting to the placed shell. A later shell
  // grounding translation now moves every graphic and every fastener with it.
  shell.mount.attach(group);
  group.userData.status = fasciaAnchors.length >= 2 ? 'Two locally authored metal signs physically mounted to inspected garage geometry' : 'City sleeve mounted; main sign omitted because fascia contacts were unavailable';
  group.userData.maximumTextureSize = maximumTextureSize;
  group.userData.brandPlacement = { position: brandPosition.toArray(), width: brandWidth, height: brandHeight, lowerEdge: brandPosition.y - brandHeight / 2 };
  group.userData.brandMountContacts = fasciaAnchors.map((point) => point.toArray());
  group.userData.cityPlacement = { position: cityPosition.toArray(), width: cityWidth, height: cityHeight, depth: cityDepth, faces: 2 };
  group.userData.generatedAssetCount = 0;
  return group;
}
