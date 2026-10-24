/**
 * Locally authored graphic overlays for the existing, real Tripo garage.
 * These flat signs are post-production typography, never generated 3D assets.
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
  group.userData = { ...attribution };
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
  const frontZ = bounds.max.z;

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

  function makeGraphic(name, canvas, width, height, position, content) {
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
    group.add(mesh);
    return mesh;
  }

  // Work in a fixed logical coordinate system so mobile retains the same
  // lettering and composition at half the bitmap resolution.
  const brand = canvasWithLogicalSize(1024, 256, maximumTextureSize);
  const ink = brand.context;

  function brushLine(text, { x, baseline, width, fontSize, angle, color, highlight }) {
    ink.save();
    ink.translate(x, baseline);
    ink.rotate(angle);
    ink.transform(1, 0, -0.12, 1, 0, 0);
    ink.font = `italic 900 ${fontSize}px "Arial Black", Impact, sans-serif`;
    ink.textAlign = 'left';
    ink.textBaseline = 'alphabetic';
    const measured = ink.measureText(text).width || width;
    ink.scale(width / measured, 1);

    // A narrow, irregular ink outline makes the paint readable against the
    // original textured metal. It is not an opaque rectangular billboard.
    ink.lineJoin = 'round';
    ink.lineWidth = 9;
    ink.strokeStyle = 'rgba(16, 8, 27, .90)';
    ink.shadowColor = color;
    ink.shadowBlur = 9;
    ink.shadowOffsetX = 0;
    ink.shadowOffsetY = 0;
    ink.strokeText(text, 0, 0);
    ink.shadowBlur = 0;
    const gradient = ink.createLinearGradient(0, -fontSize, width, 8);
    gradient.addColorStop(0, highlight);
    gradient.addColorStop(0.45, color);
    gradient.addColorStop(1, highlight);
    ink.fillStyle = gradient;
    ink.fillText(text, 0, 0);

    // Short tapered marks sit at the paint's edge. The letter interiors are
    // kept intact so the exact brand remains legible at the mobile size.
    ink.fillStyle = color;
    const marks = [0.035, 0.117, 0.284, 0.486, 0.673, 0.833, 0.946];
    for (let index = 0; index < marks.length; index++) {
      const markX = measured * marks[index];
      const length = 5 + index % 3 * 3;
      ink.beginPath();
      ink.moveTo(markX, -3);
      ink.lineTo(markX - 3, length);
      ink.lineTo(markX + 5, 1);
      ink.closePath();
      ink.fill();
    }
    ink.restore();
  }

  // A few broad, dry brush accents echo the source concept's painted strokes;
  // they stay local to the lettering rather than adding a large panel.
  ink.fillStyle = 'rgba(242, 40, 139, .72)';
  ink.beginPath();
  ink.moveTo(46, 108); ink.lineTo(194, 76); ink.lineTo(171, 88);
  ink.lineTo(244, 77); ink.lineTo(179, 100); ink.lineTo(40, 124);
  ink.closePath(); ink.fill();
  ink.fillStyle = 'rgba(53, 207, 246, .74)';
  ink.beginPath();
  ink.moveTo(141, 179); ink.lineTo(380, 139); ink.lineTo(334, 152);
  ink.lineTo(435, 144); ink.lineTo(344, 164); ink.lineTo(128, 194);
  ink.closePath(); ink.fill();

  brushLine('Peter Pan’s', {
    x: 62, baseline: 124, width: 876, fontSize: 112, angle: -0.036,
    color: '#f13b96', highlight: '#ff6cb5',
  });
  brushLine('TECHLAND', {
    x: 193, baseline: 240, width: 758, fontSize: 124, angle: -0.050,
    color: '#38d3f3', highlight: '#80c6ff',
  });

  // Bottom of the graphic is Y=2.61 m: it clears the 2.5 m opening. The upper
  // paint edge sits only 11 cm above the 3.2 m shell, below the portrait ring.
  const brandWidth = 2.9;
  const brandHeight = 0.70;
  const brandPosition = new THREE.Vector3(center.x + 0.15, groundY + 2.96, frontZ + 0.19);
  makeGraphic('LOCAL_TECHLAND_GRAFFITI_LETTERING', brand.canvas, brandWidth, brandHeight,
    brandPosition, ['Peter Pan’s', 'TECHLAND']);

  const city = canvasWithLogicalSize(256, 768, mobile ? 128 : 256);
  const panel = city.context;
  const corners = [[30, 10], [238, 10], [248, 27], [248, 738], [226, 758], [16, 758], [8, 740], [8, 31]];
  panel.beginPath();
  corners.forEach(([x, y], index) => index ? panel.lineTo(x, y) : panel.moveTo(x, y));
  panel.closePath();
  panel.fillStyle = '#391227'; panel.fill();
  panel.strokeStyle = '#ff397f'; panel.lineWidth = 7;
  panel.shadowColor = '#ec316d'; panel.shadowBlur = 9; panel.stroke(); panel.shadowBlur = 0;
  panel.strokeStyle = 'rgba(255, 198, 220, .8)'; panel.lineWidth = 2;
  panel.strokeRect(25, 31, 206, 701);
  panel.textAlign = 'center'; panel.textBaseline = 'middle';
  panel.font = '700 171px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';
  panel.fillStyle = '#fff0ed';
  panel.fillText('深', 128, 233);
  panel.fillText('圳', 128, 450);
  panel.font = '700 29px Arial, sans-serif'; panel.fillStyle = '#ffd2df';
  panel.fillText('SHENZHEN', 128, 671, 186);
  const cityPosition = new THREE.Vector3(bounds.min.x + 0.06, groundY + 2.12, frontZ + 0.18);
  makeGraphic('LOCAL_VERTICAL_SHENZHEN_SIGN', city.canvas, 0.32, 0.96,
    cityPosition, ['深圳', 'SHENZHEN']);

  group.userData.status = 'Two locally authored graphic overlays attached to the real garage shell';
  group.userData.maximumTextureSize = maximumTextureSize;
  group.userData.brandPlacement = { position: brandPosition.toArray(), width: brandWidth, height: brandHeight, lowerEdge: brandPosition.y - brandHeight / 2 };
  group.userData.generatedAssetCount = 0;
  return group;
}
