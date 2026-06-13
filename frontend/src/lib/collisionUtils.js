import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import plotsData from '../data/plots.json';
import { getBuildingHeight, PLOT_BOUNDS } from './plotUtils';

THREE.Mesh.prototype.raycast = acceleratedRaycast;

const _dir = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _normal = new THREE.Vector3();

/** 2D plot footprints used as building collision zones. */
export function getBuildingFootprints(occupiedIndexes = null, plots = plotsData) {
  const occupied = Array.isArray(occupiedIndexes) ? new Set(occupiedIndexes) : null;

  return plots
    .map((plot, index) => ({ plot, index }))
    .filter(({ index }) => !occupied || occupied.has(index))
    .map(({ plot, index }) => ({
    points: plot.map(([x, , z]) => [x, z]),
    height: getBuildingHeight(index, plot),
    inset: 1.4,
  }));
}

function insetPolygon(points, inset) {
  if (inset <= 0) return points;

  let cx = 0;
  let cz = 0;
  for (const [x, z] of points) {
    cx += x;
    cz += z;
  }
  cx /= points.length;
  cz /= points.length;

  return points.map(([x, z]) => {
    const dx = x - cx;
    const dz = z - cz;
    const len = Math.hypot(dx, dz) || 1;
    const scale = Math.max(0, 1 - inset / len);
    return [cx + dx * scale, cz + dz * scale];
  });
}

function pointInPolygon(x, z, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    const intersect = ((zi > z) !== (zj > z))
      && (x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function closestPointOnSegment(px, pz, ax, az, bx, bz) {
  const abx = bx - ax;
  const abz = bz - az;
  const apx = px - ax;
  const apz = pz - az;
  const abLenSq = abx * abx + abz * abz || 1;
  let t = (apx * abx + apz * abz) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + abx * t;
  const cz = az + abz * t;
  const dx = px - cx;
  const dz = pz - cz;
  return { x: cx, z: cz, distSq: dx * dx + dz * dz, nx: dx, nz: dz };
}

/** Push a circle away from building footprints; returns adjusted [x, z]. */
export function resolveBuildingCollisions(x, z, radius, footprints = getBuildingFootprints()) {
  let px = x;
  let pz = z;

  for (let pass = 0; pass < 4; pass++) {
    let moved = false;

    for (const footprint of footprints) {
      const polygon = insetPolygon(footprint.points, footprint.inset);
      const inside = pointInPolygon(px, pz, polygon);

      let closestDistSq = Infinity;
      let closestX = px;
      let closestZ = pz;

      for (let i = 0; i < polygon.length; i++) {
        const [ax, az] = polygon[i];
        const [bx, bz] = polygon[(i + 1) % polygon.length];
        const hit = closestPointOnSegment(px, pz, ax, az, bx, bz);
        if (hit.distSq < closestDistSq) {
          closestDistSq = hit.distSq;
          closestX = hit.x;
          closestZ = hit.z;
        }
      }

      const dist = Math.sqrt(closestDistSq);
      if (!inside && dist >= radius) continue;

      let nx;
      let nz;
      if (inside) {
        let cx = 0;
        let cz = 0;
        for (const [px2, pz2] of polygon) {
          cx += px2;
          cz += pz2;
        }
        cx /= polygon.length;
        cz /= polygon.length;
        const toCenter = Math.hypot(px - cx, pz - cz) || 1;
        nx = (px - cx) / toCenter;
        nz = (pz - cz) / toCenter;
      } else {
        nx = dist > 0.0001 ? (px - closestX) / dist : 1;
        nz = dist > 0.0001 ? (pz - closestZ) / dist : 0;
      }

      const push = inside ? radius + 0.25 : radius - dist + 0.08;

      px += nx * push;
      pz += nz * push;
      moved = true;
    }

    if (!moved) break;
  }

  return [px, pz];
}

/** Keep the car on drivable city bounds with a soft margin. */
export function clampToMapBounds(x, z, margin = 24) {
  return [
    THREE.MathUtils.clamp(x, PLOT_BOUNDS.minX + margin, PLOT_BOUNDS.maxX - margin),
    THREE.MathUtils.clamp(z, PLOT_BOUNDS.minZ + margin, PLOT_BOUNDS.maxZ - margin),
  ];
}

const _raycaster = new THREE.Raycaster();

/** Build accelerated BVH colliders from infrastructure meshes. */
export function buildMeshColliders(root) {
  const colliders = [];

  root.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;

    const geometry = child.geometry.clone();
    child.updateWorldMatrix(true, false);
    geometry.applyMatrix4(child.matrixWorld);

    if (!geometry.attributes.position) return;

    geometry.computeBoundingBox();
    geometry.boundsTree = new MeshBVH(geometry);

    const mesh = new THREE.Mesh(geometry);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();

    colliders.push(mesh);
  });

  return colliders;
}

/** Raycast against infrastructure; returns first hit or null. */
export function raycastInfrastructure(colliders, fromX, fromY, fromZ, toX, toY, toZ) {
  if (!colliders.length) return null;

  _dir.set(toX - fromX, toY - fromY, toZ - fromZ);
  const maxDistance = _dir.length();
  if (maxDistance < 0.001) return null;
  _dir.multiplyScalar(1 / maxDistance);

  _origin.set(fromX, fromY, fromZ);
  _raycaster.set(_origin, _dir);
  _raycaster.far = maxDistance;

  const hits = _raycaster.intersectObjects(colliders, false);
  if (!hits.length) return null;

  const hit = hits[0];
  const normal = hit.face?.normal
    ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
    : new THREE.Vector3(0, 1, 0);

  return {
    distance: hit.distance,
    point: hit.point.clone(),
    normal,
  };
}

const SURFACE_RAY_TOP = 500;
const SURFACE_RAY_BOTTOM = -80;

/** Cast downward through the full basemap and return the topmost drivable hit. */
export function sampleSurface(colliders, x, z) {
  if (!colliders.length) {
    return { y: 0, normal: new THREE.Vector3(0, 1, 0), point: new THREE.Vector3(x, 0, z) };
  }

  _origin.set(x, SURFACE_RAY_TOP, z);
  _dir.set(0, -1, 0);
  _raycaster.set(_origin, _dir);
  _raycaster.far = SURFACE_RAY_TOP - SURFACE_RAY_BOTTOM;

  const hits = _raycaster.intersectObjects(colliders, false);
  if (!hits.length) {
    return { y: 0, normal: new THREE.Vector3(0, 1, 0), point: new THREE.Vector3(x, 0, z) };
  }

  const hit = hits[0];
  const normal = hit.face?.normal
    ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
    : new THREE.Vector3(0, 1, 0);

  return {
    y: hit.point.y,
    normal,
    point: hit.point.clone(),
  };
}

/** Find a spawn point on a basemap surface near the city center. */
export function findDriveSpawn(colliders, centerX, centerZ, searchRadius = 140, step = 12) {
  let best = {
    x: centerX,
    z: centerZ,
    y: 0,
    score: -Infinity,
  };

  for (let dx = -searchRadius; dx <= searchRadius; dx += step) {
    for (let dz = -searchRadius; dz <= searchRadius; dz += step) {
      const x = centerX + dx;
      const z = centerZ + dz;
      const surface = sampleSurface(colliders, x, z);
      const flatness = THREE.MathUtils.clamp(surface.normal.y, 0, 1);
      if (flatness < 0.45) continue;

      const distFromCenter = Math.hypot(dx, dz);
      const score = flatness * 5 + surface.y * 0.18 - distFromCenter * 0.008;

      if (score > best.score) {
        best = { x, z, y: surface.y, score };
      }
    }
  }

  return best;
}

/** Slide movement along basemap geometry at the car's current elevation. */
export function resolveInfrastructureCollision(colliders, x, bodyY, z, nextX, nextZ, radius = 2.2) {
  if (!colliders.length) return [nextX, nextZ];

  const heights = [bodyY - 0.35, bodyY, bodyY + 0.55, bodyY + 1.1];
  let px = nextX;
  let pz = nextZ;

  for (const sampleY of heights) {
    const hit = raycastInfrastructure(colliders, x, sampleY, z, px, sampleY, pz);
    if (!hit || hit.distance >= Math.hypot(px - x, pz - z)) continue;

    _normal.copy(hit.normal);
    if (Math.abs(_normal.y) > 0.72) continue;

    const safeDist = Math.max(0, hit.distance - radius - 0.12);
    const dx = px - x;
    const dz = pz - z;
    const len = Math.hypot(dx, dz) || 1;
    px = x + (dx / len) * safeDist;
    pz = z + (dz / len) * safeDist;

    const slideX = dx - _normal.x * (dx * _normal.x + dz * _normal.z);
    const slideZ = dz - _normal.z * (dx * _normal.x + dz * _normal.z);
    const slideLen = Math.hypot(slideX, slideZ);
    if (slideLen > 0.05) {
      const remaining = Math.max(0, len - safeDist);
      px += (slideX / slideLen) * remaining * 0.85;
      pz += (slideZ / slideLen) * remaining * 0.85;
    }
  }

  return [px, pz];
}
