(() => {
  const zh = document.documentElement.lang === 'zh-Hans';
  const compact = matchMedia('(max-width: 700px), (max-width: 996px) and (max-height: 500px)');
  const deck = document.querySelector('.more-controls');
  const summary = deck.querySelector('summary');
  const views = document.querySelector('.view-controls');
  const shorts = {
    overview: ['Overview', '整体'], front: ['Front', '正面'],
    interior: ['Workshop', '室内'], rear: ['Wall', '共创墙'],
    'leave-trace': ['Leave a trace', '到此一游'], projects: ['Projects', '项目'],
    sponsors: ['Sponsors', '赞助商'],
  };
  const labels = {
    overview: ['Overview', '整体视角'], front: ['Front view', '正面视角'],
    interior: ['Workshop', '室内工具'], rear: ['Community wall', '共创墙（车库背面）'],
    'leave-trace': ['Leave a trace', '到此一游'], projects: ['Projects · vending machine', '项目贩卖机'],
    sponsors: ['Sponsors', '赞助商'],
  };
  for (const [id, short] of Object.entries(shorts)) {
    const button = document.getElementById(id);
    button.dataset.short = short[zh ? 1 : 0];
    button.setAttribute('aria-label', labels[id][zh ? 1 : 0]);
  }
  document.querySelector('.toolbar').setAttribute('aria-label', zh ? '车库控制' : 'Garage controls');
  views.setAttribute('aria-label', zh ? '切换视角' : 'Camera views');
  document.querySelector('.door-controls').setAttribute('aria-label', zh ? '卷帘门控制' : 'Garage door');
  summary.setAttribute('aria-label', zh ? '更多控制' : 'More controls');
  document.querySelector('[data-control-copy="more"]').textContent = zh ? '更多' : 'More';
  document.querySelector('[data-control-copy="title"]').textContent = zh ? 'GARAGE / 更多控制' : 'GARAGE / CONTROLS';
  const syncLayout = () => { deck.open = !compact.matches; };
  syncLayout();
  compact.addEventListener('change', syncLayout);
  const selected = new URLSearchParams(location.search).get('view') || 'overview';
  const selectView = (id) => {
    for (const button of views.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.id === id));
  };
  selectView(['front', 'interior', 'rear'].includes(selected) ? selected : 'overview');
  views.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button) selectView(button.id);
  });
  document.addEventListener('click', (event) => {
    if (compact.matches && deck.open && !deck.contains(event.target)) deck.open = false;
  });
  document.getElementById('asset-toggle').addEventListener('click', () => {
    if (compact.matches) {
      deck.open = false;
      setTimeout(() => document.getElementById('asset-close').focus(), 0);
    }
  });
  document.getElementById('asset-close').addEventListener('click', () => {
    if (compact.matches) setTimeout(() => summary.focus(), 0);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && compact.matches && deck.open) {
      deck.open = false;
      summary.focus();
    }
  });
})();
