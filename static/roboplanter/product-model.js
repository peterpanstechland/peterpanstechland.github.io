// Load the dense exterior mesh only after an explicit visitor action.
(() => {
  const openButton = document.getElementById('load-product-model');
  const closeButton = document.getElementById('close-product-model');
  const frame = document.getElementById('product-frame');
  const poster = document.getElementById('product-poster');
  const loadPanel = document.getElementById('product-load');
  const hint = document.getElementById('product-hint');
  const display = document.querySelector('.product-display');
  let active = false;
  openButton.hidden = false;

  openButton.addEventListener('click', () => {
    if (active) return;
    active = true;
    display.classList.add('is-active');
    poster.hidden = true;
    loadPanel.hidden = true;
    frame.hidden = false;
    closeButton.hidden = false;
    openButton.setAttribute('aria-expanded', 'true');
    hint.textContent = '拖动旋转 · 双指缩放 · 可关闭自动转台';
    frame.src = './model-viewer/?embed=1';
  });
  frame.addEventListener('load', () => { if (active) frame.focus(); });
  closeButton.addEventListener('click', () => {
    active = false;
    display.classList.remove('is-active');
    frame.hidden = true;
    frame.src = 'about:blank';
    poster.hidden = false;
    loadPanel.hidden = false;
    closeButton.hidden = true;
    openButton.setAttribute('aria-expanded', 'false');
    hint.textContent = '先看一眼，再决定要不要转一圈。';
    openButton.focus();
  });
})();
