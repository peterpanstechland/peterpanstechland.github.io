import { boards, routes } from './wiring-data.js';

const $ = id => document.getElementById(id);
const root = $('wiring-app');
let board = 'xiao', selected = 'water', step = 0, scene, timer = 0;
let starting = false, inView = false, exploded = false, topView = false, sceneAvailable = false;
let mode = 'explore', connected = false, plugDrag = null;
let suppressPlugClick = false;
const completed = new Set();
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const current = () => routes.find(route => route.id === selected);

function stopPlayback() {
  clearInterval(timer); timer = 0;
  $('wiring-play').setAttribute('aria-pressed', 'false');
  $('wiring-play').textContent = '播放三步接线';
}
function showStep(next) {
  step = Math.max(0, Math.min(2, next));
  const [title, text] = current().steps[step];
  $('wiring-step-title').textContent = title;
  $('wiring-step-text').textContent = text;
  $('wiring-step-count').textContent = `${step + 1} / 3`;
  root.querySelectorAll('[data-wiring-step]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.wiringStep) === step)));
  $('wiring-prev').disabled = step === 0;
  $('wiring-next').disabled = step === 2;
  scene?.setStep(step);
}
function showRoute(id) {
  const route = routes.find(item => item.id === id && item.board === board);
  if (!route) return;
  stopPlayback(); selected = id;
  $('wiring-protocol').textContent = route.protocol;
  $('wiring-status').textContent = route.status;
  $('wiring-device-title').textContent = route.title;
  $('wiring-device-line').textContent = route.line;
  $('wiring-port-address').textContent = route.address;
  $('wiring-caution').textContent = route.caution;
  $('wiring-doc-link').href = route.doc;
  $('wiring-doc-link').textContent = route.docLabel || '打开完整接线教程 ↗';
  $('wiring-pin-list').replaceChildren(...route.pins.map(([kind, from, to]) => {
    const li = document.createElement('li');
    const dot = document.createElement('span'); dot.className = 'wiring-wire-dot'; dot.dataset.kind = kind; dot.setAttribute('aria-hidden', 'true');
    const source = document.createElement('span'); source.textContent = from;
    const arrow = document.createElement('span'); arrow.className = 'wiring-pin-arrow'; arrow.textContent = '→'; arrow.setAttribute('aria-hidden', 'true');
    const destination = document.createElement('span'); destination.textContent = to;
    li.append(dot, source, arrow, destination); return li;
  }));
  root.querySelectorAll('[data-wiring-route]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.wiringRoute === selected)));
  scene?.select(route);
  showStep(0);
  refreshPractice();
}
function say(line, mood = 'idle') {
  $('wiring-buddy-line').textContent = line;
  $('wiring-buddy').dataset.mood = mood;
}
function refreshPractice() {
  connected = false;
  $('wiring-practice-note').hidden = mode !== 'practice';
  $('wiring-plug').hidden = mode !== 'practice' || !sceneAvailable;
  $('wiring-connect').hidden = false; $('wiring-retry').hidden = true; $('wiring-next-device').hidden = true;
  $('wiring-practice-hint').textContent = `把插头送到 ${current().port}，也可点插头再点接口`;
  scene?.setPractice(mode === 'practice');
  root.classList.toggle('is-practicing', mode === 'practice');
  root.classList.remove('is-connected');
  if (mode === 'practice') { say(`我准备好啦！这根线要去 ${current().port}。`); showStep(1); }
  else say(current().id === 'water' ? '嗨，先帮我看看水箱还有多少水～' : `${current().title}已就位。转转板子，认识一下它的小窝。`);
}
function connectPlug() {
  if (mode !== 'practice' || connected) return;
  connected = true; completed.add(selected);
  $('wiring-progress').textContent = `练习 ${completed.size} / ${routes.length}`;
  root.classList.add('is-connected');
  $('wiring-plug').hidden = true; $('wiring-connect').hidden = true; $('wiring-retry').hidden = false; $('wiring-next-device').hidden = false;
  root.querySelectorAll('.wiring-port-button').forEach(button => { button.dataset.completed = String(completed.has(button.dataset.wiringRoute)); });
  $('wiring-practice-hint').textContent = `啪嗒，${current().port} 教学连接完成！`;
  say(completed.size === routes.length ? '九种接法全部认识啦！你就是我的首席接线官。' : '啪嗒！收到收到。接下来，我们看看怎么验证～', 'happy');
  scene?.connect(); showStep(2);
}
function onPortClick(id) {
  if (mode !== 'practice') { showRoute(id); return; }
  if (connected) return;
  if (id === selected) connectPlug();
  else { const other = routes.find(item => item.id === id); say(`走错小窝啦，这是 ${other.port}。这根线要去 ${current().port}，再试一次～`, 'oops'); scene?.resetPlug(); }
}
function showBoard(id) {
  if (!boards[id]) return;
  board = id;
  $('wiring-version').textContent = boards[id].version;
  $('wiring-scene-label').textContent = boards[id].label;
  root.querySelectorAll('[data-wiring-board]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.wiringBoard === id)));
  $('wiring-port-picker').replaceChildren(...routes.filter(route => route.board === id).map(route => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'wiring-port-button'; button.dataset.wiringRoute = route.id;
    button.dataset.completed = String(completed.has(route.id));
    const port = document.createElement('span'); port.textContent = route.port;
    const title = document.createElement('strong'); title.textContent = route.title;
    button.append(port, title); button.addEventListener('click', () => showRoute(route.id));
    return button;
  }));
  scene?.setBoard(id);
  exploded = false; topView = false;
  $('wiring-explode').setAttribute('aria-pressed', 'false');
  $('wiring-top').setAttribute('aria-pressed', 'false');
  scene?.setExploded(false); scene?.reset();
  showRoute(boards[id].first);
}
function reportFailure() {
  sceneAvailable = false; $('wiring-plug').hidden = true;
  $('wiring-fallback').hidden = false;
  $('wiring-render-status').textContent = '三维视图暂不可用 · 下方接口与三步教程仍可操作';
  $('wiring-gesture').textContent = '请使用下方接口按钮';
  ['wiring-top', 'wiring-explode', 'wiring-reset'].forEach(id => { $(id).disabled = true; });
}
async function startScene() {
  if (starting) return;
  starting = true;
  try {
    const { createWiringScene } = await import('./wiring-scene.js');
    scene = createWiringScene($('wiring-view'), $('wiring-hotspots'), {
      onSelect: onPortClick, onFailure: reportFailure,
      plugElement: $('wiring-plug'),
    });
    sceneAvailable = true;
    scene.setBoard(board); scene.select(current()); scene.setStep(step);
    scene.setExploded(exploded); scene.setTop(topView);
    scene.setReducedMotion(motion.matches); scene.setActive(inView && !document.hidden);
    $('wiring-fallback').hidden = true;
    scene.setPractice(mode === 'practice'); $('wiring-plug').hidden = mode !== 'practice' || connected;
  } catch {
    scene?.dispose(); scene = null; reportFailure();
  }
}
root.querySelectorAll('[data-wiring-board]').forEach(button => button.addEventListener('click', () => showBoard(button.dataset.wiringBoard)));
root.querySelectorAll('[data-wiring-mode]').forEach(button => button.addEventListener('click', () => {
  stopPlayback(); mode = button.dataset.wiringMode;
  root.querySelectorAll('[data-wiring-mode]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  refreshPractice();
}));
$('wiring-connect').addEventListener('click', connectPlug);
$('wiring-retry').addEventListener('click', refreshPractice);
$('wiring-next-device').addEventListener('click', () => {
  const next = routes[(routes.findIndex(route => route.id === selected) + 1) % routes.length];
  if (next.board !== board) showBoard(next.board);
  showRoute(next.id);
});
$('wiring-plug').addEventListener('click', () => {
  if (suppressPlugClick) { suppressPlugClick = false; return; }
  if (mode === 'practice' && !connected) say(`拿稳啦～点一下 ${current().port}，把我接上去。`);
});
$('wiring-plug').addEventListener('pointerdown', event => {
  event.preventDefault();
  plugDrag = { pointer: event.pointerId, moved: false, x: event.clientX, y: event.clientY };
  $('wiring-plug').setPointerCapture(event.pointerId); $('wiring-plug').classList.add('is-held');
});
$('wiring-plug').addEventListener('pointermove', event => {
  if (!plugDrag || event.pointerId !== plugDrag.pointer) return;
  if (Math.hypot(event.clientX - plugDrag.x, event.clientY - plugDrag.y) > 4) plugDrag.moved = true;
  if (plugDrag.moved) scene?.dragPlug(event.clientX, event.clientY);
});
function releasePlug(event) {
  if (!plugDrag || event.pointerId !== plugDrag.pointer) return;
  $('wiring-plug').classList.remove('is-held');
  if (event.type !== 'pointercancel' && plugDrag.moved) {
    suppressPlugClick = true;
    const target = [...$('wiring-hotspots').querySelectorAll('button:not([hidden])')].map(button => {
      const rect = button.getBoundingClientRect();
      return { id: button.dataset.wiringRoute, distance: Math.hypot(event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2)) };
    }).sort((a, b) => a.distance - b.distance)[0];
    if (target && target.distance < 48) onPortClick(target.id);
    else { scene?.resetPlug(); say(`差一点点～把插头拖到写着 ${current().port} 的小标签上。`); }
  }
  plugDrag = null;
}
$('wiring-plug').addEventListener('pointerup', releasePlug);
$('wiring-plug').addEventListener('pointercancel', releasePlug);
root.querySelectorAll('[data-wiring-step]').forEach(button => button.addEventListener('click', () => { stopPlayback(); showStep(Number(button.dataset.wiringStep)); }));
$('wiring-prev').addEventListener('click', () => { stopPlayback(); showStep(step - 1); });
$('wiring-next').addEventListener('click', () => { stopPlayback(); showStep(step + 1); });
$('wiring-play').addEventListener('click', () => {
  if (timer) { stopPlayback(); return; }
  showStep(0);
  $('wiring-play').textContent = '暂停教学'; $('wiring-play').setAttribute('aria-pressed', 'true');
  timer = setInterval(() => { if (step === 2) stopPlayback(); else showStep(step + 1); }, 6500);
});
$('wiring-explode').addEventListener('click', () => {
  exploded = !exploded; $('wiring-explode').setAttribute('aria-pressed', String(exploded)); scene?.setExploded(exploded);
});
$('wiring-top').addEventListener('click', () => {
  topView = !topView; $('wiring-top').setAttribute('aria-pressed', String(topView)); scene?.setTop(topView);
});
$('wiring-reset').addEventListener('click', () => {
  topView = false; $('wiring-top').setAttribute('aria-pressed', 'false'); scene?.reset();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) stopPlayback(); scene?.setActive(inView && !document.hidden); });
motion.addEventListener('change', event => scene?.setReducedMotion(event.matches));
window.addEventListener('pagehide', () => { stopPlayback(); scene?.setActive(false); });
window.addEventListener('pageshow', () => scene?.setActive(inView && !document.hidden));
showBoard('xiao');
if ('IntersectionObserver' in window) {
  new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting;
    if (inView) startScene(); else stopPlayback();
    scene?.setActive(inView && !document.hidden);
  }, { rootMargin: '180px' }).observe(root);
} else { inView = true; startScene(); }
