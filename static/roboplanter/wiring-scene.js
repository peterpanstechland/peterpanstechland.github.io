import * as THREE from './vendor/three.module.min.js';
import { routes } from './wiring-data.js';

// Lightweight, deliberately schematic geometry. Not manufacturing CAD or a
// live electrical simulation. Connector locations are simplified for teaching.
const colors = { pcb: 0x21372b, cream: 0xeee9d9, metal: 0xadb9aa, dark: 0x101e16, green: 0xc4eb72, red: 0xdf8d6d, yellow: 0xf0df9f, ground: 0x9aa79b, water: 0x79bac5 };
const placements = {
  water: [.04, -.28], climate: [-2.24, .72], light: [-2.24, 1.48], printer: [.04, -1.45],
  soil: [-2.24, -1.45], pump: [-2.24, -.28], air: [.04, .72],
  'indicator-adc': [.15, .65], 'indicator-i2c': [.15, -.65],
};

export function createWiringScene(host, overlay, callbacks) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 70);
  const world = new THREE.Group(); scene.add(world);
  const boardRoot = new THREE.Group(), deviceRoot = new THREE.Group(), cableRoot = new THREE.Group();
  world.add(boardRoot, deviceRoot, cableRoot);
  scene.add(new THREE.HemisphereLight(0xfffef0, 0x9caa85, 2.5));
  const key = new THREE.DirectionalLight(0xfff6de, 3.2); key.position.set(-3, 8, 5); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, {left:-5,right:5,top:5,bottom:-5}); key.shadow.normalBias = .035; key.shadow.bias = -.0003; key.shadow.radius = 4; scene.add(key);
  const rim = new THREE.DirectionalLight(0xe1efd5, 1.4); rim.position.set(4, 4, -4); scene.add(rim);
  const resourceGeometries = new Set(), resourceMaterials = new Set(), textures = new Set();
  const mat = (color, extras = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: .65, metalness: .05, ...extras }); resourceMaterials.add(m); return m; };
  const mats = Object.fromEntries(Object.entries(colors).map(([name, color]) => [name, mat(color)]));
  const glass = mat(0xb7d8cd, { transparent: true, opacity: .24, side: THREE.DoubleSide, depthWrite: false });
  const waterMat = mat(colors.water, { transparent: true, opacity: .67, roughness: .25 });
  const add = (geometry, material, parent, x = 0, y = 0, z = 0) => {
    resourceGeometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const box = (w, h, d, material, parent, x = 0, y = 0, z = 0) => add(new THREE.BoxGeometry(w, h, d), material, parent, x, y, z);
  const cylinder = (r, h, material, parent, x, y, z, rb = r) => add(new THREE.CylinderGeometry(r, rb, h, 24), material, parent, x, y, z);
  function rounded(w, h, d, material, parent, x = 0, y = 0, z = 0, radius = .10) {
    const r = Math.min(radius, w / 3, d / 3), b = Math.min(.018, h / 5);
    const shape = new THREE.Shape();
    shape.moveTo(-w/2+r,-d/2); shape.lineTo(w/2-r,-d/2); shape.quadraticCurveTo(w/2,-d/2,w/2,-d/2+r);
    shape.lineTo(w/2,d/2-r); shape.quadraticCurveTo(w/2,d/2,w/2-r,d/2); shape.lineTo(-w/2+r,d/2); shape.quadraticCurveTo(-w/2,d/2,-w/2,d/2-r); shape.lineTo(-w/2,-d/2+r); shape.quadraticCurveTo(-w/2,-d/2,-w/2+r,-d/2);
    const geometry = new THREE.ExtrudeGeometry(shape,{depth:h-2*b,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:3,steps:1,curveSegments:5});
    geometry.rotateX(-Math.PI/2); geometry.translate(0,-h/2+b,0);
    return add(geometry, material, parent, x, y, z);
  }
  function face(parent, x, y, z, scale = 1) {
    const group = new THREE.Group(); group.position.set(x,y,z); group.scale.setScalar(scale); parent.add(group);
    for (const px of [-.16,.16]) { const eye=add(new THREE.SphereGeometry(.045,12,8),mats.dark,group,px,0,0); eye.scale.z=.32; }
    const smile=new THREE.CatmullRomCurve3([new THREE.Vector3(-.07,-.09,0),new THREE.Vector3(0,-.12,.004),new THREE.Vector3(.07,-.09,0)]);
    add(new THREE.TubeGeometry(smile,12,.016,6,false),mats.dark,group);
    for (const px of [-.27,.27]) {const cheek=add(new THREE.SphereGeometry(.04,12,8),mat(0xd89d87),group,px,-.055,0); cheek.scale.set(1.35,.5,.25);}
  }
  function label(text, w, d, parent, x, y, z, ink = '#cbd5bc', bg = null) {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, 768, 128); }
    ctx.fillStyle = ink; ctx.font = '600 45px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 384, 64);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }); resourceMaterials.add(material);
    const plane = add(new THREE.PlaneGeometry(w, d), material, parent, x, y, z); plane.rotation.x = -Math.PI / 2; return plane;
  }
  const floor = add(new THREE.CircleGeometry(5.2, 64), mat(0xe5e9d5, { roughness: 1 }), scene, 0, -.16, 0); floor.rotation.x = -Math.PI / 2; floor.castShadow = false;
  const grid = new THREE.GridHelper(12, 36, 0xaab895, 0xaab895); grid.position.y = -.15; grid.material.transparent = true; grid.material.opacity = .20; scene.add(grid);
  let board = 'xiao', route, step = 0, active = false, lost = false, reduced = false, disposed = false;
  let frame = 0, last = 0, elapsed = 0, needsRender = true, explosion = 0, explosionTarget = 0;
  let yaw = .12, pitch = .72, distance = 9.7, targetYaw = .12, targetPitch = .72;
  let drag = null, selectedShell, boardLayers = [], dynamicParts = [], cables = [], hotspots = [], hits = [];
  let practice = false, plugged = true, plugPoint = null, burstAt = -10, sparks = [];
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(), target = new THREE.Vector3(.2, .15, .2);

  function clearGroup(group) {
    group.traverse(object => {
      if (object.geometry) { object.geometry.dispose(); resourceGeometries.delete(object.geometry); }
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material && !Object.values(mats).includes(material) && material !== glass && material !== waterMat) {
          if (material.map) { material.map.dispose(); textures.delete(material.map); }
          material.dispose(); resourceMaterials.delete(material);
        }
      }
    });
    group.clear();
  }
  function connector(parent, x, z, id, reserved = false) {
    const group = new THREE.Group(); group.position.set(x, .13, z); parent.add(group);
    const shell = rounded(.46, .22, .38, mat(colors.cream, {roughness:.42}), group, 0, .08, 0, .025);
    box(.32, .08, .23, mats.dark, group, 0, .185, -.01);
    for (let i = 0; i < 4; i++) box(.025, .027, .15, mats.metal, group, -.105 + i * .07, .2, -.01);
    box(.12,.055,.09,mats.cream,group,0,.22,.16);
    for (const side of [-1,1]) box(.045,.09,.24,mats.cream,group,side*.23,.15,0);
    if (!reserved) { shell.userData.route = id; hits.push(shell); }
    return shell;
  }
  function buildBoard() {
    clearGroup(boardRoot); overlay.replaceChildren(); hotspots = []; hits = []; boardLayers = [];
    if (board === 'xiao') {
      rounded(2.8, .085, 3.7, mats.pcb, boardRoot, -1.1, 0, 0, .16);
      // Decorative PCB traces/silkscreen support recognition, not circuit tracing.
      const pcbCanvas=document.createElement('canvas'); pcbCanvas.width=1000; pcbCanvas.height=1320;
      const pc=pcbCanvas.getContext('2d'); pc.fillStyle='#23372c';pc.fillRect(0,0,1000,1320);
      for(let i=0;i<76;i++){
        const startX=90+(i*97)%820,startY=80+(i*131)%1160;
        pc.strokeStyle=i%4===0?'#8b9a5d':'#3d5840';pc.lineWidth=i%4===0?3:2;pc.beginPath();pc.moveTo(startX,startY);pc.lineTo(startX+35,startY);pc.lineTo(startX+75,startY+40);pc.lineTo(startX+75,startY+80+(i%5)*18);pc.stroke();
        pc.fillStyle='#bcb57a';pc.beginPath();pc.arc(startX,startY,3,0,Math.PI*2);pc.fill();
      }
      pc.strokeStyle='#adbaa0';pc.lineWidth=2;pc.strokeRect(315,130,370,440);
      pc.font='20px monospace';pc.fillStyle='#d3dbc4';pc.textAlign='center';
      for(const [text,px,py] of [['SERVO3',100,108],['SERVO4',900,108],['SERVO1',100,595],['SERVO2',900,595],['IIC1',100,950],['IIC2',900,950],['RGB',100,1190],['UART',900,1190],['3V3 / GND',500,1160],['SEEED / V1.0',500,1230]])pc.fillText(text,px,py);
      const pcbTexture=new THREE.CanvasTexture(pcbCanvas);pcbTexture.colorSpace=THREE.SRGBColorSpace;textures.add(pcbTexture);
      const pcbTop=mat(0xffffff,{map:pcbTexture,roughness:.78});const top=add(new THREE.PlaneGeometry(2.70,3.60),pcbTop,boardRoot,-1.1,.047,0);top.rotation.x=-Math.PI/2;top.castShadow=false;
      for (const x of [-2.32, .12]) for (const z of [-1.65, 1.65]) {
        cylinder(.10, .012, mats.metal, boardRoot, x, .05, z); cylinder(.06, .015, mats.dark, boardRoot, x, .06, z);
      }
      const core = new THREE.Group(); core.position.set(-1.1, .10, -.84); boardRoot.add(core); boardLayers.push({ object: core, base: .10, lift: .65 });
      rounded(.87, .09, 1.13, mats.pcb, core,0,0,0,.04); rounded(.64, .14, .74, mat(0xb5beb8,{metalness:.65,roughness:.35}), core, 0, .09, .08,.04);
      box(.33, .18, .29, mats.metal, core, 0, .10, -.60); box(.23, .08, .15, mats.dark, core, 0, .19, -.62);
      for (const x of [-.44, .44]) for (let i = 0; i < 8; i++) box(.07, .045, .055, mats.yellow, core, x, .055, -.49 + i * .13);
      label('XIAO ESP32-S3 PLUS', .77, .15, core, 0, .17, .14, '#22342b');
      label('XIAO ROBOT BOARD', 1.6, .23, boardRoot, -1.1, .06, .35);
      label('V1.0 / TEACHING MODEL', 1.4, .17, boardRoot, -1.1, .06, .58);
      for (const [x, z] of [[-1.60, .02], [-.60, .02], [-1.6, 1.15]]) {
        cylinder(.18, .24, mats.dark, boardRoot, x, .17, z); cylinder(.17, .025, mats.metal, boardRoot, x, .30, z);box(.24,.005,.015,mats.dark,boardRoot,x,.316,z);box(.015,.005,.24,mats.dark,boardRoot,x,.316,z);
      }
      for (let i = 0; i < 18; i++) box(.10, .06, .15, i % 3 ? mats.dark : mats.metal, boardRoot, -1.88 + (i % 5) * .34, .08, -.02 + Math.floor(i / 5) * .32);
      connector(boardRoot, .04, 1.48, '', true);
      label('UART RX / GPIO44', .92, .16, boardRoot, .08, .035, 1.82);
      for (const item of routes.filter(item => item.board === board)) {
        const [x, z] = placements[item.id]; connector(boardRoot, x, z, item.id);
      }
    } else {
      rounded(2.7, .36, 2.9, mats.cream, boardRoot, -1.18, .07, 0,.18);
      rounded(2.37, .07, 2.35, mats.dark, boardRoot, -1.18, .30, -.15,.12);
      const screen = new THREE.Group(); screen.position.set(-1.18, .35, -.15); boardRoot.add(screen); boardLayers.push({ object: screen, base: .35, lift: .75 });
      rounded(2.16, .04, 2.15, mat(0x364833,{roughness:.25}), screen,0,0,0,.08);
      for (const x of [-.39, .39]) { box(.18, .02, .25, mats.green, screen, x, .033, -.18); box(.27, .02, .09, mats.green, screen, x, .033, -.2); }
      box(.63, .02, .08, mats.green, screen, 0, .033, .37);
      box(.1, .02, .16, mats.green, screen, -.35, .033, .29); box(.1, .02, .16, mats.green, screen, .35, .033, .29);
      label('HELLO, LITTLE GREEN.', 1.85, .24, screen, 0, .04, -.79);
      label('SENSECAP INDICATOR', 1.95, .18, boardRoot, -1.18, .27, 1.24, '#2c4233');
      label('RP2040 / GROVE', 1.52, .19, boardRoot, -1.18, .32, 1.04, '#2c4233');
      for (const item of routes.filter(item => item.board === board)) { const [x, z] = placements[item.id]; connector(boardRoot, x, z, item.id); }
    }
    for (const item of routes.filter(item => item.board === board)) {
      const [x, z] = placements[item.id];
      const button = document.createElement('button'); button.type = 'button'; button.className = 'wiring-hotspot'; button.textContent = item.port;
      button.dataset.wiringRoute = item.id; button.setAttribute('aria-label', `${item.port}：${item.title}`);
      button.addEventListener('click', () => callbacks.onSelect(item.id)); overlay.append(button);
      // Position the label outside the physical connector so it stays readable.
      hotspots.push({ id: item.id, button, position: new THREE.Vector3(x + (x < -1 ? -.25 : .22), .28, z + .08) });
    }
  }
  function pcb(parent, x = 0, y = 0, z = 0, w = .85, d = 1.05) {
    box(w, .065, d, mat(0x55865a), parent, x, y, z);
    box(.25, .10, .27, mats.dark, parent, x, y + .08, z);
    for (let i = 0; i < 4; i++) box(.055, .025, .12, mats.yellow, parent, x - w / 2 + .12 + i * .14, y + .05, z + d / 2 - .12);
  }
  function buildDevice(kind) {
    clearGroup(deviceRoot); dynamicParts = []; deviceRoot.position.set(2.10, 0, 0);
    rounded(2.20,.08,2.0,mat(0xf1edde),deviceRoot,.03,-.045,.14,.20);
    if (kind === 'water') {
      rounded(1.45, .10, 1.45, mats.cream, deviceRoot, 0, -.03, 0,.12);
      rounded(1.3, .70, 1.3, waterMat, deviceRoot, 0, .37, 0,.10);
      const tank=rounded(1.45, 1.45, 1.45, glass, deviceRoot, 0, .72, 0,.10);tank.castShadow=false;
      pcb(deviceRoot, 0, 1.75, 0, 1.1, .58);
      for (const x of [-.29, .29]) {
        cylinder(.22, .18, mats.metal, deviceRoot, x, 1.62, 0);
        cylinder(.17, .018, mats.dark, deviceRoot, x, 1.52, 0);
      }
      for(let i=0;i<6;i++)box(.11,.016,.012,mats.cream,deviceRoot,.53,.24+i*.19,.74);
      face(deviceRoot,0,.51,.736,.86);
      label('RANGER v2 / DISTANCE ONLY', 1.9, .22, deviceRoot, 0, .04, 1.03,'#536344');
    } else if (kind === 'light') {
      box(1.75, .05, .52, mats.cream, deviceRoot, .12, .06, 0);
      for (let i = 0; i < 10; i++) {
        box(.13, .045, .16, mats.dark, deviceRoot, -.69 + i * .18, .10, 0);
        const bead = box(.085, .02, .10, mat(colors.green, { emissive: colors.green, emissiveIntensity: .5 }), deviceRoot, -.69 + i * .18, .13, 0); dynamicParts.push({ type: 'led', object: bead, index: i });
      }
      label('WS2813 / 10 LEDs / DIN →', 1.85, .25, deviceRoot, .12, .03, .61, '#536344');
    } else if (kind === 'printer') {
      rounded(1.35, .88, 1.15, mats.cream, deviceRoot, 0, .42, 0,.14);
      box(1.12, .08, .14, mats.dark, deviceRoot, 0, .87, .32);
      const paper = box(.77, .015, .9, mat(0xf8f5e8), deviceRoot, 0, .89, .9); dynamicParts.push({ type: 'paper', object: paper });
      label('GOOD PLANTS. GOOD DAY.', .72, .15, deviceRoot, 0, .91, .81, '#3d4f3b');
      face(deviceRoot,0,.46,.586,.8);
    } else if (kind === 'soil') {
      cylinder(.71, .76, mats.cream, deviceRoot, .14, .31, 0, .55);
      cylinder(.66, .045, mat(0x514b35), deviceRoot, .14, .71, 0);
      for(let i=0;i<16;i++){const a=i*2.4;const stone=add(new THREE.SphereGeometry(.035,8,6),mat(0x8e805a),deviceRoot,.14+Math.sin(a)*(.2+(i%4)*.1),.75,Math.cos(a)*(.2+(i%4)*.1));stone.scale.y=.5;}
      box(.22, 1.1, .065, mat(0x628457), deviceRoot, -.10, .92, .07);
      cylinder(.035, .76, mat(0x7fa255), deviceRoot, .34, 1.02, 0);
      const leaf = add(new THREE.SphereGeometry(1, 16, 10), mat(0xa1c567), deviceRoot, .51, 1.39, 0); leaf.scale.set(.32, .10, .18); leaf.rotation.z = .4;
      const leaf2=add(new THREE.SphereGeometry(1,20,12),mat(0x83b25b),deviceRoot,.16,1.48,-.05);leaf2.scale.set(.30,.09,.17);leaf2.rotation.z=-.35;
      face(deviceRoot,.14,.36,.65,.88);
    } else if (kind === 'pump') {
      pcb(deviceRoot, 0, .08, 0, 1.05, 1.18);
      rounded(.72, .45, .63, mat(0x4279a5), deviceRoot, 0, .34, -.18, .035);
      box(.65, .24, .3, mat(0x468069), deviceRoot, 0, .23, .40);
      for (const x of [-.17, .17]) { cylinder(.09, .02, mats.metal, deviceRoot, x, .36, .40); box(.13, .005, .018, mats.dark, deviceRoot, x, .375, .40); }
      label('RELAY v1.2 / LOAD EMPTY', 1.9, .23, deviceRoot, 0, .03, .96, '#536344');
    } else if (kind === 'climate') {
      rounded(1.25, .68, 1.05, mats.metal, deviceRoot, 0, .39, 0, .06);
      for (let i = 0; i < 7; i++) box(.84, .015, .045, mats.dark, deviceRoot, 0, .74, -.31 + i * .1);
      label('SEN54 / EXTERNAL 5V', 1.9, .22, deviceRoot, 0, .03, .96, '#536344');
    } else if (kind === 'reserved') {
      label('RESERVED / LEAVE EMPTY', 1.9, .26, deviceRoot, 0, .03, 0, '#536344');
    } else {
      pcb(deviceRoot, 0, .07, 0);
      if (kind === 'climate') box(.31, .14, .38, mats.metal, deviceRoot, 0, .22, 0);
      if (kind === 'air') { cylinder(.28, .25, mat(0x917a54), deviceRoot, 0, .26, -.06); cylinder(.22, .015, mats.metal, deviceRoot, 0, .40, -.06); }
      if (kind === 'uv') cylinder(.16, .09, mat(0xa99cc6), deviceRoot, 0, .20, -.05);
      if (kind === 'lux') { box(.22, .03, .22, mats.cream, deviceRoot, 0, .16, -.06); cylinder(.06, .02, mats.dark, deviceRoot, 0, .19, -.06); }
      label('LIGHT SENSOR v1.2', 1.65, .22, deviceRoot, 0, .03, .89, '#536344');
    }
    if (['printer', 'climate'].includes(kind)) {
      rounded(.85, .23, .48, mats.dark, deviceRoot, .05, .07, 1.72,.09);
      label(kind === 'printer' ? 'EXTERNAL 12V' : 'EXTERNAL 5V', .8, .16, deviceRoot, .05, .20, 1.72);
    }
  }
  function path(points, color, power = false, water = false) {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    const material = mat(color, { emissive: color, emissiveIntensity: .08, transparent: true, opacity: 1 });
    const tube = add(new THREE.TubeGeometry(curve, 44, water ? .04 : .022, 7, false), material, cableRoot);
    const particle = add(new THREE.SphereGeometry(.041, 10, 8), mat(0xf3f6dd, { emissive: color, emissiveIntensity: 1 }), cableRoot);
    cables.push({ curve, tube, particle, power });
  }
  function buildCables() {
    clearGroup(cableRoot); cables = [];
    if (!route) return;
    const [x, z] = placements[route.id];
    const destinationX = 1.75;
    const endY = route.kind === 'water' ? 1.8 : route.kind === 'soil' ? 1.45 : ['printer', 'climate'].includes(route.kind) ? .27 : .14;
    const available = route.pins.filter(pin => !['unused', 'external'].includes(pin[0]));
    available.forEach(([kind, , , source], i) => {
      const offset = (i - (available.length - 1) / 2) * .065;
      const color = kind === 'power' ? colors.red : kind === 'ground' ? colors.ground : kind === 'signal2' ? colors.yellow : colors.green;
      const origin = source === 'UART' ? [.04, 1.48] : source === '3V3' ? [-1.1, 1.15] : [x, z];
      const start=practice&&!plugged&&plugPoint&&!source?[plugPoint.x+offset,plugPoint.y,plugPoint.z]:[origin[0]+offset,.36,origin[1]];
      path([start, [start[0]+.35, Math.max(start[1],.65)+explosion*.45, start[2]+.08+offset], [.78, .65 + explosion * .25, z * .45 + offset], [destinationX, endY + explosion * .14, .22 + offset]], color, kind === 'power' || kind === 'ground');
    });
    if (['printer', 'climate'].includes(route.kind)) {
      for (const [offset, color] of [[-.05, colors.red], [.05, colors.ground]]) {
        path([[2.16 + offset, .24, 1.65], [2.90 + offset, .30, 1.13], [2.72 + offset, .25, .50], [2.37, .21, .31 + offset]], color, true);
      }
    }
    needsRender = true;
  }
  function select(next) {
    route = next;
    buildDevice(next.kind);
    for (const shell of hits) {
      const on = shell.userData.route === route.id;
      shell.material.color.setHex(on ? colors.green : colors.cream); shell.material.emissive.setHex(on ? 0x30451e : 0x000000);
      if (on) selectedShell = shell;
    }
    hotspots.forEach(item => item.button.setAttribute('aria-pressed', String(item.id === route.id)));
    resetPlug();
    buildCables(); requestRender();
  }
  function resize() {
    if (disposed) return;
    renderer.setSize(host.clientWidth, host.clientHeight);
    camera.aspect = host.clientWidth / Math.max(1, host.clientHeight); camera.updateProjectionMatrix(); requestRender();
  }
  function updateCamera() {
    yaw += (targetYaw - yaw) * (reduced ? 1 : .16); pitch += (targetPitch - pitch) * (reduced ? 1 : .16);
    const fit = camera.aspect < 1.12 ? 1.45 : 1;
    camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * distance * fit, Math.sin(pitch) * distance * fit, target.z + Math.cos(yaw) * Math.cos(pitch) * distance * fit);
    camera.lookAt(target);
  }
  function positionHotspots() {
    world.updateMatrixWorld(true);
    for (const item of hotspots) {
      const p = item.position.clone(); world.localToWorld(p); p.project(camera);
      const x = (p.x * .5 + .5) * host.clientWidth, y = (-p.y * .5 + .5) * host.clientHeight;
      item.button.hidden = p.z > 1 || Math.abs(p.x) > .94 || Math.abs(p.y) > .87;
      item.button.style.left = `${x}px`; item.button.style.top = `${y}px`;
    }
    if(practice&&!plugged&&plugPoint&&callbacks.plugElement){
      const p=plugPoint.clone();world.localToWorld(p);p.project(camera);
      callbacks.plugElement.style.left=`${(p.x*.5+.5)*host.clientWidth}px`;
      callbacks.plugElement.style.top=`${(-p.y*.5+.5)*host.clientHeight}px`;
    }
  }
  function resetPlug(){if(!route)return;const [x,z]=placements[route.id];plugPoint=new THREE.Vector3(x+.72,1.16,z+.30);if(practice){plugged=false;buildCables();}requestRender();}
  function connect(){plugged=true;burstAt=elapsed;buildCables();requestRender();}
  // Small celebratory paper seeds are a UI response, not an electrical spark.
  const seedGroup=new THREE.Group();world.add(seedGroup);
  for(let i=0;i<16;i++){const seed=add(new THREE.SphereGeometry(.023+(i%3)*.008,8,6),mat(i%3===0?0xe3b28a:0xa0bd65),seedGroup);seed.scale.set(1,.5,1.4);seed.visible=false;sparks.push(seed);}
  function render(now = 0) {
    if (disposed || lost) return;
    const dt = last ? Math.min((now - last) / 1000, .08) : 0; last = now;
    if (!reduced) elapsed += dt;
    updateCamera();
    const previousExplosion = explosion;
    explosion += (explosionTarget - explosion) * (reduced ? 1 : .13);
    boardLayers.forEach(layer => { layer.object.position.y = layer.base + layer.lift * explosion; });
    if (Math.abs(previousExplosion - explosion) > .005) buildCables();
    if (selectedShell) selectedShell.material.emissiveIntensity = reduced ? .4 : .4 + .2 * Math.sin(elapsed * 2);
    cables.forEach((cable, index) => {
      const emphasized = step === 2 || (step === 0 ? cable.power : !cable.power);
      cable.tube.material.opacity = emphasized ? .95 : .16;
      cable.particle.visible = emphasized;
      const t = reduced ? .48 : (elapsed * .27 + index * .21) % 1;
      cable.particle.position.copy(cable.curve.getPoint(t));
    });
    dynamicParts.forEach(part => {
      if (part.type === 'led') { const level = reduced ? .6 : .32 + .6 * (.5 + .5 * Math.sin(elapsed * 2.6 - part.index * .8)); part.object.material.emissiveIntensity = level; }
      if (part.type === 'paper') part.object.scale.z = reduced ? 1 : 1 + Math.sin(elapsed * .8) * .04;
    });
    const burst=elapsed-burstAt;
    sparks.forEach((seed,i)=>{seed.visible=!reduced&&burst>=0&&burst<1.5&&route; if(seed.visible){const [x,z]=placements[route.id],a=i*2.4;seed.position.set(x+Math.sin(a)*burst*.8,.4+burst*1.6-burst*burst*.8,z+Math.cos(a)*burst*.65);}});
    renderer.render(scene, camera); positionHotspots(); needsRender = false;
  }
  function tick(now) {
    frame = 0;
    if (!active || disposed || lost) return;
    const settling = Math.abs(yaw - targetYaw) > .001 || Math.abs(pitch - targetPitch) > .001 || Math.abs(explosion - explosionTarget) > .001;
    if (needsRender || settling || (!reduced && now - last >= 33)) render(now);
    if (!reduced || settling || needsRender) frame = requestAnimationFrame(tick);
  }
  function requestRender() { needsRender = true; if (active && !frame && !lost && !disposed) frame = requestAnimationFrame(tick); }
  function setActive(value) {
    active = value; last = 0;
    if (!active) { cancelAnimationFrame(frame); frame = 0; }
    else requestRender();
  }
  const down = event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    drag = { x: event.clientX, y: event.clientY, yaw: targetYaw, pitch: targetPitch, moved: false, pointer: event.pointerId };
    if (event.pointerType === 'mouse') renderer.domElement.setPointerCapture(event.pointerId);
  };
  const move = event => {
    if (!drag || event.pointerId !== drag.pointer) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    // Keep vertical document scrolling available on touch screens.
    if (event.pointerType === 'touch' && Math.abs(dy) > Math.abs(dx) * 1.3 && !drag.moved) { drag = null; return; }
    if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
    if (drag.moved) { targetYaw = Math.max(-.95, Math.min(.95, drag.yaw + dx * .006)); targetPitch = Math.max(.46, Math.min(1.5, drag.pitch + dy * .003)); requestRender(); }
  };
  const up = event => {
    if (!drag || event.pointerId !== drag.pointer) return;
    if (!drag.moved) {
      const rect = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      ray.setFromCamera(pointer, camera); const hit = ray.intersectObjects(hits)[0]; if (hit) callbacks.onSelect(hit.object.userData.route);
    }
    drag = null;
  };
  const cancelDrag = () => { drag = null; };
  renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointermove', move);
  renderer.domElement.addEventListener('pointerup', up); renderer.domElement.addEventListener('pointercancel', cancelDrag);
  renderer.domElement.addEventListener('lostpointercapture', cancelDrag); renderer.domElement.addEventListener('pointerleave', event => { if (!renderer.domElement.hasPointerCapture(event.pointerId)) cancelDrag(); });
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); lost = true; cancelAnimationFrame(frame); frame = 0; overlay.hidden = true; renderer.domElement.hidden = true; callbacks.onFailure(); });
  const observer = new ResizeObserver(resize); observer.observe(host);
  resize();
  return {
    setBoard(id) { board = id; explosion = 0; explosionTarget = 0; buildBoard(); requestRender(); },
    select,
    setStep(value) { step = value; requestRender(); },
    setExploded(value) { explosionTarget = value ? 1 : 0; requestRender(); },
    setTop(value) { targetYaw = value ? 0 : .12; targetPitch = value ? 1.48 : .72; requestRender(); },
    reset() { targetYaw = .12; targetPitch = .72; distance = 9.7; requestRender(); },
    setReducedMotion(value) { reduced = value; requestRender(); }, setActive,
    setPractice(value){practice=value;plugged=!value;resetPlug();buildCables();requestRender();},
    resetPlug,connect,
    dragPlug(clientX,clientY){
      if(!practice||plugged)return;
      const rect=host.getBoundingClientRect();pointer.set((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1);
      ray.setFromCamera(pointer,camera);const point=new THREE.Vector3();
      if(ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-.68),point)){point.x=Math.max(-3,Math.min(3,point.x));point.z=Math.max(-2,Math.min(2,point.z));plugPoint=point;buildCables();requestRender();}
    },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect();
      resourceGeometries.forEach(geometry => geometry.dispose()); resourceMaterials.forEach(material => material.dispose()); textures.forEach(texture => texture.dispose());
      grid.geometry.dispose(); grid.material.dispose(); renderer.dispose(); renderer.domElement.remove(); overlay.replaceChildren();
    },
  };
}
