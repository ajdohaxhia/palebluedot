import * as THREE from 'three';
import { EQ_TO_GAL } from '../astronomy/coordinates.js';

/**
 * All-sky background from NASA's Deep Star Maps 2020.
 *
 * The source map is a celestial equirectangular projection: centred at RA 0h,
 * RA increasing to the left, north celestial pole at the top.
 *
 * Each scene provides a rotation matrix that maps its local world direction
 * to equatorial J2000 coordinates.
 */
const vertexShader = /* glsl */`
  uniform vec3 uCameraPos;
  uniform mat3 uRotation;
  varying vec3 vDirEq;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 dir = normalize(world.xyz - uCameraPos);
    vDirEq = uRotation * dir;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform float uBrightness;
  uniform vec3 uTint;
  varying vec3 vDirEq;
  const float PI = 3.14159265359;
  void main() {
    vec3 d = normalize(vDirEq);
    float dec = asin(clamp(d.z, -1.0, 1.0));
    float ra = atan(d.y, d.x);
    float u = 0.5 - ra / (2.0 * PI);
    u = fract(u);
    float v = 0.5 + dec / PI;
    vec3 col = texture2D(uMap, vec2(u, v)).rgb;
    // Lift shadows so the Milky Way and nebulae read as a full sky, not flat black.
    col = pow(max(col, vec3(0.0)), vec3(0.85));
    col *= uTint * uBrightness;
    // Fade the exact poles slightly to reduce projection stretching.
    float polar = smoothstep(1.48, 1.5707, abs(dec));
    col *= 1.0 - polar * 0.18;
    gl_FragColor = vec4(col * uOpacity, 1.0);
  }
`;

export class SkyDome {
  constructor(texture, { rotation = new THREE.Matrix3(), brightness = 1.0, opacity = 1.0, tint = 0xffffff } = {}) {
    this.geometry = new THREE.SphereGeometry(1, 64, 32);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: texture },
        uOpacity: { value: opacity },
        uBrightness: { value: brightness },
        uTint: { value: new THREE.Color(tint) },
        uCameraPos: { value: new THREE.Vector3() },
        uRotation: { value: rotation.clone() },
      },
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.mesh.matrixAutoUpdate = false;
    this._scale = 1;
  }

  setRotation(m) {
    this.material.uniforms.uRotation.value.copy(m);
  }

  setOpacity(v) { this.material.uniforms.uOpacity.value = v; }
  setBrightness(v) { this.material.uniforms.uBrightness.value = v; }

  update(camera) {
    const far = camera.far || 1e6;
    const scale = Math.max(1, far * 0.42);
    this.mesh.scale.setScalar(scale);
    this.mesh.position.copy(camera.position);
    this.mesh.updateMatrix();
    this.mesh.updateMatrixWorld(true);
    this.material.uniforms.uCameraPos.value.copy(camera.position);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

/** Scene-specific directions -> equatorial J2000. */
export function earthSkyRotation() {
  // scene: X=RA0, Y=NCP, Z=RA90. equatorial: (x, -z, y)
  return new THREE.Matrix3().set(
    1, 0, 0,
    0, 0, -1,
    0, 1, 0,
  );
}

export function eclipticSkyRotation(obliquityRad) {
  // scene -> ecliptic: (x, -z, y); then ecliptic -> equatorial by +ε about X.
  const ce = Math.cos(obliquityRad), se = Math.sin(obliquityRad);
  // eq = Rx(eps) * ecl
  // eq.x = ecl.x; eq.y = ce*ecl.y - se*ecl.z; eq.z = se*ecl.y + ce*ecl.z
  // substitute ecl.x = sx, ecl.y = -sz, ecl.z = sy:
  // eq.x = sx
  // eq.y = ce*(-sz) - se*sy = -se*sy - ce*sz
  // eq.z = se*(-sz) + ce*sy = ce*sy - se*sz
  const m = new THREE.Matrix3().set(
    1, 0, 0,
    0, -se, -ce,
    0, ce, -se,
  );
  return m;
}

export function galacticSkyRotation() {
  // scene -> galactic: (x, -z, y); then galactic -> equatorial = R^T.
  const R = EQ_TO_GAL;
  const gx = [1, 0, 0];   // scene x = galactic x
  const gy = [0, 0, -1];  // scene z = -galactic y
  const gz = [0, 1, 0];   // scene y = galactic z
  const m = new THREE.Matrix3();
  const eq = (g) => [
    R[0][0] * g[0] + R[1][0] * g[1] + R[2][0] * g[2],
    R[0][1] * g[0] + R[1][1] * g[1] + R[2][1] * g[2],
    R[0][2] * g[0] + R[1][2] * g[1] + R[2][2] * g[2],
  ];
  const ex = eq(gx), ey = eq(gy), ez = eq(gz);
  // columns are the images of scene X, Y, Z
  m.set(
    ex[0], ey[0], ez[0],
    ex[1], ey[1], ez[1],
    ex[2], ey[2], ez[2],
  );
  return m;
}
