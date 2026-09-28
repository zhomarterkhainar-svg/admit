export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const norm = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const mid = (a: Vec3, b: Vec3): Vec3 => scale(add(a, b), 0.5);
export const dist = (a: Vec3, b: Vec3): number => norm(sub(a, b));
export const dist2d = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y);

const RAD2DEG = 180 / Math.PI;

/** Angle between two vectors in degrees, [0..180]. Returns NaN for zero-length vectors. */
export function angleBetween(u: Vec3, v: Vec3): number {
  const n = norm(u) * norm(v);
  if (n === 0) return NaN;
  const c = Math.min(1, Math.max(-1, dot(u, v) / n));
  return Math.acos(c) * RAD2DEG;
}

/** Joint angle at b formed by segments b→a and b→c, degrees [0..180]. */
export function jointAngle(a: Vec3, b: Vec3, c: Vec3): number {
  return angleBetween(sub(a, b), sub(c, b));
}

/**
 * Signed angle of a 2D segment from the vertical "up" direction, degrees (-180..180].
 * Uses image convention: y grows downward. Positive = leaning toward +x.
 */
export function leanFromVertical2d(bottom: Vec3, top: Vec3): number {
  const dx = top.x - bottom.x;
  const dyUp = bottom.y - top.y;
  return Math.atan2(dx, dyUp) * RAD2DEG;
}
