import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uExposure: { value: 1.0 },
    uVignette: { value: 0.34 },
    uGrain: { value: 0.009 },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uExposure;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uTime;
    uniform vec2 uResolution;
    varying vec2 vUv;

    // ACES filmic tone curve (Narkowicz)
    vec3 aces(vec3 x) {
      const float a = 2.51;
      const float b = 0.03;
      const float c = 2.43;
      const float d = 0.59;
      const float e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec3 color = texture2D(tDiffuse, vUv).rgb;
      color *= uExposure;
      color = aces(color);

      // very subtle radial vignette
      vec2 p = vUv - 0.5;
      float vignette = smoothstep(0.86, 0.18, length(p));
      color *= mix(1.0, vignette, uVignette);

      // fine grain to prevent banding and add a filmic texture
      float n = hash(vUv * uResolution + fract(uTime) * 41.0) - 0.5;
      color += n * uGrain;

      // linear -> sRGB
      color = max(color, vec3(0.0));
      color = mix(color * 12.92, 1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, color));
      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export const QUALITY_PRESETS = {
  low:      { name: 'Low',      pixelRatio: 1.0, bloom: false, bloomStrength: 0.0,  starDetail: 0.55, shadows: false },
  balanced: { name: 'Balanced', pixelRatio: 1.25, bloom: true, bloomStrength: 0.36, starDetail: 0.8,  shadows: false },
  high:     { name: 'High',     pixelRatio: 1.6, bloom: true, bloomStrength: 0.5,  starDetail: 1.0,  shadows: true },
  ultra:    { name: 'Ultra',    pixelRatio: 2.0, bloom: true, bloomStrength: 0.6,  starDetail: 1.15, shadows: true },
};

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.qualityName = 'auto';
    this.autoQuality = true;
    this.currentPreset = { ...QUALITY_PRESETS.high };
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.6);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true,
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setClearColor(0x03050a, 1);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.autoClear = true;

    this.composer = new EffectComposer(this.renderer);
    // WebGL2 multisampled composer target for smooth planetary limbs.
    try {
      this.composer.renderTarget1.samples = 4;
      this.composer.renderTarget2.samples = 4;
    } catch (e) { /* older drivers */ }

    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.55, 0.84);
    this.finalPass = new ShaderPass(FinalShader);
    this.finalPass.uniforms.uExposure.value = 1.0;
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.finalPass);

    this.clock = new THREE.Clock();
    this.width = 1; this.height = 1;
    this.frameCount = 0;
    this.fps = 60;
    this.fpsAccum = 0;
    this.fpsFrames = 0;
    this.fpsWindow = 0;
    this.onFps = null;
    this.lowStreak = 0;
    this.highStreak = 0;
    this._qualityCooldown = 0;
    this._lastTime = performance.now();
    this.time = 0;
    this._resize = this.resize.bind(this);
    window.addEventListener('resize', this._resize, { passive: true });
    this.resize();
    this.renderer.domElement.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('eon:webgl-lost'));
    });
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      window.dispatchEvent(new CustomEvent('eon:webgl-restored'));
    });
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.width = w; this.height = h;
    const dpr = this.effectivePixelRatio();
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.bloomPass.setSize(w, h);
    this.finalPass.uniforms.uResolution.value.set(w * dpr, h * dpr);
    window.dispatchEvent(new CustomEvent('eon:resize', { detail: { width: w, height: h, dpr } }));
  }

  effectivePixelRatio() {
    const cap = this.currentPreset.pixelRatio;
    return Math.min(window.devicePixelRatio || 1, cap) * (this.dynamicScale || 1);
  }

  setScene(scene, camera) {
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
  }

  setBloom(strength, radius = 0.55, threshold = 0.84) {
    this.bloomPass.enabled = strength > 0;
    this.bloomPass.strength = strength;
    this.bloomPass.radius = radius;
    this.bloomPass.threshold = threshold;
  }

  setExposure(e) {
    this.finalPass.uniforms.uExposure.value = e;
  }

  setQuality(name) {
    this.qualityName = name;
    this.autoQuality = name === 'auto';
    if (name === 'auto') {
      this.currentPreset = { ...QUALITY_PRESETS.high };
      this.dynamicScale = 1;
      this._qualityCooldown = 2;
    } else {
      this.currentPreset = { ...QUALITY_PRESETS[name] };
      this.dynamicScale = 1;
    }
    this.applyQuality();
  }

  applyQuality() {
    const p = this.currentPreset;
    this.setBloom(p.bloom ? p.bloomStrength : 0);
    const dpr = this.effectivePixelRatio();
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.finalPass.uniforms.uResolution.value.set(window.innerWidth * dpr, window.innerHeight * dpr);
    window.dispatchEvent(new CustomEvent('eon:quality', { detail: { name: this.qualityName, preset: p } }));
  }

  render(scene, camera, dt) {
    this.time += dt;
    this.finalPass.uniforms.uTime.value = this.time;
    this.setScene(scene, camera);
    this.composer.render(dt);
    this._updateFps(dt);
  }

  _updateFps(dt) {
    const now = performance.now();
    const realDt = this._lastFpsTimestamp ? Math.max(0.0001, Math.min(1.0, (now - this._lastFpsTimestamp) / 1000)) : Math.max(0.0001, dt);
    this._lastFpsTimestamp = now;
    this.fpsAccum += realDt;
    this.fpsFrames++;
    this.fpsWindow += realDt;
    this.frameCount++;
    if (this.fpsWindow >= 0.5) {
      this.fps = this.fpsFrames / this.fpsWindow;
      this.onFps?.(this.fps);
      if (this.autoQuality && this._qualityCooldown <= 0) {
        if (this.fps < 40) {
          this.lowStreak++; this.highStreak = 0;
          if (this.lowStreak >= 4) {
            this.dynamicScale = Math.max(0.62, (this.dynamicScale || 1) * 0.82);
            this.applyQuality();
            this.lowStreak = 0;
            this._qualityCooldown = 4;
          }
        } else if (this.fps > 57) {
          this.highStreak++; this.lowStreak = 0;
          if (this.highStreak >= 8) {
            this.dynamicScale = Math.min(1, (this.dynamicScale || 1) * 1.06);
            this.applyQuality();
            this.highStreak = 0;
            this._qualityCooldown = 5;
          }
        } else {
          this.lowStreak = 0; this.highStreak = 0;
        }
      } else {
        this._qualityCooldown -= this.fpsWindow;
      }
      this.fpsFrames = 0;
      this.fpsWindow = 0;
    }
  }
}
