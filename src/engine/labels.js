import * as THREE from 'three';

/**
 * Screen-space object labels with priority collision culling.
 * All labels are real DOM buttons, keyboard-accessible through the object list.
 */
export class LabelLayer {
  constructor(container, { className = '', collisions = true } = {}) {
    this.container = container;
    this.root = document.createElement('div');
    this.root.className = `label-root ${className}`;
    container.appendChild(this.root);
    this.items = [];
    this.byId = new Map();
    this.visible = true;
    this.collisions = collisions;
    this._lastCollide = 0;
    this._tmp = new THREE.Vector3();
    this._selectedId = null;
    this._screenW = 1;
    this._screenH = 1;
    this._hidden = new Set();
  }

  setItems(items) {
    for (const item of this.items) item.el.remove();
    this.items = [];
    this.byId.clear();
    this._hidden.clear();
    for (const item of items) this.addItem(item);
    this._lastCollide = 0;
  }

  addItem(item) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `sky-label ${item.className || ''}`;
    el.setAttribute('aria-label', item.ariaLabel || `Select ${item.name}`);
    const dot = document.createElement('span');
    dot.className = 'sky-label-dot';
    const text = document.createElement('span');
    text.className = 'sky-label-name';
    text.textContent = item.name;
    el.appendChild(dot);
    el.appendChild(text);
    if (item.sub) {
      const sub = document.createElement('span');
      sub.className = 'sky-label-sub';
      sub.textContent = item.sub;
      el.appendChild(sub);
    }
    if (item.onClick) {
      el.addEventListener('click', ev => {
        ev.stopPropagation();
        item.onClick(item);
      });
      el.addEventListener('pointerdown', ev => ev.stopPropagation());
    }
    this.root.appendChild(el);
    const measuredName = item.name || '';
    const estWidth = Math.min(280, 36 + measuredName.length * 6.7 + (item.sub ? item.sub.length * 5 + 10 : 0));
    const entry = {
      ...item,
      el,
      estWidth,
      estHeight: 24,
      _screen: { x: 0, y: 0, visible: false },
    };
    this.items.push(entry);
    this.byId.set(item.id, entry);
    return entry;
  }

  removeItem(id) {
    const i = this.items.findIndex(x => x.id === id);
    if (i >= 0) {
      this.items[i].el.remove();
      this.items.splice(i, 1);
      this.byId.delete(id);
    }
  }

  setVisible(v) {
    this.visible = !!v;
    this.root.style.display = this.visible ? '' : 'none';
  }

  setSelected(id) {
    this._selectedId = id;
    for (const item of this.items) item.el.classList.toggle('is-selected', item.id === id);
  }

  setScreenSize(w, h) { this._screenW = w; this._screenH = h; }

  update(camera, w, h, now = performance.now()) {
    if (!this.visible) return;
    this._screenW = w; this._screenH = h;
    const doCollide = now - this._lastCollide > 90;
    if (doCollide) { this._lastCollide = now; this._hidden.clear(); }
    const occupied = [];
    const sorted = [...this.items];
    const candidates = [];
    camera.updateMatrixWorld(false);
    for (const item of sorted) {
      let pos = typeof item.getPosition === 'function' ? item.getPosition() : item.position;
      if (!pos) { item.el.style.display = 'none'; continue; }
      if (item.shouldShow && !item.shouldShow()) {
        item.el.style.display = 'none';
        continue;
      }
      this._tmp.set(pos.x, pos.y, pos.z).project(camera);
      const behind = this._tmp.z < -1 || this._tmp.z > 1;
      const x = (this._tmp.x * 0.5 + 0.5) * w;
      const y = (-this._tmp.y * 0.5 + 0.5) * h;
      const topSafe = w < 900 ? 72 : 104;
      const bottomSafe = w < 900 ? 98 : 82;
      const leftSafe = w < 900 ? 12 : 208;
      if (behind || x < leftSafe || x > w - 10 || y < topSafe || y > h - bottomSafe) {
        item.el.style.display = 'none';
        continue;
      }
      item._screen.x = x;
      item._screen.y = y;
      item.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      if (doCollide) candidates.push(item);
      else item.el.style.display = this._hidden.has(item.id) ? 'none' : '';
    }
    if (doCollide) {
      candidates.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      for (const item of candidates) {
        const width = item.estWidth;
        const height = item.estHeight;
        const x = item._screen.x;
        const y = item._screen.y;
        const rect = { l: x - width / 2 - 4, r: x + width / 2 + 4, t: y - height / 2, b: y + height / 2 };
        let collides = false;
        for (const o of occupied) {
          if (rect.l < o.r && rect.r > o.l && rect.t < o.b && rect.b > o.t) { collides = true; break; }
        }
        if (collides && !this.byId.get(item.id)?.el.classList.contains('is-selected')) {
          this._hidden.add(item.id);
          item.el.style.display = 'none';
        } else {
          occupied.push(rect);
          this._hidden.delete(item.id);
          item.el.style.display = '';
        }
      }
    }
  }

  dispose() {
    this.root.remove();
    this.items = [];
    this.byId.clear();
  }
}
