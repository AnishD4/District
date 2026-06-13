import * as THREE from 'three';
import plotsData from '../data/plots.json';

export function getPlotBounds(plots = plotsData) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const plot of plots) {
    for (const [x, , z] of plot) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
  }

  return { minX, maxX, minZ, maxZ };
}

export const PLOT_BOUNDS = getPlotBounds();

export const CITY_CENTER = [
  (PLOT_BOUNDS.minX + PLOT_BOUNDS.maxX) / 2,
  0,
  (PLOT_BOUNDS.minZ + PLOT_BOUNDS.maxZ) / 2,
];

const CAMERA_FOV_DEG = 42;

/** Zoom limits so the full map fits in frame without showing void past the terrain. */
export function getCameraDistanceLimits(aspect = 16 / 9, fitPadding = 1.06) {
  const width = PLOT_BOUNDS.maxX - PLOT_BOUNDS.minX;
  const height = PLOT_BOUNDS.maxZ - PLOT_BOUNDS.minZ;
  const vFov = (CAMERA_FOV_DEG * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);

  const distForHeight = (height / 2) / Math.tan(vFov / 2);
  const distForWidth = (width / 2) / Math.tan(hFov / 2);
  const maxDistance = Math.max(distForHeight, distForWidth) * fitPadding;
  const minDistance = Math.max(90, Math.min(width, height) * 0.1);

  return { minDistance, maxDistance, fovDeg: CAMERA_FOV_DEG };
}

/** Terrain plane large enough to fill the view at max zoom from any pan position. */
export function getTerrainDimensions(maxDistance, aspect = 16 / 9) {
  const mapWidth = PLOT_BOUNDS.maxX - PLOT_BOUNDS.minX;
  const mapHeight = PLOT_BOUNDS.maxZ - PLOT_BOUNDS.minZ;
  const vFov = (CAMERA_FOV_DEG * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  const viewRadius = maxDistance * Math.tan(Math.max(vFov, hFov) / 2) * 1.35;
  const panSlack = Math.max(mapWidth, mapHeight) * 0.12;

  return {
    width: mapWidth + (viewRadius + panSlack) * 2,
    depth: mapHeight + (viewRadius + panSlack) * 2,
  };
}

/** Soft pan limits — keeps the orbit target over the city without feeling locked in. */
export function getPanBounds() {
  const mapWidth = PLOT_BOUNDS.maxX - PLOT_BOUNDS.minX;
  const mapHeight = PLOT_BOUNDS.maxZ - PLOT_BOUNDS.minZ;

  return {
    minX: PLOT_BOUNDS.minX + mapWidth * 0.06,
    maxX: PLOT_BOUNDS.maxX - mapWidth * 0.06,
    minZ: PLOT_BOUNDS.minZ + mapHeight * 0.06,
    maxZ: PLOT_BOUNDS.maxZ - mapHeight * 0.06,
  };
}

export function getPlotArea(plot) {
  let area = 0;
  for (let i = 0; i < plot.length; i++) {
    const [x1, , z1] = plot[i];
    const [x2, , z2] = plot[(i + 1) % plot.length];
    area += x1 * z2 - x2 * z1;
  }
  return Math.abs(area) / 2;
}

export function getBuildingHeight(index, plot) {
  const minHeight = 25;
  const maxHeight = 90;
  const area = getPlotArea(plot);
  const areaFactor = Math.min(1, Math.sqrt(area) / 120);
  const pseudoRandom = Math.abs(Math.sin(index * 13.5) * 43.1) % 1;
  return minHeight + (maxHeight - minHeight) * (0.35 * areaFactor + 0.65 * pseudoRandom);
}

export function createPlotShape(plot) {
  const shape = new THREE.Shape();
  shape.moveTo(plot[0][0], -plot[0][2]);
  for (let i = 1; i < plot.length; i++) {
    shape.lineTo(plot[i][0], -plot[i][2]);
  }
  shape.closePath();
  return shape;
}
