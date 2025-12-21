/**
 * resourceManager.js
 * Centralized Three.js resource management and disposal
 * Prevents memory leaks from unreleased geometries, materials, and textures
 */

// ============================================================================
// RESOURCE TRACKING
// ============================================================================

class ResourceManager {
  constructor() {
    // Track resources by type
    this.resources = {
      geometries: new Set(),
      materials: new Set(),
      textures: new Set(),
      renderers: new Set(),
      targets: new Set() // Render targets
    };

    // Track which resources are managed vs external
    this.managed = new WeakMap();
  }

  /**
   * Register a geometry for tracking
   * @param {THREE.Geometry|THREE.BufferGeometry} geometry - The geometry to track
   * @param {boolean} isManaged - Whether we should dispose it
   */
  registerGeometry(geometry, isManaged = true) {
    this.resources.geometries.add(geometry);
    this.managed.set(geometry, isManaged);
    return geometry;
  }

  /**
   * Register a material for tracking
   * @param {THREE.Material|THREE.Material[]} material - The material(s) to track
   * @param {boolean} isManaged - Whether we should dispose it
   */
  registerMaterial(material, isManaged = true) {
    if (Array.isArray(material)) {
      material.forEach(m => {
        this.resources.materials.add(m);
        this.managed.set(m, isManaged);
      });
    } else {
      this.resources.materials.add(material);
      this.managed.set(material, isManaged);
    }
    return material;
  }

  /**
   * Register a texture for tracking
   * @param {THREE.Texture} texture - The texture to track
   * @param {boolean} isManaged - Whether we should dispose it
   */
  registerTexture(texture, isManaged = true) {
    this.resources.textures.add(texture);
    this.managed.set(texture, isManaged);
    return texture;
  }

  /**
   * Register a renderer for tracking
   * @param {THREE.WebGLRenderer} renderer - The renderer to track
   * @param {boolean} isManaged - Whether we should dispose it
   */
  registerRenderer(renderer, isManaged = true) {
    this.resources.renderers.add(renderer);
    this.managed.set(renderer, isManaged);
    return renderer;
  }

  /**
   * Register a render target for tracking
   * @param {THREE.WebGLRenderTarget} target - The render target to track
   * @param {boolean} isManaged - Whether we should dispose it
   */
  registerRenderTarget(target, isManaged = true) {
    this.resources.targets.add(target);
    this.managed.set(target, isManaged);
    return target;
  }

  /**
   * Unregister and dispose a geometry
   * @param {THREE.Geometry|THREE.BufferGeometry} geometry - The geometry to dispose
   */
  disposeGeometry(geometry) {
    if (!geometry) return;
    if (this.managed.get(geometry) !== false) {
      geometry.dispose();
    }
    this.resources.geometries.delete(geometry);
  }

  /**
   * Unregister and dispose a material
   * @param {THREE.Material|THREE.Material[]} material - The material(s) to dispose
   */
  disposeMaterial(material) {
    if (!material) return;
    if (Array.isArray(material)) {
      material.forEach(m => this.disposeMaterial(m));
      return;
    }
    if (this.managed.get(material) !== false) {
      material.dispose();
    }
    this.resources.materials.delete(material);
  }

  /**
   * Unregister and dispose a texture
   * @param {THREE.Texture} texture - The texture to dispose
   */
  disposeTexture(texture) {
    if (!texture) return;
    if (this.managed.get(texture) !== false) {
      texture.dispose();
    }
    this.resources.textures.delete(texture);
  }

  /**
   * Unregister and dispose a renderer
   * @param {THREE.WebGLRenderer} renderer - The renderer to dispose
   */
  disposeRenderer(renderer) {
    if (!renderer) return;
    if (this.managed.get(renderer) !== false) {
      renderer.dispose();
    }
    this.resources.renderers.delete(renderer);
  }

  /**
   * Unregister and dispose a render target
   * @param {THREE.WebGLRenderTarget} target - The render target to dispose
   */
  disposeRenderTarget(target) {
    if (!target) return;
    if (this.managed.get(target) !== false) {
      target.dispose();
    }
    this.resources.targets.delete(target);
  }

  /**
   * Dispose all tracked geometries
   */
  disposeAllGeometries() {
    this.resources.geometries.forEach(geometry => {
      if (this.managed.get(geometry) !== false) {
        geometry.dispose();
      }
    });
    this.resources.geometries.clear();
  }

  /**
   * Dispose all tracked materials
   */
  disposeAllMaterials() {
    this.resources.materials.forEach(material => {
      if (this.managed.get(material) !== false) {
        material.dispose();
      }
    });
    this.resources.materials.clear();
  }

  /**
   * Dispose all tracked textures
   */
  disposeAllTextures() {
    this.resources.textures.forEach(texture => {
      if (this.managed.get(texture) !== false) {
        texture.dispose();
      }
    });
    this.resources.textures.clear();
  }

  /**
   * Dispose all tracked renderers
   */
  disposeAllRenderers() {
    this.resources.renderers.forEach(renderer => {
      if (this.managed.get(renderer) !== false) {
        renderer.dispose();
      }
    });
    this.resources.renderers.clear();
  }

  /**
   * Dispose all tracked render targets
   */
  disposeAllRenderTargets() {
    this.resources.targets.forEach(target => {
      if (this.managed.get(target) !== false) {
        target.dispose();
      }
    });
    this.resources.targets.clear();
  }

  /**
   * Dispose a mesh and its resources
   * @param {THREE.Mesh|THREE.Object3D} mesh - The mesh/object to dispose
   * @param {boolean} recursive - Whether to dispose children
   */
  disposeMesh(mesh, recursive = true) {
    if (!mesh) return;

    if (recursive && mesh.children) {
      for (let i = mesh.children.length - 1; i >= 0; i--) {
        this.disposeMesh(mesh.children[i], true);
      }
    }

    if (mesh.geometry) this.disposeGeometry(mesh.geometry);
    if (mesh.material) this.disposeMaterial(mesh.material);
  }

  /**
   * Dispose scene and all its children
   * @param {THREE.Scene} scene - The scene to dispose
   */
  disposeScene(scene) {
    if (!scene) return;

    // Dispose all objects in scene
    scene.traverse(object => {
      if (object.geometry) this.disposeGeometry(object.geometry);
      if (object.material) this.disposeMaterial(object.material);
    });

    // Clear scene
    for (let i = scene.children.length - 1; i >= 0; i--) {
      scene.remove(scene.children[i]);
    }
  }

  /**
   * Get resource statistics
   * @returns {Object} - Statistics about tracked resources
   */
  getStats() {
    return {
      geometries: this.resources.geometries.size,
      materials: this.resources.materials.size,
      textures: this.resources.textures.size,
      renderers: this.resources.renderers.size,
      renderTargets: this.resources.targets.size,
      total: this.resources.geometries.size + this.resources.materials.size +
             this.resources.textures.size + this.resources.renderers.size +
             this.resources.targets.size
    };
  }

  /**
   * Clear all resource tracking
   * WARNING: This does NOT dispose resources, only clears tracking
   * Use disposeAll() to dispose all resources
   */
  clear() {
    this.resources.geometries.clear();
    this.resources.materials.clear();
    this.resources.textures.clear();
    this.resources.renderers.clear();
    this.resources.targets.clear();
  }

  /**
   * Dispose all tracked resources
   */
  disposeAll() {
    this.disposeAllGeometries();
    this.disposeAllMaterials();
    this.disposeAllTextures();
    this.disposeAllRenderers();
    this.disposeAllRenderTargets();
  }

  /**
   * Reset resource manager to initial state
   */
  reset() {
    this.disposeAll();
    this.clear();
  }
}

// ============================================================================
// GLOBAL RESOURCE MANAGER INSTANCE
// ============================================================================

const resourceManager = new ResourceManager();

// Export singleton
export default resourceManager;

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export function registerGeometry(geometry, isManaged = true) {
  return resourceManager.registerGeometry(geometry, isManaged);
}

export function registerMaterial(material, isManaged = true) {
  return resourceManager.registerMaterial(material, isManaged);
}

export function registerTexture(texture, isManaged = true) {
  return resourceManager.registerTexture(texture, isManaged);
}

export function registerRenderer(renderer, isManaged = true) {
  return resourceManager.registerRenderer(renderer, isManaged);
}

export function registerRenderTarget(target, isManaged = true) {
  return resourceManager.registerRenderTarget(target, isManaged);
}

export function disposeAllResources() {
  resourceManager.disposeAll();
}

export function getResourceStats() {
  return resourceManager.getStats();
}
