const ACTION_META = {
  focus: { label: 'Focus', icon: 'i-focus', primary: true },
  follow: { label: 'Follow', icon: 'i-follow' },
  orbit: { label: 'Show orbit', icon: 'i-orbit' },
  system: { label: 'Open system', icon: 'i-orbit', primary: true },
  compare: { label: 'Compare', icon: 'i-compare' },
  source: { label: 'Source', icon: 'i-external' },
  return: { label: 'Return to atlas', icon: 'i-arrow-left' },
};

export class Inspector {
  constructor(root, { onAction, onPlanetSelect, onClose } = {}) {
    this.root = root;
    this.onAction = onAction || (() => {});
    this.onPlanetSelect = onPlanetSelect || (() => {});
    this.onClose = onClose || (() => {});
    this.el = {
      kicker: root.querySelector('#inspector-kicker'),
      name: root.querySelector('#object-name'),
      subtitle: root.querySelector('#object-subtitle'),
      description: root.querySelector('#object-description'),
      preview: root.querySelector('#object-preview'),
      facts: root.querySelector('#object-facts'),
      atmosphereWrap: root.querySelector('#object-atmosphere-wrap'),
      atmosphere: root.querySelector('#object-atmosphere'),
      systemWrap: root.querySelector('#object-system-wrap'),
      system: root.querySelector('#object-system'),
      actions: root.querySelector('#object-actions'),
      provenance: root.querySelector('#object-provenance'),
      vizNote: root.querySelector('#object-viz-note'),
      scroll: root.querySelector('#inspector-scroll'),
      close: root.querySelector('#inspector-close'),
    };
    this.current = null;
    this.el.close.addEventListener('click', () => this.close());
    this.isOpen = false;
  }

  open(display) {
    if (!display) return;
    this.current = display;
    const e = this.el;
    e.kicker.textContent = display.kicker || display.kind || 'Object';
    e.name.textContent = display.name || 'Unknown';
    e.subtitle.textContent = display.subtitle || '';
    e.description.textContent = display.description || '';
    e.description.style.display = display.description ? '' : 'none';

    e.vizNote.hidden = !display.vizNote;
    e.vizNote.textContent = display.vizNote || '';

    const preview = display.preview || {};
    e.preview.className = 'object-preview ' + (preview.className || '');
    e.preview.setAttribute('style', preview.style || '');

    e.facts.innerHTML = '';
    for (const fact of display.facts || []) {
      const div = document.createElement('div');
      div.className = 'fact';
      const l = document.createElement('span');
      l.className = 'fact-label';
      l.textContent = fact.label;
      const v = document.createElement('span');
      v.className = 'fact-value';
      v.textContent = fact.value ?? 'Unavailable';
      div.append(l, v);
      e.facts.appendChild(div);
    }

    const atmos = display.atmosphere || [];
    e.atmosphereWrap.hidden = atmos.length === 0;
    e.atmosphere.innerHTML = '';
    for (const a of atmos) {
      const c = document.createElement('span');
      c.className = 'chip';
      c.textContent = a;
      e.atmosphere.appendChild(c);
    }

    const sys = display.system;
    e.systemWrap.hidden = !sys || !sys.planets || sys.planets.length === 0;
    e.system.innerHTML = '';
    if (sys?.planets?.length) {
      for (const p of sys.planets) {
        const row = document.createElement('div');
        row.className = 'planet-row';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = p.name;
        btn.addEventListener('click', () => this.onPlanetSelect(p, sys));
        const small = document.createElement('small');
        small.textContent = Number.isFinite(p.smaAU)
          ? `${p.smaAU.toFixed(3)} AU · ${Number.isFinite(p.periodDays) ? p.periodDays.toFixed(1) : '—'} d`
          : p.periodDays ? `${p.periodDays.toFixed(1)} d` : 'Orbit unavailable';
        row.append(btn, small);
        e.system.appendChild(row);
      }
    }

    e.actions.innerHTML = '';
    const actions = display.actions || ['focus', 'source'];
    for (const action of actions) {
      if (action === 'source' && !display.provenance?.url) continue;
      const meta = ACTION_META[action];
      if (!meta) continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'action-button' + (meta.primary ? ' primary' : '');
      b.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#${meta.icon}"/></svg><span>${meta.label}</span>`;
      if (action === 'source') {
        b.addEventListener('click', () => {
          const url = display.provenance?.url;
          if (url) window.open(url, '_blank', 'noopener');
        });
      } else {
        b.addEventListener('click', () => this.onAction(action, display));
      }
      e.actions.appendChild(b);
    }

    e.provenance.innerHTML = '';
    if (display.provenance) {
      const p = display.provenance;
      const parts = [];
      if (p.source) parts.push(`<span class="source-name">${escapeHtml(p.source)}</span>`);
      if (p.retrieved) parts.push(`Retrieved ${escapeHtml(p.retrieved)}.`);
      if (p.model) parts.push(escapeHtml(p.model));
      const text = document.createElement('div');
      text.innerHTML = parts.join(' ');
      e.provenance.appendChild(text);
      if (p.url) {
        const a = document.createElement('a');
        a.href = p.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = prettyHost(p.url);
        e.provenance.appendChild(a);
      }
    }

    e.scroll.scrollTop = 0;
    this.root.classList.add('is-open');
    this.root.setAttribute('aria-hidden', 'false');
    this.isOpen = true;
  }

  close() {
    this.root.classList.remove('is-open');
    this.root.setAttribute('aria-hidden', 'true');
    this.isOpen = false;
    this.current = null;
    this.onClose();
  }

  refreshOpen(display) {
    if (this.isOpen) this.open(display);
  }

  toggle(display) {
    if (this.current?.id === display?.id) this.close();
    else this.open(display);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function prettyHost(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}
