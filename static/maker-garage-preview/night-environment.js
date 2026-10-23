// Scene lighting and atmospheric graphics, locally authored. These are not
// additional Tripo assets and do not replace any of the generated GLBs.
export function createNightEnvironment(THREE, Reflector, scene, {mobile}) {
  const group = new THREE.Group();
  group.name = 'AUTHORED_NIGHT_ATMOSPHERE';
  group.userData = {locallyAuthored: true, atmosphericOnly: true};
  scene.add(group);
  scene.add(new THREE.HemisphereLight('#728cb8', '#161126', 0.45));
  const key = new THREE.DirectionalLight('#c2d5ff', 0.85);
  key.position.set(3, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(key.shadow.camera, {left: -7, right: 7, top: 7, bottom: -7, near: 0.1, far: 30});
  key.shadow.normalBias = 0.008;
  key.shadow.bias = -0.00015;
  group.add(key);
  const rim = new THREE.DirectionalLight('#7462dc', 1.1);
  rim.position.set(-5, 4, -4);
  group.add(rim);

  function point(color, power, position, range = 6) {
    const light = new THREE.PointLight(color, power, range, 2);
    light.position.fromArray(position);
    group.add(light);
    return light;
  }
  point('#ff9047', 10, [0, 2.1, 0.65], 5);
  point('#ffbf78', 2.4, [0, 1.6, -0.35], 4);
  point('#ff218a', 14, [-1.6, 2.8, 2.2]);
  point('#16d9ff', 10, [1.8, 2.4, 1.5]);
  point('#f53aaf', 4, [1.8, 0.6, 2.7], 4);

  // Actual planar scene reflection, with restrained breakup to read as wet
  // asphalt rather than a perfectly polished studio mirror.
  const shader = {
    uniforms: THREE.UniformsUtils.clone(Reflector.ReflectorShader.uniforms),
    vertexShader: Reflector.ReflectorShader.vertexShader
      .replace('varying vec4 vUv;', 'varying vec4 vUv; varying vec2 groundPosition;')
      .replace('vUv = textureMatrix', 'groundPosition = position.xy; vUv = textureMatrix'),
    fragmentShader: `
      uniform sampler2D tDiffuse;
      varying vec4 vUv;
      varying vec2 groundPosition;
      #include <logdepthbuf_pars_fragment>
      float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p) {
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),
                   mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
      }
      void main() {
        #include <logdepthbuf_fragment>
        vec2 p=groundPosition;
        float grain=noise(p*65.);
        float puddle=smoothstep(.28,.77,noise(p*1.8));
        vec4 projected=vUv;
        projected.xy += vec2(sin(p.y*39.+noise(p*4.)*6.),cos(p.x*43.))*.00075*projected.w;
        vec3 reflection=texture2DProj(tDiffuse,projected).rgb;
        float fade=1.-smoothstep(5.,25.,length(p));
        // A visible matte ground pool makes the slab's contact and shadow
        // readable; a nearly black mirror made the whole island feel afloat.
        float groundPool=1.-smoothstep(3.,11.,length(p));
        vec3 asphalt=mix(vec3(.003,.006,.014),vec3(.018,.024,.035),groundPool)*(0.8+grain*.25);
        gl_FragColor=vec4(asphalt+reflection*mix(.12,.48,puddle)*fade,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  };
  const reflection = new Reflector(new THREE.PlaneGeometry(120, 120), {
    textureWidth: mobile ? 256 : 768,
    textureHeight: mobile ? 256 : 768,
    multisample: 0,
    clipBias: 0.003,
    shader,
  });
  reflection.name = 'AUTHORED_WET_GROUND_REFLECTION';
  reflection.rotation.x = -Math.PI / 2;
  reflection.position.y = -0.34;
  reflection.userData = {locallyAuthored: true, atmosphericOnly: true};
  group.add(reflection);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.ShadowMaterial({opacity: 0.52}));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.338;
  shadow.receiveShadow = true;
  group.add(shadow);

  // Intentionally abstract, dim city lights; no fabricated skyline landmark.
  const canvas = document.createElement('canvas');
  canvas.width = mobile ? 512 : 1024;
  canvas.height = canvas.width / 2;
  const ctx = canvas.getContext('2d');
  ctx.scale(canvas.width / 1024, canvas.height / 512);
  const haze = ctx.createLinearGradient(0, 0, 0, 512);
  haze.addColorStop(0, '#030711');
  haze.addColorStop(0.6, '#0a1529');
  haze.addColorStop(1, '#030711');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, 1024, 512);
  ctx.filter = 'blur(2px)';
  let seed = 73;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 24; i++) {
    const x = i * 45 - 12, height = 90 + random() * 240, width = 24 + random() * 25;
    ctx.fillStyle = '#050a16';
    ctx.fillRect(x, 512 - height, width, height);
    for (let y = 512 - height + 13; y < 495; y += 16) {
      for (let wx = x + 5; wx < x + width - 5; wx += 10) {
        if (random() > 0.33) continue;
        ctx.fillStyle = random() > 0.68 ? '#742451' : '#18374c';
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
        ctx.fillRect(wx, y, 3, 5);
      }
    }
  }
  ctx.shadowBlur = 0;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const skyline = new THREE.Mesh(new THREE.PlaneGeometry(42, 17), new THREE.MeshBasicMaterial({map: texture, color: new THREE.Color(0.28, 0.35, 0.48), fog: false, depthWrite: false}));
  skyline.position.set(0, 6, -16);
  skyline.name = 'AUTHORED_ABSTRACT_CITY_LIGHTS';
  skyline.userData = {locallyAuthored: true, atmosphericOnly: true};
  group.add(skyline);
  return {group, reflection};
}

export function addPracticalLights(THREE, scene, entries) {
  const group = new THREE.Group();
  group.name = 'AUTHORED_PRACTICAL_LIGHT_SOURCES';
  group.userData = {locallyAuthored: true, lightingOnly: true};
  // Interior illumination comes from the scene lights. Do not add unattached
  // luminous bars across the workshop opening or in front of the display.
  const sign = entries.get('03_profile_sign');
  if (sign?.state === 'ready') {
    const center = sign.bounds.getCenter(new THREE.Vector3());
    const radius = sign.bounds.getSize(new THREE.Vector3()).y * 0.44;
    for (const [r, color, from, length] of [[radius, '#ff1586', 0, Math.PI * 1.65], [radius * .86, '#2addff', Math.PI * .8, Math.PI * .7]]) {
      const tube = new THREE.Mesh(new THREE.TorusGeometry(r, 0.009, 6, 64, length), new THREE.MeshBasicMaterial({color: new THREE.Color(color).multiplyScalar(2.4), toneMapped: false}));
      tube.rotation.z = from;
      tube.position.set(center.x, center.y, sign.bounds.max.z + 0.014);
      group.add(tube);
    }
  }
  scene.add(group);
  return group;
}
