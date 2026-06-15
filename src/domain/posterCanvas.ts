import {
  buildPosterViewModel,
  type ConcretePosterTemplateId,
} from "./posterViewModel";
import { bentoRoomDefinitions } from "./bentoDefinitions";
import type {
  BentoRoomTypeId,
  PosterCanvasState,
  PosterComponent,
  PosterComponentType,
  PosterRect,
  ScheduleDocument,
} from "./types";

export const POSTER_COORD_MAX = 10000;
export const MIN_POSTER_COMPONENT_SIZE = 400;
const MIN_POSTER_DIVIDER_HEIGHT = 120;
const POSTER_MARGIN = 220;
const POSTER_DIVIDER_TOP = 1080;
const POSTER_SECTION_START_Y = 980;
const POSTER_SECTION_BOTTOM = POSTER_COORD_MAX - POSTER_MARGIN;

export const DEFAULT_POSTER_COMPONENT_RECTS = {
  title: { x: POSTER_MARGIN, y: 180, w: 2700, h: 780 },
  production: { x: 3060, y: 180, w: 4360, h: 780 },
  drone: { x: 7580, y: 180, w: 2200, h: 780 },
  note: { x: 3060, y: 640, w: 4360, h: 400 },
  divider: {
    x: POSTER_MARGIN,
    y: POSTER_DIVIDER_TOP,
    w: POSTER_COORD_MAX - POSTER_MARGIN * 2,
    h: MIN_POSTER_DIVIDER_HEIGHT,
  },
} as const satisfies Record<string, PosterRect>;

export const DEFAULT_ROOM_RECT: PosterRect = {
  x: POSTER_MARGIN,
  y: POSTER_SECTION_START_Y,
  w: 1440,
  h: 880,
};

export interface PosterColumnDef {
  id: string;
  title: string;
  roomNodeIds: string[];
  widthFraction?: number;
}

export function getPosterColumns(layoutId: string): PosterColumnDef[] {
  switch (layoutId) {
    case "153":
      return [
        { id: "control", title: "中枢", roomNodeIds: ["control-1"] },
        { id: "trade", title: "贸易", roomNodeIds: ["trading-1"] },
        { id: "mfg-a", title: "制造①", roomNodeIds: ["manufacture-1", "manufacture-2", "manufacture-3"] },
        { id: "mfg-b", title: "制造②", roomNodeIds: ["manufacture-4", "manufacture-5"] },
        { id: "power", title: "发电", roomNodeIds: ["power-1", "power-2", "power-3"], widthFraction: 0.12 },
        { id: "other", title: "其他", roomNodeIds: ["meeting-1", "hire-1"], widthFraction: 0.12 },
      ];
    case "252":
      return [
        { id: "control", title: "中枢", roomNodeIds: ["control-1"] },
        { id: "trade", title: "贸易", roomNodeIds: ["trading-1", "trading-2"] },
        { id: "mfg-a", title: "制造①", roomNodeIds: ["manufacture-1", "manufacture-2", "manufacture-3"] },
        { id: "mfg-b", title: "制造②", roomNodeIds: ["manufacture-4", "manufacture-5"] },
        { id: "power", title: "发电", roomNodeIds: ["power-1", "power-2"], widthFraction: 0.12 },
        { id: "other", title: "其他", roomNodeIds: ["meeting-1", "hire-1"], widthFraction: 0.12 },
      ];
    case "333":
      return [
        { id: "control", title: "中枢", roomNodeIds: ["control-1"] },
        { id: "trade", title: "贸易", roomNodeIds: ["trading-1", "trading-2", "trading-3"] },
        { id: "gold", title: "赤金", roomNodeIds: ["manufacture-1"] },
        { id: "record", title: "经验", roomNodeIds: ["manufacture-2", "manufacture-3"] },
        { id: "power", title: "发电", roomNodeIds: ["power-1", "power-2", "power-3"], widthFraction: 0.12 },
        { id: "other", title: "其他", roomNodeIds: ["meeting-1", "hire-1"], widthFraction: 0.12 },
      ];
    case "342":
      return [
        { id: "control", title: "中枢", roomNodeIds: ["control-1"] },
        { id: "trade", title: "贸易", roomNodeIds: ["trading-1", "trading-2", "trading-3"] },
        { id: "gold", title: "赤金", roomNodeIds: ["manufacture-1", "manufacture-2"] },
        { id: "record", title: "经验", roomNodeIds: ["manufacture-3", "manufacture-4"] },
        { id: "power", title: "发电", roomNodeIds: ["power-1", "power-2"], widthFraction: 0.12 },
        { id: "other", title: "其他", roomNodeIds: ["meeting-1", "hire-1"], widthFraction: 0.12 },
      ];
    case "243":
    default:
      return [
        { id: "control", title: "中枢", roomNodeIds: ["control-1"] },
        { id: "trade", title: "贸易", roomNodeIds: ["trading-1", "trading-2"] },
        { id: "gold", title: "赤金", roomNodeIds: ["manufacture-1", "manufacture-2"] },
        { id: "record", title: "经验", roomNodeIds: ["manufacture-3", "manufacture-4"] },
        { id: "power", title: "发电", roomNodeIds: ["power-1", "power-2", "power-3"], widthFraction: 0.12 },
        { id: "other", title: "其他", roomNodeIds: ["meeting-1", "hire-1"], widthFraction: 0.12 },
      ];
  }
}

type ColumnTheme = "control" | "trade" | "gold" | "record" | "power" | "manufacture" | "other";

export const columnThemeMap: Record<string, ColumnTheme> = {
  control: "control",
  trade: "trade",
  gold: "manufacture",
  record: "manufacture",
  "mfg-a": "manufacture",
  "mfg-b": "manufacture",
  power: "power",
  other: "other",
};

function columnRects(columns: PosterColumnDef[], document: ScheduleDocument): PosterRect[] {
  if (columns.length === 0) {
    return [];
  }

  const availableWidth = POSTER_COORD_MAX - POSTER_MARGIN * 2;
  const sectionHeight = POSTER_SECTION_BOTTOM - POSTER_SECTION_START_Y;
  const roomMap = new Map(document.canvas.rooms.map((room) => [room.roomNodeId, room]));

  const fixedFraction = columns.reduce((sum, col) => sum + (col.widthFraction ?? 0), 0);
  const remainingFraction = Math.max(0, 1 - fixedFraction);
  const remainingWidth = availableWidth * remainingFraction;

  const weights = columns.map((col) => {
    if (col.widthFraction !== undefined) return 0;
    return col.roomNodeIds.reduce((maxSlots, roomNodeId) => {
      const room = roomMap.get(roomNodeId);
      const slots = room?.roomType === "CONTROL" ? 3 : (room?.slotCount ?? 1);
      return Math.max(maxSlots, slots);
    }, 0);
  });
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const widths = columns.map((col, i) => {
    if (col.widthFraction !== undefined) {
      return Math.floor(availableWidth * col.widthFraction);
    }
    if (totalWeight === 0) return MIN_POSTER_COMPONENT_SIZE;
    return Math.max(MIN_POSTER_COMPONENT_SIZE, Math.floor((remainingWidth * weights[i]) / totalWeight));
  });

  const rects: PosterRect[] = [];
  let x = POSTER_MARGIN;

  for (let i = 0; i < columns.length; i++) {
    const isLast = i === columns.length - 1;
    const w = isLast
      ? POSTER_COORD_MAX - POSTER_MARGIN - x
      : widths[i];
    rects.push({ x, y: POSTER_SECTION_START_Y, w, h: sectionHeight });
    x += w;
  }

  return rects;
}

const componentTypes = [
  "infrastructure",
  "laneLabel",
  "metric",
  "note",
  "divider",
] as const satisfies readonly PosterComponentType[];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function concreteTemplateId(value: unknown, fallback: ConcretePosterTemplateId): ConcretePosterTemplateId {
  return value === "matrix" || value === "splitPanel" || value === "card" || value === "combo"
    ? value
    : fallback;
}

function textValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function productionLine(document: ScheduleDocument): string {
  return [document.productionSummary.orderText, document.productionSummary.goldText, document.productionSummary.recordText]
    .filter(Boolean)
    .join(" · ");
}

export function clampPosterRect(rect: PosterRect): PosterRect {
  return clampPosterRectWithMinimum(rect, MIN_POSTER_COMPONENT_SIZE);
}

function clampPosterRectWithMinimum(rect: PosterRect, minimumHeight: number): PosterRect {
  const w = Math.min(
    POSTER_COORD_MAX,
    Math.max(MIN_POSTER_COMPONENT_SIZE, Math.round(finiteNumber(rect.w, MIN_POSTER_COMPONENT_SIZE))),
  );
  const h = Math.min(
    POSTER_COORD_MAX,
    Math.max(minimumHeight, Math.round(finiteNumber(rect.h, minimumHeight))),
  );
  const x = Math.min(
    POSTER_COORD_MAX - w,
    Math.max(0, Math.round(finiteNumber(rect.x, 0))),
  );
  const y = Math.min(
    POSTER_COORD_MAX - h,
    Math.max(0, Math.round(finiteNumber(rect.y, 0))),
  );

  return { x, y, w, h };
}

export function clampPosterComponentRect(type: PosterComponentType, rect: PosterRect): PosterRect {
  return clampPosterRectWithMinimum(rect, type === "divider" ? MIN_POSTER_DIVIDER_HEIGHT : MIN_POSTER_COMPONENT_SIZE);
}

export function buildDefaultPosterCanvas(document: ScheduleDocument): PosterCanvasState {
  const view = buildPosterViewModel(document);
  const components: PosterComponent[] = [];

  components.push(
    {
      id: "metric:title",
      type: "metric",
      title: document.title,
      text: document.subtitle,
      metricId: "title",
      rect: DEFAULT_POSTER_COMPONENT_RECTS.title,
      zIndex: 10,
    },
    {
      id: "metric:production",
      type: "metric",
      title: "产出计算",
      text: productionLine(document),
      metricId: "production",
      rect: DEFAULT_POSTER_COMPONENT_RECTS.production,
      zIndex: 10,
    },
    {
      id: "metric:drone",
      type: "metric",
      title: view.metrics[1]?.label ?? "无人机加速",
      text: document.droneSummary.summaryText,
      metricId: "drone",
      rect: DEFAULT_POSTER_COMPONENT_RECTS.drone,
      zIndex: 10,
    },
  );

  const columns = getPosterColumns(document.layoutId);
  const rects = columnRects(columns, document);

  columns.forEach((col, index) => {
    components.push({
      id: `section:${col.id}`,
      type: "infrastructure",
      title: col.title,
      sectionId: col.id,
      rect: rects[index],
      zIndex: 20 + index,
    });
  });

  return {
    schemaVersion: 2,
    sourceTemplateId: view.templateId,
    components: components.map((component) => ({
      ...component,
      rect: clampPosterComponentRect(component.type, component.rect),
    })),
  };
}

function normalizeComponent(
  value: unknown,
  document: ScheduleDocument,
): PosterComponent | null {
  if (!isObject(value) || typeof value.id !== "string" || typeof value.title !== "string") {
    return null;
  }

  const type = componentTypes.includes(value.type as PosterComponentType)
    ? (value.type as PosterComponentType)
    : value.type === "facility" || value.type === "facilityGroup"
      ? "infrastructure"
    : null;
  if (!type || !isObject(value.rect)) {
    return null;
  }

  const requestedRoomNodeId = textValue(value.roomNodeId);
  const sourceRoom = requestedRoomNodeId
    ? document.canvas.rooms.find((room) => room.roomNodeId === requestedRoomNodeId)
    : undefined;
  if (requestedRoomNodeId && !sourceRoom) {
    return null;
  }

  const roomNodeId = sourceRoom?.roomNodeId;
  const roomType = normalizeRoomType(value.roomType) ?? sourceRoom?.roomType;
  const sectionId = textValue(value.sectionId);
  if (type === "infrastructure" && !sectionId && !roomNodeId && !roomType) {
    return null;
  }

  return {
    id: value.id,
    type,
    title: value.title,
    text: textValue(value.text),
    ...(roomNodeId ? { roomNodeId } : {}),
    sectionId,
    laneId: textValue(value.laneId),
    metricId: textValue(value.metricId),
    roomType,
    zIndex: Math.round(finiteNumber(value.zIndex, 1)),
    rect: clampPosterComponentRect(type, {
      x: finiteNumber(value.rect.x, 0),
      y: finiteNumber(value.rect.y, 0),
      w: finiteNumber(value.rect.w, MIN_POSTER_COMPONENT_SIZE),
      h: finiteNumber(value.rect.h, MIN_POSTER_COMPONENT_SIZE),
    }),
  };
}

function normalizeRoomType(value: unknown): BentoRoomTypeId | undefined {
  return typeof value === "string" && value in bentoRoomDefinitions
    ? (value as BentoRoomTypeId)
    : undefined;
}

export function normalizePosterCanvas(
  value: unknown,
  document: ScheduleDocument,
): PosterCanvasState {
  const fallback = buildPosterViewModel(document).templateId;
  if (!isObject(value) || !Array.isArray(value.components)) {
    return {
      schemaVersion: 2,
      sourceTemplateId: fallback,
      components: [],
    };
  }

  return {
    schemaVersion: 2,
    sourceTemplateId: concreteTemplateId(value.sourceTemplateId, fallback),
    components: value.components.flatMap((component) => {
      const normalized = normalizeComponent(component, document);
      return normalized ? [normalized] : [];
    }),
  };
}

export function validatePosterCanvas(value: unknown, document: ScheduleDocument): boolean {
  if (!isObject(value) || value.schemaVersion !== 2 || !Array.isArray(value.components)) {
    return false;
  }

  const hasOnlyCurrentTypes = value.components.every(
    (component) =>
      isObject(component) && componentTypes.includes(component.type as PosterComponentType),
  );
  if (!hasOnlyCurrentTypes) {
    return false;
  }

  const normalized = normalizePosterCanvas(value, document);
  return normalized.components.length === value.components.length;
}
