import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

// Screen-space ("fat") lines. Unlike THREE.Line, these keep a visible pixel width
// on every device and at every zoom level.
const materials = new Set();
// Multiplies every line width so orbit paths and grids stay readable on large and high-DPI screens.
const LINE_WIDTH_SCALE = 1.6;
let viewWidth = window.innerWidth || 1;
let viewHeight = window.innerHeight || 1;

export function setLineViewport(width, height) {
  viewWidth = Math.max(1, width);
  viewHeight = Math.max(1, height);
  for (const material of materials) material.resolution.set(viewWidth, viewHeight);
}

window.addEventListener('eon:resize', e => {
  const detail = e.detail;
  if (detail) setLineViewport(detail.width, detail.height);
}, { passive: true });

// Like createLine, but `points` holds pairs: points[0]-points[1] is one segment, points[2]-points[3] the next, etc.
export function createLineSegments(points, {
  color,
  opacity = 1,
  width = 1.5,
  blending = THREE.NormalBlending,
} = {}) {
  const flat = [];
  for (const p of points) flat.push(p.x, p.y, p.z);

  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(flat);

  const material = new LineMaterial({
    color: new THREE.Color(color),
    linewidth: width * LINE_WIDTH_SCALE,
    transparent: true,
    opacity,
    depthWrite: false,
    blending,
  });
  material.resolution.set(viewWidth, viewHeight);
  materials.add(material);

  return new LineSegments2(geometry, material);
}

export function createLine(points, {
  color,
  opacity = 1,
  width = 1.5,
  loop = false,
  blending = THREE.NormalBlending,
} = {}) {
  const flat = [];
  for (const p of points) flat.push(p.x, p.y, p.z);
  if (loop && points.length > 0) flat.push(points[0].x, points[0].y, points[0].z);

  const geometry = new LineGeometry();
  geometry.setPositions(flat);

  const material = new LineMaterial({
    color: new THREE.Color(color),
    linewidth: width * LINE_WIDTH_SCALE,
    transparent: true,
    opacity,
    depthWrite: false,
    blending,
  });
  material.resolution.set(viewWidth, viewHeight);
  materials.add(material);

  return new Line2(geometry, material);
}
