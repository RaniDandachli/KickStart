// @ts-nocheck
/**
 * Night-city synthwave look: emissive boost on loaded meshes so neon reads against fog.
 */
import { Mesh, Object3D } from 'three';

/** Typical Lambert / Phong / Standard materials in expo-three scenes */
function enhanceMaterial(mat: Record<string, unknown>) {
  if (!mat || typeof mat !== 'object') return;
  const ud = mat.userData as Record<string, unknown> | undefined;
  if (ud?.cyberNeonApplied) return;
  const color = mat.color;
  const emissive = mat.emissive;
  if (!color || !emissive || typeof color.copy !== 'function') return;
  try {
    emissive.copy(color).multiplyScalar(0.26);
    if (typeof mat.emissiveIntensity === 'number') {
      mat.emissiveIntensity = Math.min(0.55, (mat.emissiveIntensity || 0) + 0.28);
    }
    if (!mat.userData) mat.userData = {};
    (mat.userData as Record<string, unknown>).cyberNeonApplied = true;
  } catch {
    /** ignore bad materials */
  }
}

export function applyNeonEmissiveToWorld(root: Object3D) {
  root.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      enhanceMaterial(m as Record<string, unknown>);
    }
  });
}
