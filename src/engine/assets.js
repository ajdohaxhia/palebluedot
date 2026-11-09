import * as THREE from 'three';

/** Lightweight asset store with caching and progress. */
export class AssetStore {
  constructor({ base = './', onProgress = null } = {}) {
    this.base = base;
    this.onProgress = onProgress;
    this.textures = new Map();
    this.pending = new Map();
    this.manager = new THREE.LoadingManager();
    this.manager.onProgress = (url, loaded, total) => {
      this.onProgress?.({ url, loaded, total });
    };
    this.texLoader = new THREE.TextureLoader(this.manager);
    this.maxAnisotropy = 8;
  }

  setRenderer(renderer) {
    this.maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }

  url(path) {
    return path.startsWith('http') || path.startsWith('/') ? path : `${this.base}${path}`;
  }

  texture(path, { srgb = true, anisotropy = true } = {}) {
    const key = path;
    if (this.textures.has(key)) return this.textures.get(key);
    if (this.pending.has(key)) return this.pending.get(key);
    const p = new Promise((resolve, reject) => {
      this.texLoader.load(this.url(path), tex => {
        tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        if (anisotropy) tex.anisotropy = this.maxAnisotropy;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        this.textures.set(key, tex);
        this.pending.delete(key);
        resolve(tex);
      }, undefined, err => {
        this.pending.delete(key);
        console.warn(`[EON] texture failed: ${path}`, err);
        reject(new Error(`Texture unavailable: ${path}`));
      });
    });
    this.pending.set(key, p);
    return p;
  }

  async json(path) {
    const r = await fetch(this.url(path));
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    return r.json();
  }

  async buffer(path) {
    const r = await fetch(this.url(path));
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    return r.arrayBuffer();
  }
}
