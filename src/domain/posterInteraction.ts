/** @fileoverview 海报拖拽/缩放数学计算——delta 转换、吸附网格、rect 裁剪。纯函数。 */

import { clampPosterRect, MIN_POSTER_COMPONENT_SIZE, POSTER_COORD_MAX } from "./posterCanvas";
import type { PosterRect } from "./types";

export type ResizeEdge = "top" | "right" | "bottom" | "left";
export type InteractionKind = "drag" | "resize";

export interface PointerLike {
  clientX: number;
  clientY: number;
}

export const POSTER_SNAP_THRESHOLD_PX = 8;
export const POSTER_GUIDE_COLUMNS = 24;
export const POSTER_GUIDE_ROWS = 12;

function clampValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function snapCoordinate(value: number, step: number, threshold: number): number {
  const guide = Math.round(value / step) * step;
  return Math.abs(guide - value) <= threshold ? Math.round(guide) : Math.round(value);
}

function resizeRectFromEdge(rect: PosterRect, edge: ResizeEdge, edgePosition: number): PosterRect {
  const right = rect.x + rect.w;
  const bottom = rect.y + rect.h;

  if (edge === "right") {
    const nextRight = clampValue(edgePosition, rect.x + MIN_POSTER_COMPONENT_SIZE, POSTER_COORD_MAX);
    return { ...rect, w: Math.round(nextRight - rect.x) };
  }
  if (edge === "bottom") {
    const nextBottom = clampValue(edgePosition, rect.y + MIN_POSTER_COMPONENT_SIZE, POSTER_COORD_MAX);
    return { ...rect, h: Math.round(nextBottom - rect.y) };
  }
  if (edge === "left") {
    const nextLeft = clampValue(edgePosition, 0, right - MIN_POSTER_COMPONENT_SIZE);
    const x = Math.round(nextLeft);
    return { ...rect, x, w: Math.round(right - x) };
  }

  const nextTop = clampValue(edgePosition, 0, bottom - MIN_POSTER_COMPONENT_SIZE);
  const y = Math.round(nextTop);
  return { ...rect, y, h: Math.round(bottom - y) };
}

export function nextDragRect(
  canvas: HTMLElement,
  startRect: PosterRect,
  startX: number,
  startY: number,
  event: PointerLike,
): PosterRect {
  const bounds = canvas.getBoundingClientRect();
  const dx = ((event.clientX - startX) / bounds.width) * 10000;
  const dy = ((event.clientY - startY) / bounds.height) * 10000;

  return clampPosterRect({
    ...startRect,
    x: startRect.x + dx,
    y: startRect.y + dy,
  });
}

export function nextResizeRect(
  canvas: HTMLElement,
  startRect: PosterRect,
  startX: number,
  startY: number,
  event: PointerLike,
  edge: ResizeEdge,
): PosterRect {
  const bounds = canvas.getBoundingClientRect();
  const dx = ((event.clientX - startX) / bounds.width) * 10000;
  const dy = ((event.clientY - startY) / bounds.height) * 10000;

  if (edge === "right") {
    return resizeRectFromEdge(startRect, edge, startRect.x + startRect.w + dx);
  }
  if (edge === "bottom") {
    return resizeRectFromEdge(startRect, edge, startRect.y + startRect.h + dy);
  }
  if (edge === "left") {
    return resizeRectFromEdge(startRect, edge, startRect.x + dx);
  }
  return resizeRectFromEdge(startRect, edge, startRect.y + dy);
}

export function snapPosterRect(
  canvas: HTMLElement,
  rect: PosterRect,
  kind: InteractionKind,
  edge?: ResizeEdge,
): PosterRect {
  const bounds = canvas.getBoundingClientRect();
  const thresholdX = (POSTER_SNAP_THRESHOLD_PX / Math.max(1, bounds.width)) * 10000;
  const thresholdY = (POSTER_SNAP_THRESHOLD_PX / Math.max(1, bounds.height)) * 10000;
  const stepX = 10000 / POSTER_GUIDE_COLUMNS;
  const stepY = 10000 / POSTER_GUIDE_ROWS;

  if (kind === "drag") {
    return clampPosterRect({
      ...rect,
      x: snapCoordinate(rect.x, stepX, thresholdX),
      y: snapCoordinate(rect.y, stepY, thresholdY),
    });
  }

  const next = { ...rect };
  const right = rect.x + rect.w;
  const bottom = rect.y + rect.h;

  if (edge === "left") {
    return resizeRectFromEdge(rect, edge, snapCoordinate(rect.x, stepX, thresholdX));
  }
  if (edge === "right") {
    return resizeRectFromEdge(rect, edge, snapCoordinate(right, stepX, thresholdX));
  }
  if (edge === "top") {
    return resizeRectFromEdge(rect, edge, snapCoordinate(rect.y, stepY, thresholdY));
  }
  if (edge === "bottom") {
    return resizeRectFromEdge(rect, edge, snapCoordinate(bottom, stepY, thresholdY));
  }

  return clampPosterRect(next);
}

export function eventPosterCanvas(target: Element): HTMLElement | null {
  return target.closest("[data-poster-canvas]") as HTMLElement | null;
}
