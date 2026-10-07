/* Maiben hero — the four tub photos as a live 3D carousel (Three.js).
 * Drag to spin the ring, hover to tilt, scroll or click the flavour buttons to step.
 * Spice flecks float in true depth around the ring and take on the active flavour's colour. */
import * as THREE from 'three';

const FLAVOURS = [
  { src: 'images/mustard.jpg', glow: '#e9b929', flecks: ['#e9b929', '#f3d56b', '#b88a16'] },
  { src: 'images/chilli.jpg', glow: '#d9442f', flecks: ['#b3342a', '#d9604a', '#8e2418'] },
  { src: 'images/schmaltz.jpg', glow: '#a3669b', flecks: ['#8a4f78', '#c9a0bd', '#6f6a3a'] },
  { src: 'images/7spiced.jpg', glow: '#c98a4e', flecks: ['#7a4a2b', '#d9b98a', '#c7a56d'] },
];
const N = FLAVOURS.length, STEP = (Math.PI * 2) / N;

const runway = document.getElementById('hero-runway');
const canvas = document.getElementById('hero-canvas');
const hint = document.querySelector('.hero-hint');

function loadTex(src) {
  return new Promise((res, rej) => {
    new THREE.TextureLoader().load(src, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; res(t); }, undefined, rej);
  });
}

let _shadow;
function shadowMat() {
  if (!_shadow) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'); g.filter = 'blur(10px)'; g.fillStyle = 'rgba(20,38,63,.55)';
    g.beginPath(); g.roundRect(22, 20, 84, 88, 12); g.fill();
    const t = new THREE.CanvasTexture(c);
    _shadow = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: .5 });
  }
  return _shadow.clone();
}

function cardGeometry(w, h, bend) {
  const g = new THREE.PlaneGeometry(w, h, 40, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (w / 2); p.setZ(i, -x * x * bend); }
  g.computeVertexNormals();
  return g;
}

const cardMat = (map) => new THREE.ShaderMaterial({
  transparent: true, toneMapped: false, depthWrite: false, side: THREE.FrontSide,
  uniforms: { uMap: { value: map }, uFade: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: /* glsl */`
    uniform sampler2D uMap; uniform float uFade; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(uMap, vUv);
      // Rounded photo card with a thin anti-aliased edge (sits on the light backdrop)
      vec2 q = abs(vUv - .5) * vec2(1., 1.) - (vec2(.5) - vec2(.07, .06));
      float rd = length(max(q, 0.)) - .06;
      float m = 1. - smoothstep(-.004, .004, rd);
      vec3 col = c.rgb;
      gl_FragColor = vec4(col, m * uFade);
      #include <colorspace_fragment>
    }`,
});

export async function startHero(onStage) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    if (!renderer.getContext()) return false;
  } catch (e) { return false; }
  const touch = matchMedia('(pointer:coarse)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, touch ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);

  let textures;
  try { textures = await Promise.all(FLAVOURS.map((f) => loadTex(f.src))); } catch (e) { return false; }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0.15, 12);

  /* Ring of curved photo cards */
  const rig = new THREE.Group(); scene.add(rig);
  const ring = new THREE.Group(); rig.add(ring);
  const R = 3.2, CW = 3.1, CH = CW * (580 / 504);
  const cards = textures.map((tex, i) => {
    const m = cardMat(tex);
    const mesh = new THREE.Mesh(cardGeometry(CW, CH, 0.32), m);
    const holder = new THREE.Group();
    holder.rotation.y = i * STEP;
    mesh.position.z = R;
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(CW * 1.18, CH * 1.12), shadowMat());
    sh.position.set(0, -0.22, R - 0.09);
    holder.add(sh, mesh); ring.add(holder);
    return { mesh, m, sh };
  });

  const glow = { material: { color: new THREE.Color() } };   // (backdrop glow removed: it muddied the photos)

  /* Floating flecks in depth */
  const COUNT = touch ? 70 : 150, pos = new Float32Array(COUNT * 3), seed = new Float32Array(COUNT), col = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 5;
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = (Math.random() - 0.5) * 6; pos[i * 3 + 2] = Math.sin(a) * r - 1; seed[i] = Math.random() * 10;
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.07, vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false, sizeAttenuation: true, blending: THREE.NormalBlending }));
  rig.add(pts);
  const tint = (i) => {
    const cs = FLAVOURS[i].flecks.map((h) => new THREE.Color(h));
    for (let k = 0; k < COUNT; k++) { const c = cs[k % cs.length]; col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; }
    pg.attributes.color.needsUpdate = true;
  };
  tint(0);

  /* Layout */
  let baseScale = 1;
  const size = () => {
    const w = innerWidth, h = innerHeight, wide = w / h > 1.15;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.fov = wide ? 32 : 40; camera.updateProjectionMatrix();
    rig.position.set(wide ? Math.min(2.5, w / h * 1.4) : 0, wide ? -0.1 : 1.32, 0);
    baseScale = wide ? 0.86 : Math.min(0.54, (w / h) * 1.2);
    rig.scale.setScalar(baseScale);
  };
  size(); addEventListener('resize', size, { passive: true });

  /* State: ring angle, scroll stage, drag */
  let progress = 0, angle = 0, target = 0, active = 0, lastScrollStage = 0, dragging = false, px = 0, vel = 0;
  const hover = { x: 0, y: 0, tx: 0, ty: 0 };
  const stageOf = (p) => Math.min(N - 1, Math.floor(p * N));
  const go = (i) => { const cur = -Math.round(target / STEP); const d = (((i - cur) % N) + N + N / 2) % N - N / 2; target = -(cur + d) * STEP; };

  const update = () => {
    const r = runway.getBoundingClientRect(), span = r.height - innerHeight;
    progress = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
    const s = stageOf(progress);
    if (s !== lastScrollStage) { lastScrollStage = s; go(s); }
  };
  addEventListener('scroll', update, { passive: true }); update();

  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
    const k = +b.dataset.go, span = runway.offsetHeight - innerHeight;
    go(k); hint?.classList.add('gone');
    lastScrollStage = k;
    scrollTo({ top: runway.offsetTop + ((k + 0.5) / N) * span, behavior: 'smooth' });
  }));

  /* Gestures. One finger / mouse: spin (X) and tilt (Y). Two fingers: pinch to zoom, twist to roll.
   * Pitch, roll and zoom are springs: they ease back to rest when you let go. */
  const hit = document.querySelector('.hero-zone') || canvas.parentElement;
  const pose = { pitch: 0, roll: 0, zoom: 1, tPitch: 0, tRoll: 0, tZoom: 1, gx: 0, gy: 0, tgx: 0, tgy: 0 };
  const ptrs = new Map();
  let g2 = null;                                   // two-finger gesture baseline
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let downX = 0, downY = 0, downT = 0, moved = 0;

  const two = () => { const [a, b] = [...ptrs.values()]; return { d: Math.hypot(b.x - a.x, b.y - a.y), r: Math.atan2(b.y - a.y, b.x - a.x) }; };
  const tap = (e) => {
    if (moved > 8 || performance.now() - downT > 450) return false;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(cards.map((c) => c.mesh), false);
    if (!hits.length) return false;
    const i = cards.findIndex((c) => c.mesh === hits[0].object);
    if (i === shown) { const sel = document.getElementById('bk-flavour'); if (sel) sel.selectedIndex = i; document.querySelector('.ab-order, .hero-btns .btn-gold')?.click(); }
    else { go(i); lastScrollStage = i; }
    return true;
  };

  hit.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    hit.setPointerCapture?.(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    hint?.classList.add('gone'); hit.classList.add('grabbing');
    if (ptrs.size === 1) { dragging = true; vel = 0; downX = e.clientX; downY = e.clientY; downT = performance.now(); moved = 0; }
    if (ptrs.size === 2) { const t2 = two(); g2 = { d: t2.d, r: t2.r, zoom: pose.tZoom, roll: pose.tRoll }; dragging = false; moved = 99; }
  });
  hit.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') { hover.tx = (e.clientX / innerWidth - 0.5) * 2; hover.ty = (e.clientY / innerHeight - 0.5) * 2; }
    const p = ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size >= 2 && g2) {
      const t2 = two();
      pose.tZoom = THREE.MathUtils.clamp(g2.zoom * (t2.d / g2.d), 0.8, 1.35);
      let dr = t2.r - g2.r; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
      pose.tRoll = THREE.MathUtils.clamp(g2.roll + dr, -0.9, 0.9);
      return;
    }
    if (!dragging) return;
    moved += Math.abs(dx) + Math.abs(dy);
    const d = dx / innerWidth * 5.2; angle += d; vel = d; target = angle;                        // yaw: spin the ring
    pose.tPitch = THREE.MathUtils.clamp(pose.tPitch + dy * 0.006, -0.55, 0.55);                // pitch: tip the tub toward / away
  });
  const release = (e) => {
    const had = ptrs.delete(e.pointerId);
    hit.releasePointerCapture?.(e.pointerId);
    if (!had) return;
    if (ptrs.size === 1) { g2 = null; const [r] = [...ptrs.values()]; dragging = true; vel = 0; downT = 0; px = r.x; return; }   // lifted one of two fingers
    if (ptrs.size > 0) return;
    hit.classList.remove('grabbing'); g2 = null;
    pose.tPitch = 0; pose.tRoll = 0; pose.tZoom = 1;                                            // springs home
    if (!dragging) { target = Math.round(target / STEP) * STEP; return; }
    dragging = false;
    if (e.type === 'pointerup' && tap(e)) { target = Math.round(target / STEP) * STEP; return; }
    target = Math.round((angle + vel * 9) / STEP) * STEP;                                        // flick, then snap to a tub
  };
  hit.addEventListener('pointerup', release); hit.addEventListener('pointercancel', release);
  hit.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hover.tx = hover.ty = 0; });
  hit.addEventListener('dblclick', () => { pose.tPitch = pose.tRoll = 0; pose.tZoom = 1; });
  hit.addEventListener('wheel', (e) => { if (e.ctrlKey) { e.preventDefault(); pose.tZoom = THREE.MathUtils.clamp(pose.tZoom - e.deltaY * 0.01, 0.8, 1.35); clearTimeout(hit._z); hit._z = setTimeout(() => { pose.tZoom = 1; }, 700); } }, { passive: false });
  hit.tabIndex = 0; hit.setAttribute('aria-label', 'Interactive 3D view of the four herring tubs. Drag to turn and tilt, pinch to zoom. Arrow keys also turn it.');
  hit.addEventListener('keydown', (e) => {
    const k = { ArrowLeft: () => (target += STEP), ArrowRight: () => (target -= STEP), ArrowUp: () => (pose.tPitch = -0.3), ArrowDown: () => (pose.tPitch = 0.3) }[e.key];
    if (!k) return; e.preventDefault(); k(); hint?.classList.add('gone');
  });
  hit.addEventListener('keyup', (e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') pose.tPitch = 0; });

  /* Phone tilt: parallax from device orientation (iOS asks permission on first touch) */
  const onTilt = (e) => {
    if (e.gamma == null) return;
    pose.tgx = THREE.MathUtils.clamp(e.gamma / 35, -1, 1);                         // roll the phone left/right -> yaw the tub
    pose.tgy = THREE.MathUtils.clamp(((e.beta || 50) - 50) / 35, -1, 1);          // tip the phone toward you -> pitch the tub
  };
  if (touch && !reduced && 'DeviceOrientationEvent' in window) {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      hit.addEventListener('pointerdown', () => DeviceOrientationEvent.requestPermission().then((r) => r === 'granted' && addEventListener('deviceorientation', onTilt)).catch(() => {}), { once: true });
    } else addEventListener('deviceorientation', onTilt);
  }

  /* Loop */
  const clock = new THREE.Clock(); let visible = true, ready = false, shown = -1;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(runway);
  const tick = () => {
    requestAnimationFrame(tick);
    if (!visible || document.hidden) return;
    const t = clock.getElapsedTime();
    angle += (target - angle) * (dragging ? 0 : reduced ? 1 : 0.085);        // damped, per spec
    ring.rotation.y = angle;                                                   // card i faces the camera when angle = -i * STEP
    hover.x += (hover.tx - hover.x) * 0.06; hover.y += (hover.ty - hover.y) * 0.06;
    const k = reduced ? 1 : 0.12;
    pose.pitch += (pose.tPitch - pose.pitch) * k; pose.roll += (pose.tRoll - pose.roll) * k; pose.zoom += (pose.tZoom - pose.zoom) * k;
    pose.gx += (pose.tgx - pose.gx) * 0.08; pose.gy += (pose.tgy - pose.gy) * 0.08;
    rig.rotation.y = hover.x * 0.12 + pose.gx * 0.32;
    rig.rotation.x = hover.y * 0.06 + pose.gy * 0.26 + pose.pitch;
    rig.rotation.z = pose.roll;
    rig.scale.setScalar(baseScale * pose.zoom);
    ring.position.y = reduced ? 0 : Math.sin(t * 0.9) * 0.05;
    camera.position.x = hover.x * 0.25;

    // Active flavour = the card closest to the camera
    const a = ((-angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const idx = Math.round(a / STEP) % N;
    cards.forEach(({ m }, i) => {
      const th = i * STEP + angle; const d = Math.abs((((th % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI);   // 0 = facing camera
      const f = THREE.MathUtils.clamp(1 - d / 1.2, 0, 1);   // neighbours dissolve instead of hanging at the edges
      m.uniforms.uFade.value = f; cards[i].sh.material.opacity = 0.5 * f;
    });
    if (idx !== shown) { shown = idx; active = idx; tint(idx); onStage(idx, 0.15 + 0.85 * (idx / (N - 1))); }

    const pa = pg.attributes.position;
    if (!reduced) for (let i = 0; i < COUNT; i++) { pa.setY(i, pos[i * 3 + 1] + Math.sin(t * 0.5 + seed[i]) * 0.25); pa.setX(i, pos[i * 3] + Math.cos(t * 0.35 + seed[i]) * 0.12); pa.setZ(i, pos[i * 3 + 2]); }
    pa.needsUpdate = true;
    pts.rotation.y = -angle * 0.35 + t * 0.02;

    renderer.render(scene, camera);
    if (!ready) { ready = true; document.documentElement.classList.add('hero-ready'); }
  };
  tick();
  return true;
}
