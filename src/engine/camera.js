import * as THREE from 'three';

const { clamp, lerp } = THREE.MathUtils;
const TAU = Math.PI * 2;

/** Smooth damped exponential interpolation, frame-rate independent. */
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Orbit / fly camera rig.
 * The camera always looks at `focus`; orbit distance and angles are damped.
 * In free-flight mode, WASD/QE translate the focus relative to the view.
 */
export class OrbitRig {
  constructor(camera, {
    distance = 3,
    minDistance = 1.05,
    maxDistance = 120,
    yaw = 0.8,
    pitch = 0.18,
    minPitch = -1.48,
    maxPitch = 1.48,
    damping = 9,
    zoomDamping = 9,
    rotateSpeed = 1,
    zoomSpeed = 0.85,
    near = 0.01,
    far = 1e7,
    onPick = null,
    onHover = null,
    domElement = null,
  } = {}) {
    this.camera = camera;
    this.domElement = domElement;
    this.distance = distance;
    this.targetDistance = distance;
    this.minDistance = minDistance;
    this.maxDistance = maxDistance;
    this.zoomDamping = zoomDamping;
    this.minPitch = minPitch;
    this.maxPitch = maxPitch;
    this.rotateSpeed = rotateSpeed;
    this.zoomSpeed = zoomSpeed;
    this.damping = damping;
    this.focus = new THREE.Vector3();
    this.targetFocus = new THREE.Vector3();
    this.yaw = yaw;
    this.pitch = pitch;
    this.targetYaw = yaw;
    this.targetPitch = pitch;
    this.autoRotate = false;
    this.autoRotateSpeed = 0.034;
    this.freeFlight = false;
    this.freeZoom = false;
    this.follow = null;
    this.onPick = onPick;
    this.onHover = onHover;
    this.enabled = true;
    this.keys = new Set();
    this.moveSpeed = 1;
    this._dragging = false;
    this._dragButton = -1;
    this._pointerId = null;
    this._down = { x: 0, y: 0, t: 0 };
    this._last = { x: 0, y: 0 };
    this._pinch = null;
    this._tweens = [];
    this._pickMoved = false;
    this._hoverTimer = 0;
    this._lastInteraction = performance.now();
    this._bound = {};
    this.setDistance(this.distance);
    this._attach();
    this.camera.near = near;
    this.camera.far = far;
    this.apply(1, true);
  }

  setLimits(minDistance, maxDistance, minPitch = this.minPitch, maxPitch = this.maxPitch) {
    // Free atlas: no scale limit, so the wheel can reach any distance.
    if (this.freeZoom) {
      minDistance = 1e-12;
      maxDistance = 1e12;
    }
    this.minDistance = minDistance;
    this.maxDistance = maxDistance;
    this.minPitch = minPitch;
    this.maxPitch = maxPitch;
    this.targetDistance = clamp(this.targetDistance, minDistance, maxDistance);
    this.distance = clamp(this.distance, minDistance, maxDistance);
  }

  setDistance(distance) {
    this.distance = clamp(distance, this.minDistance, this.maxDistance);
    this.targetDistance = this.distance;
  }

  setTargetFocus(pos, immediate = false) {
    this.targetFocus.copy(pos);
    if (immediate) this.focus.copy(pos);
  }

  setAngles(yaw, pitch, immediate = false) {
    this.targetYaw = yaw;
    this.targetPitch = clamp(pitch, this.minPitch, this.maxPitch);
    if (immediate) { this.yaw = yaw; this.pitch = this.targetPitch; }
  }

  /** Animate the camera to a new target distance and focus. */
  focusOn(position, distance, {
    duration = 1.6,
    yaw = null, pitch = null, immediate = false, distanceImmediate = false,
  } = {}) {
    if (!position) return;
    const target = new THREE.Vector3(position.x, position.y, position.z);
    if (immediate || duration <= 0) {
      this.setTargetFocus(target, true);
      this.targetDistance = clamp(distance, this.minDistance, this.maxDistance);
      this.distance = this.targetDistance;
      if (yaw !== null) this.setAngles(yaw, pitch ?? this.pitch, true);
      this._tweens = [];
      return;
    }
    this._tweens = this._tweens.filter(t => t.type !== 'focus');
    this._tweens.push({
      type: 'focus',
      t: 0,
      duration,
      fromFocus: this.targetFocus.clone(),
      toFocus: target,
      fromDistance: this.targetDistance,
      toDistance: clamp(distance, this.minDistance, this.maxDistance),
      fromLogDistance: Math.log(Math.max(1e-15, this.targetDistance)),
      toLogDistance: Math.log(Math.max(1e-15, clamp(distance, this.minDistance, this.maxDistance))),
      fromYaw: this.targetYaw,
      toYaw: yaw ?? this.targetYaw,
      fromPitch: this.targetPitch,
      toPitch: pitch ?? this.targetPitch,
      distanceImmediate,
    });
  }

  resetView(position, distance, yaw = this.yaw, pitch = this.pitch) {
    this.focusOn(position, distance, { duration: 1.2, yaw, pitch });
  }

  _attach() {
    if (!this.domElement) return;
    const el = this.domElement;
    this._bound.pointerdown = e => this._onPointerDown(e);
    this._bound.pointermove = e => this._onPointerMove(e);
    this._bound.pointerup = e => this._onPointerUp(e);
    this._bound.wheel = e => this._onWheel(e);
    this._bound.dblclick = e => this._onDblClick(e);
    this._bound.leave = () => { this._hoverTimer = 0; if (!this._dragging) this.onHover?.(null); };
    this._bound.keydown = e => this._onKeyDown(e);
    this._bound.keyup = e => this._onKeyUp(e);
    el.addEventListener('pointerdown', this._bound.pointerdown);
    el.addEventListener('pointermove', this._bound.pointermove);
    el.addEventListener('pointerup', this._bound.pointerup);
    el.addEventListener('pointercancel', this._bound.pointerup);
    el.addEventListener('pointerleave', this._bound.leave);
    el.addEventListener('wheel', this._bound.wheel, { passive: false });
    el.addEventListener('dblclick', this._bound.dblclick);
    window.addEventListener('keydown', this._bound.keydown);
    window.addEventListener('keyup', this._bound.keyup);
  }

  dispose() {
    const el = this.domElement;
    if (!el) return;
    el.removeEventListener('pointerdown', this._bound.pointerdown);
    el.removeEventListener('pointermove', this._bound.pointermove);
    el.removeEventListener('pointerup', this._bound.pointerup);
    el.removeEventListener('pointercancel', this._bound.pointerup);
    el.removeEventListener('pointerleave', this._bound.leave);
    el.removeEventListener('wheel', this._bound.wheel);
    el.removeEventListener('dblclick', this._bound.dblclick);
    window.removeEventListener('keydown', this._bound.keydown);
    window.removeEventListener('keyup', this._bound.keyup);
  }

  _typingTarget(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  }

  _onKeyDown(e) {
    if (!this.enabled || this._typingTarget(e)) return;
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'q', 'e'].includes(k)) {
      this.keys.add(k);
      this._lastInteraction = performance.now();
      if (this.freeFlight) e.preventDefault();
    }
    if (k === 'shift') this.keys.add('shift');
  }

  _onKeyUp(e) {
    const k = e.key.toLowerCase();
    this.keys.delete(k);
    if (k === 'shift') this.keys.delete('shift');
  }

  _onPointerDown(e) {
    if (!this.enabled) return;
    if (e.button !== 0 && e.button !== 2) return;
    if (e.pointerType === 'touch') this._touchCount = (this._touchCount || 0) + 1;
    if (e.pointerType === 'touch' && this._dragging && e.pointerId !== this._pointerId) {
      // A second finger landed: stop single-finger orbit so TouchEnhancer can pinch without fighting it.
      this._dragging = false;
      this._pointerId = null;
      this.domElement.style.cursor = 'grab';
      return;
    }
    this._dragging = true;
    this._dragButton = e.button;
    this._pointerId = e.pointerId;
    this._down = { x: e.clientX, y: e.clientY, t: performance.now() };
    this._last = { x: e.clientX, y: e.clientY };
    this._pickMoved = false;
    this._lastInteraction = performance.now();
    this.domElement.setPointerCapture?.(e.pointerId);
    this.domElement.style.cursor = 'grabbing';
  }

  _onPointerMove(e) {
    if (!this.enabled) return;
    if (e.pointerType === 'touch' && this._pinch) {
      // handled by app-level touch logic if provided
    }
    if (!this._dragging) {
      this._hoverTimer = (this._hoverTimer || 0) + 1;
      if (this._hoverTimer % 3 === 0) this.onHover?.({ x: e.clientX, y: e.clientY });
      return;
    }
    const dx = e.clientX - this._last.x;
    const dy = e.clientY - this._last.y;
    this._last = { x: e.clientX, y: e.clientY };
    const moved = Math.hypot(e.clientX - this._down.x, e.clientY - this._down.y);
    if (moved > 3) this._pickMoved = true;
    if (this.freeFlight) {
      // Look around without orbiting a target.
      this.targetYaw -= dx * 0.0032 * this.rotateSpeed;
      this.targetPitch = clamp(this.targetPitch - dy * 0.0028 * this.rotateSpeed, this.minPitch, this.maxPitch);
      this.yaw = this.targetYaw;
      this.pitch = this.targetPitch;
    } else {
      this.targetYaw -= dx * 0.0044 * this.rotateSpeed;
      this.targetPitch = clamp(this.targetPitch - dy * 0.0038 * this.rotateSpeed, this.minPitch, this.maxPitch);
    }
    this._lastInteraction = performance.now();
    this.autoRotate = false;
  }

  _onPointerUp(e) {
    if (e.pointerType === 'touch') this._touchCount = Math.max(0, (this._touchCount || 0) - 1);
    if (!this._dragging) return;
    const wasTap = !this._pickMoved && performance.now() - this._down.t < 450;
    this._dragging = false;
    this._pointerId = null;
    this.domElement.style.cursor = 'grab';
    if (wasTap) this.onPick?.({ x: e.clientX, y: e.clientY, button: this._dragButton });
  }

  _onDblClick(e) {
    if (!this.enabled) return;
    this.onDoubleClick?.({ x: e.clientX, y: e.clientY });
  }

  _onWheel(e) {
    if (!this.enabled) return;
    e.preventDefault();
    const delta = Math.sign(e.deltaY) * Math.min(1.2, Math.abs(e.deltaY) * 0.0016);
    this.zoomBy(delta);
    this._lastInteraction = performance.now();
  }

  zoomBy(delta) {
    if (this.freeFlight) {
      this.distance = clamp(this.distance * Math.exp(delta * 0.9 * this.zoomSpeed), this.minDistance, this.maxDistance);
      this.targetDistance = this.distance;
      return;
    }
    // Sustained scrolling against a zoom limit asks the app to hand off to the next scale.
    const atMax = this.targetDistance >= this.maxDistance * 0.995;
    const atMin = this.targetDistance <= this.minDistance * 1.005;
    if ((delta > 0 && atMax) || (delta < 0 && atMin)) {
      this._pushLimit(delta > 0 ? 'out' : 'in', Math.abs(delta));
      return;
    }
    this._limitPush = 0;
    const log = Math.log(this.targetDistance);
    const next = clamp(Math.exp(log + delta * this.zoomSpeed), this.minDistance, this.maxDistance);
    this.targetDistance = next;
  }

  _pushLimit(dir, amount) {
    if (this.noHandoff) return;
    const now = performance.now();
    if (now - (this._limitStamp || 0) > 700 || dir !== this._limitDir) this._limitPush = 0;
    this._limitStamp = now;
    this._limitDir = dir;
    if (now < (this._limitLock || 0)) return;
    this._limitPush = (this._limitPush || 0) + amount;
    if (this._limitPush >= 0.9) {
      this._limitPush = 0;
      this._limitLock = now + 2500;
      window.dispatchEvent(new CustomEvent('cosmos:zoomlimit', { detail: { dir, rig: this } }));
    }
  }

  setAutoRotate(v) { this.autoRotate = v; }
  setFreeFlight(v) {
    this.freeFlight = !!v;
    if (!v) this.targetFocus.copy(this.focus);
  }

  followPosition(getter) {
    this.follow = getter;
  }

  moveFocus(dt) {
    if (!this.freeFlight || !this.keys.size) return;
    const speed = (this.keys.has('shift') ? 4 : 1) * this.distance * 0.65 * this.moveSpeed;
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const delta = new THREE.Vector3();
    if (this.keys.has('w')) delta.addScaledVector(forward, 1);
    if (this.keys.has('s')) delta.addScaledVector(forward, -1);
    if (this.keys.has('d')) delta.addScaledVector(right, 1);
    if (this.keys.has('a')) delta.addScaledVector(right, -1);
    if (this.keys.has('e')) delta.addScaledVector(up, 1);
    if (this.keys.has('q')) delta.addScaledVector(up, -1);
    if (delta.lengthSq() > 0) {
      delta.normalize().multiplyScalar(speed * dt);
      this.focus.add(delta);
      this.targetFocus.copy(this.focus);
      this.follow = null;
    }
  }

  update(dt) {
    if (this.follow) {
      const p = this.follow();
      if (p) this.targetFocus.set(p.x, p.y, p.z);
    }
    // Tween focus/distance
    if (this._tweens.length) {
      for (const tw of this._tweens) {
        tw.t += dt;
        const raw = clamp(tw.t / tw.duration, 0, 1);
        const e = easeInOutCubic(raw);
        this.targetFocus.lerpVectors(tw.fromFocus, tw.toFocus, e);
        this.targetDistance = Math.exp(lerp(tw.fromLogDistance, tw.toLogDistance, e));
        this.targetYaw = lerp(tw.fromYaw, tw.toYaw, e);
        this.targetPitch = lerp(tw.fromPitch, tw.toPitch, e);
        if (tw.distanceImmediate) this.distance = this.targetDistance;
      }
      this._tweens = this._tweens.filter(tw => tw.t < tw.duration);
    }

    if (this.autoRotate && !this._dragging) {
      this.targetYaw += this.autoRotateSpeed * dt;
    }

    this.moveFocus(dt);

    this.yaw = damp(this.yaw, this.targetYaw, this.damping, dt);
    this.pitch = damp(this.pitch, this.targetPitch, this.damping, dt);
    const logDist = Math.log(Math.max(1e-12, this.distance));
    const logTarget = Math.log(Math.max(1e-12, this.targetDistance));
    this.distance = Math.exp(damp(logDist, logTarget, this.zoomDamping, dt));

    if (this.focus.distanceToSquared(this.targetFocus) > 1e-30) {
      this.focus.x = damp(this.focus.x, this.targetFocus.x, this.damping * 0.9, dt);
      this.focus.y = damp(this.focus.y, this.targetFocus.y, this.damping * 0.9, dt);
      this.focus.z = damp(this.focus.z, this.targetFocus.z, this.damping * 0.9, dt);
    }

    this.apply(dt, false);
  }

  apply(dt, immediate) {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const dir = new THREE.Vector3(cp * sy, sp, cp * cy);
    // Free flight keeps the camera position fixed and rotates the look direction;
    // orbit places the camera on a sphere around the focus.
    const pos = this.focus.clone().addScaledVector(dir, this.distance);
    this.camera.position.copy(pos);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.focus);
    if (immediate) this.camera.updateMatrixWorld(true);
  }

  /** Project a world point to screen coordinates. */
  projectToScreen(world, width = window.innerWidth, height = window.innerHeight) {
    const v = world.clone().project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * width,
      y: (-v.y * 0.5 + 0.5) * height,
      z: v.z,
      visible: v.z > -1 && v.z < 1,
    };
  }
}

/**
 * Adds touch pinch support on top of a rig. The rig itself handles single touch orbit.
 * `pinchScale` changes the orbit distance; two-finger drag pans the focus.
 */
export class TouchEnhancer {
  constructor(rig, element) {
    this.rig = rig;
    this.el = element;
    this.pointers = new Map();
    this.lastDist = 0;
    this.lastCenter = null;
    this._down = e => this.onDown(e);
    this._move = e => this.onMove(e);
    this._up = e => this.onUp(e);
    this.el.addEventListener('pointerdown', this._down);
    this.el.addEventListener('pointermove', this._move);
    this.el.addEventListener('pointerup', this._up);
    this.el.addEventListener('pointercancel', this._up);
  }
  onDown(e) {
    if (e.pointerType !== 'touch') return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.lastDist = Math.hypot(a.x - b.x, a.y - b.y);
      this.lastCenter = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  }
  onMove(e) {
    if (e.pointerType !== 'touch' || !this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.lastDist > 0) {
        const ratio = dist / this.lastDist;
        const rig = this.rig;
        const next = rig.targetDistance / ratio;
        // Pinching against a zoom limit hands off to the neighbouring scale, like the scroll wheel does.
        const pushAmount = Math.abs(Math.log(ratio)) * 12;
        if (next >= rig.maxDistance * 0.995) rig._pushLimit('out', pushAmount);
        else if (next <= rig.minDistance * 1.005) rig._pushLimit('in', pushAmount);
        rig.targetDistance = clamp(next, rig.minDistance, rig.maxDistance);
      }
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      if (this.lastCenter) {
        const rig = this.rig;
        const dx = cx - this.lastCenter.x;
        const dy = cy - this.lastCenter.y;
        rig.targetYaw -= dx * 0.0044 * rig.rotateSpeed;
        rig.targetPitch = clamp(rig.targetPitch - dy * 0.0038 * rig.rotateSpeed, rig.minPitch, rig.maxPitch);
        rig.autoRotate = false;
        rig._lastInteraction = performance.now();
      }
      this.lastCenter = { x: cx, y: cy };
      this.lastDist = dist;
    }
  }
  onUp(e) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) { this.lastDist = 0; this.lastCenter = null; }
  }
}
