/* Hero controller: boots the 3D photo carousel and drives the stage text + HUD.
 * Without WebGL (or with reduced motion) the first photo stays as a static image and the
 * flavour buttons still swap the photo and text. */
const stages = [...document.querySelectorAll('.stage')];
const nums = [...document.querySelectorAll('.hud-num')];
const photos = [...document.querySelectorAll('.hero-photos img')];
const fill = document.getElementById('hud-fill');
const frame = document.querySelector('.hero-sticky-frame');
const WORD = ['MUSTARD', 'CHILLI', 'SCHMALTZ', '7 SPICED'];
const bgword = document.getElementById('hero-bgword');
const FLAV = ['#D9A41E', '#C8281A', '#6E8B3D', '#8A5A33'];   // mustard, chilli, schmaltz, 7 spiced
let shown = -1;

function onStage(i, pct) {
  if (i !== shown) {
    shown = i;
    frame.style.setProperty('--flav', FLAV[i]);
    if (bgword) { bgword.classList.remove('swap'); void bgword.offsetWidth; bgword.textContent = WORD[i]; bgword.style.setProperty('--len', WORD[i].length); bgword.classList.add('swap'); }
    stages.forEach((s, k) => s.classList.toggle('active', k === i));
    nums.forEach((n, k) => n.classList.toggle('active', k === i));
    photos.forEach((p, k) => p.classList.toggle('on', k === i));
  }
  fill.style.width = (pct * 100).toFixed(1) + '%';
}

function staticFallback() {
  const runway = document.getElementById('hero-runway');
  const update = () => {
    const r = runway.getBoundingClientRect(), span = r.height - innerHeight;
    const p = span > 0 ? Math.min(Math.max(-r.top / span, 0), 1) : 0;
    const i = Math.min(3, Math.floor(p * 4));
    onStage(i, 0.15 + 0.85 * (i / 3));
  };
  addEventListener('scroll', update, { passive: true });
  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => onStage(+b.dataset.go, 0.15 + 0.85 * (+b.dataset.go / 3))));
  update();
}

onStage(0, 0.15);
let ok = false;
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  try { const { startHero } = await import('./hero-3d.js'); ok = await startHero(onStage); }
  catch (err) { console.warn('3D hero unavailable, using static photo.', err); }
}
if (!ok) staticFallback();
