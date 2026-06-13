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
