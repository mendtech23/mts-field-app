/* GaragePro — line icons. Screen symbols are swapped for crisp SVG icons as the page renders.
   Customer message text (textareas, inputs), printed documents and PDFs are never touched. */
'use strict';

function ic(name, cls = '') {
  const p = ICON_PATHS[name]; if (!p) return '';
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}

const EMOJI_ICON = {
  '＋': 'plus', '⌕': 'search', '▦': 'layout-dashboard', '✎': 'file-pencil', '🔧': 'tool', '🧾': 'file-invoice', '💳': 'credit-card',
  '👤': 'user', '🚗': 'car', '🔔': 'bell', '📦': 'package', '🚚': 'truck-delivery', '🏭': 'building-factory-2', '⏱': 'clock-hour-4',
  '👷': 'user-cog', '💸': 'receipt', '📊': 'chart-bar', '🔒': 'lock', '⚙': 'settings', '📅': 'calendar-event', '🖨': 'printer',
  '⬇': 'download', '⬆': 'upload', '👁': 'eye', '📤': 'share', '✉': 'mail', '💬': 'message-circle', '📷': 'camera', '📄': 'file-text',
  '✍': 'signature', '🔍': 'zoom-check', '⚠': 'alert-triangle', '✔': 'check', '✓': 'check', '✕': 'x', '✖': 'x', '✅': 'circle-check',
  '🎉': 'confetti', '👋': 'hand-stop', '💡': 'bulb', '🅿': 'parking', '🆕': 'sparkles', '📈': 'trending-up', '📭': 'inbox',
  '💾': 'device-floppy', '🧪': 'flask', '🛠': 'tools', '🛡': 'shield', '🪪': 'id', '💰': 'coin', '💵': 'cash', '📋': 'clipboard',
  '📱': 'device-mobile', '🚐': 'truck', '📍': 'map-pin', '🧭': 'navigation', '📞': 'phone', '📥': 'inbox', '🗺': 'map', '🔄': 'arrows-exchange',
  '⏰': 'clock', '🏁': 'flag', '▶': 'player-play', '↩': 'arrow-back-up', '🏬': 'building-warehouse', '☁': 'cloud', '⚡': 'bolt', '⟳': 'refresh', '⏳': 'hourglass', '★': 'star', '👥': 'users', '☰': 'menu-2', '📣': 'speakerphone', '🤝': 'heart-handshake', '🔁': 'repeat', '⭐': 'star', '🔎': 'zoom-check', '🚨': 'alert-octagon', '🔑': 'key', '🖥': 'devices', '📜': 'history',
};
const EMOJI_RE = new RegExp('(' + Object.keys(EMOJI_ICON).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\uFE0F?', 'g');
const SKIP_TAGS = new Set(['TEXTAREA', 'INPUT', 'OPTION', 'SELECT', 'SCRIPT', 'STYLE', 'svg', 'CODE', 'PRE']);

function iconize(root) {
  if (!root || root.nodeType !== 1) return;
  if (root.closest && root.closest('.docv, .bdoc, #printRoot, [data-noicon]')) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentElement;
      if (!p || SKIP_TAGS.has(p.tagName) || p.closest('.docv, .bdoc, #printRoot, [data-noicon], .tl-lines-msg')) return NodeFilter.FILTER_REJECT;
      EMOJI_RE.lastIndex = 0;
      return EMOJI_RE.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const span = document.createElement('span');
    span.innerHTML = esc(n.nodeValue).replace(EMOJI_RE, (m, e) => ic(EMOJI_ICON[e]));
    n.replaceWith(...span.childNodes);
  }
}
/* Iconize everything the app draws, as it is drawn */
(function watchIcons() {
  // runs before the browser paints, so screen symbols never flash
  new MutationObserver(muts => {
    const seen = new Set();
    for (const m of muts) for (const n of m.addedNodes) {
      const el = n.nodeType === 1 ? n : n.parentElement;
      if (el && !seen.has(el) && el.isConnected) { seen.add(el); iconize(el); }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => iconize(document.body));
})();

/* ---------- Theme: auto (follows the device) / light / dark — saved per device ---------- */
const Theme = {
  get() { try { return localStorage.getItem('gp_theme') || 'auto'; } catch (e) { return 'auto'; } },
  apply(t = Theme.get()) {
    const dark = t === 'dark' || (t === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#0b1220' : '#0f172a';
  },
  cycle() {
    const next = { auto: 'light', light: 'dark', dark: 'auto' }[Theme.get()];
    try { localStorage.setItem('gp_theme', next); } catch (e) { }
    Theme.apply(next); toast(`Theme: ${next === 'auto' ? 'follow device' : next}`); if (typeof renderNav === 'function') renderNav();
  },
};
Theme.apply();
if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => Theme.apply());
