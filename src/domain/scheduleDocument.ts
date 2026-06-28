/** @fileoverview 所有排班数据变更操作——assign/clear/swap、房间增删移、海报组件 CRUD、布局切换。纯函数，不可变更新。 */

import {
  bentoRoomDefinitions,
  BENTO_GRID,
  getRequiredRoomCount,
  getRequiredTotalRoomCount,
} from "./bentoDefinitions";
import { clampRect, rectsOverlap } from "./bentoGrid";
import { createBentoRoomNode, createBentoSchedule, createRoomAssignment } from "./createBentoSchedule";
import {
  buildDefaultPosterCanvas,
  clampPosterComponentRect,
  clampPosterRect,
  DEFAULT_POSTER_COMPONENT_RECTS,
  DEFAULT_ROOM_RECT,
  normalizePosterCanvas,
  validatePosterCanvas,
} from "./posterCanvas";
import { isPosterMode, isPosterTemplateId } from "./posterDefinitions";
import { buildPosterViewModel } from "./posterViewModel";
import { MAX_QUEUE_COUNT, MIN_QUEUE_COUNT } from "./queueLimits";
import type {
  BentoRoomNode,
  BentoRoomTypeId,
  ElitePhase,
  GridRect,
  PosterComponent,
  PosterComponentType,
  PosterMode,
  PosterRect,
  PosterTemplateId,
  ProductKind,
  RoomAssignment,
  ScheduleDocument,
  ScheduleQueue,
  SlotAddress,
  SlotAssignment,
} from "./types";

export type ScheduleMetadataPatch = Partial<
  Pick<ScheduleDocument, "title" | "subtitle" | "authorText" | "notes">
> & {
  productionSummary?: Partial<ScheduleDocument["productionSummary"]>;
  droneSummary?: Partial<ScheduleDocument["droneSummary"]>;
};

export interface PosterSettingsPatch {
  posterTemplateId?: PosterTemplateId;
  posterMode?: PosterMode;
}

export type PosterComponentAddKind = Extract<PosterComponentType, "metric" | "note" | "divider">;
export interface PosterComponentContentPatch {
  title?: string;
  text?: string;
}

function stamp(document: ScheduleDocument): ScheduleDocument {
  return { ...document, updatedAt: new Date().toISOString() };
}

function updateAssignment(
  document: ScheduleDocument,
  queueId: string,
  assignmentId: string,
  updater: (assignment: RoomAssignment) => RoomAssignment,
): ScheduleDocument {
  return stamp({
    ...document,
    queues: document.queues.map((queue) =>
      queue.id === queueId
        ? {
            ...queue,
            roomAssignments: queue.roomAssignments.map((assignment) =>
              assignment.assignmentId === assignmentId ? updater(assignment) : assignment,
            ),
          }
        : queue,
    ),
  });
}

function findSlot(document: ScheduleDocument, address: SlotAddress) {
  const queue = document.queues.find((item) => item.id === address.queueId);
  const assignment = queue?.roomAssignments.find((item) => item.assignmentId === address.assignmentId);
  const slot = assignment?.operators.find((item) => item.slotIndex === address.slotIndex);

  return { queue, assignment, slot };
}

type SlotPayload = Pick<SlotAssignment, "operatorId" | "overrideName" | "elitePhase">;
type PosterDropCenter = Pick<PosterRect, "x" | "y">;
type GridDropCenter = Pick<GridRect, "x" | "y">;

function slotPayload(slot: SlotAssignment): SlotPayload {
  return {
    operatorId: slot.operatorId,
    overrideName: slot.overrideName,
    elitePhase: slot.elitePhase,
  };
}

function applySlotPayload(slot: SlotAssignment, payload: SlotPayload): SlotAssignment {
  return {
    slotIndex: slot.slotIndex,
    ...(slot.isOptional !== undefined ? { isOptional: slot.isOptional } : {}),
    ...(slot.elitePhase !== undefined ? { elitePhase: slot.elitePhase } : {}),
    ...(payload.operatorId !== undefined ? { operatorId: payload.operatorId } : {}),
    ...(payload.overrideName !== undefined ? { overrideName: payload.overrideName } : {}),
    ...(payload.elitePhase !== undefined ? { elitePhase: payload.elitePhase } : {}),
  };
}

function replaceSlotPayload(
  document: ScheduleDocument,
  address: SlotAddress,
  payload: SlotPayload,
): ScheduleDocument {
  return updateAssignment(document, address.queueId, address.assignmentId, (assignment) => ({
    ...assignment,
    operators: assignment.operators.map((slot) =>
      slot.slotIndex === address.slotIndex ? applySlotPayload(slot, payload) : slot,
    ),
  }));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isGridRect(value: unknown): value is GridRect {
  const rect = value as GridRect;
  return (
    isObject(value) &&
    Number.isInteger(rect.x) &&
    Number.isInteger(rect.y) &&
    Number.isInteger(rect.w) &&
    Number.isInteger(rect.h) &&
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.w > 0 &&
    rect.h > 0 &&
    rect.x + rect.w <= BENTO_GRID.columns &&
    rect.y + rect.h <= BENTO_GRID.rows
  );
}

function isBentoRoomType(value: unknown): value is BentoRoomTypeId {
  return (
    value === "CONTROL" ||
    value === "TRADING" ||
    value === "MANUFACTURE" ||
    value === "POWER" ||
    value === "MEETING" ||
    value === "HIRE"
  );
}

function validateCanvasRooms(document: ScheduleDocument): boolean {
  if (
    !isObject(document.canvas) ||
    document.canvas.grid?.columns !== BENTO_GRID.columns ||
    document.canvas.grid?.rows !== BENTO_GRID.rows ||
    !Array.isArray(document.canvas.rooms)
  ) {
    return false;
  }

  const ids = new Set<string>();
  for (const room of document.canvas.rooms) {
    if (
      !isObject(room) ||
      typeof room.roomNodeId !== "string" ||
      ids.has(room.roomNodeId) ||
      !isBentoRoomType(room.roomType) ||
      !Number.isInteger(room.roomIndex) ||
      typeof room.label !== "string" ||
      !Number.isInteger(room.slotCount) ||
      room.slotCount !== bentoRoomDefinitions[room.roomType].slotCount ||
      !isGridRect(room.rect)
    ) {
      return false;
    }
    ids.add(room.roomNodeId);
  }

  return ids.size <= getRequiredTotalRoomCount(document.layoutId);
}

function validateQueues(document: ScheduleDocument): boolean {
  const roomIds = new Set(document.canvas.rooms.map((room) => room.roomNodeId));
  const queueIds = new Set<string>();

  return (
    Array.isArray(document.queues) &&
    document.queues.length === document.queueCount &&
    document.queues.every((queue: ScheduleQueue) => {
      if (
        !isObject(queue) ||
        typeof queue.id !== "string" ||
        queueIds.has(queue.id) ||
        typeof queue.label !== "string" ||
        typeof queue.durationLabel !== "string" ||
        !Array.isArray(queue.roomAssignments)
      ) {
        return false;
      }
      queueIds.add(queue.id);

      const assignmentRoomIds = new Set<string>();
      return queue.roomAssignments.every((assignment) => {
        if (
          !isObject(assignment) ||
          typeof assignment.assignmentId !== "string" ||
          typeof assignment.roomNodeId !== "string" ||
          assignmentRoomIds.has(assignment.roomNodeId) ||
          !roomIds.has(assignment.roomNodeId) ||
          !Array.isArray(assignment.operators)
        ) {
          return false;
        }
        assignmentRoomIds.add(assignment.roomNodeId);

        return assignment.operators.every(
          (slot) =>
            Number.isInteger(slot.slotIndex) &&
            (slot.elitePhase === undefined || slot.elitePhase === 1 || slot.elitePhase === 2),
        );
      });
    }) &&
    queueIds.has(document.activeQueueId)
  );
}

export function validateScheduleDocument(value: unknown): value is ScheduleDocument {
  const document = value as ScheduleDocument;

  return (
    isObject(document) &&
    document.version === 2 &&
    typeof document.title === "string" &&
    typeof document.subtitle === "string" &&
    typeof document.authorText === "string" &&
    typeof document.layoutId === "string" &&
    Number.isInteger(document.queueCount) &&
    document.queueCount >= MIN_QUEUE_COUNT &&
    document.queueCount <= MAX_QUEUE_COUNT &&
    typeof document.activeQueueId === "string" &&
    (document.posterTemplateId === undefined || isPosterTemplateId(document.posterTemplateId)) &&
    (document.posterMode === undefined || isPosterMode(document.posterMode)) &&
    validateCanvasRooms(document) &&
    validateQueues(document) &&
    (document.posterCanvas === undefined || validatePosterCanvas(document.posterCanvas, document))
  );
}

export function setLayout(document: ScheduleDocument, layoutId: string): ScheduleDocument {
  const next = createBentoSchedule(layoutId, document.queueCount);
  return {
    ...next,
    posterTemplateId: document.posterTemplateId,
    posterMode: document.posterMode,
    posterCanvas: undefined,
  };
}

export function setQueueCount(document: ScheduleDocument, count: number): ScheduleDocument {
  const next = createBentoSchedule(document.layoutId, count);
  const previousQueues = new Map(document.queues.map((queue) => [queue.id, queue]));

  return {
    ...next,
    title: document.title,
    subtitle: document.subtitle,
    authorText: document.authorText,
    productionSummary: document.productionSummary,
    droneSummary: document.droneSummary,
    notes: document.notes,
    posterTemplateId: document.posterTemplateId,
    posterMode: document.posterMode,
    posterCanvas: undefined,
    canvas: document.canvas,
    queues: next.queues.map((queue) => previousQueues.get(queue.id) ?? queue),
    activeQueueId: previousQueues.has(document.activeQueueId) ? document.activeQueueId : next.activeQueueId,
  };
}

export function setActiveQueue(document: ScheduleDocument, queueId: string): ScheduleDocument {
  return document.queues.some((queue) => queue.id === queueId)
    ? stamp({ ...document, activeQueueId: queueId })
    : document;
}

export function updatePosterSettings(
  document: ScheduleDocument,
  patch: PosterSettingsPatch,
): ScheduleDocument {
  return stamp({
    ...document,
    ...(patch.posterTemplateId ? { posterTemplateId: patch.posterTemplateId } : {}),
    ...(patch.posterMode ? { posterMode: patch.posterMode } : {}),
    posterCanvas: undefined,
  });
}

export function regeneratePosterCanvas(document: ScheduleDocument): ScheduleDocument {
  return stamp({
    ...document,
    posterCanvas: buildDefaultPosterCanvas(document),
  });
}

export function clearPosterCanvas(document: ScheduleDocument): ScheduleDocument {
  const posterCanvas = currentPosterCanvas(document);

  return stamp({
    ...document,
    posterCanvas: {
      ...posterCanvas,
      components: [],
    },
  });
}

export function updatePosterComponentRect(
  document: ScheduleDocument,
  componentId: string,
  rect: PosterRect,
): ScheduleDocument {
  const posterCanvas = normalizePosterCanvas(
    document.posterCanvas ?? buildDefaultPosterCanvas(document),
    document,
  );

  return stamp({
    ...document,
    posterCanvas: {
      ...posterCanvas,
      components: posterCanvas.components.map((component) =>
        component.id === componentId ? { ...component, rect: clampPosterComponentRect(component.type, rect) } : component,
      ),
    },
  });
}

export function updatePosterComponentContent(
  document: ScheduleDocument,
  componentId: string,
  patch: PosterComponentContentPatch,
): ScheduleDocument {
  const posterCanvas = currentPosterCanvas(document);
  const editableTypes = new Set<PosterComponentType>(["metric", "note", "laneLabel", "infrastructure"]);

  return stamp({
    ...document,
    posterCanvas: {
      ...posterCanvas,
      components: posterCanvas.components.map((component) => {
        if (component.id !== componentId || !editableTypes.has(component.type)) {
          return component;
        }

        return {
          ...component,
          ...(patch.title ? { title: patch.title } : {}),
          ...(patch.text !== undefined ? { text: patch.text } : {}),
        };
      }),
    },
  });
}

function currentPosterCanvas(document: ScheduleDocument) {
  return normalizePosterCanvas(document.posterCanvas ?? buildDefaultPosterCanvas(document), document);
}

function nextPosterComponentId(
  components: PosterComponent[],
  type: PosterComponentType,
  sourceId: string,
): string {
  const base = `${type}:${sourceId}`;
  let index = 1;
  let id = `${base}:${index}`;

  while (components.some((component) => component.id === id)) {
    index += 1;
    id = `${base}:${index}`;
  }

  return id;
}

function nextPosterZIndex(components: PosterComponent[]): number {
  return Math.max(0, ...components.map((component) => component.zIndex)) + 1;
}

function posterRectFromCenter(
  type: PosterComponentType,
  baseRect: PosterRect,
  center?: PosterDropCenter,
): PosterRect {
  return clampPosterComponentRect(
    type,
    center
      ? {
          ...baseRect,
          x: center.x - baseRect.w / 2,
          y: center.y - baseRect.h / 2,
        }
      : baseRect,
  );
}

function nextInfrastructureRoom(
  document: ScheduleDocument,
  roomType: BentoRoomTypeId,
  components: PosterComponent[],
): BentoRoomNode | null {
  const rooms = document.canvas.rooms.filter((room) => room.roomType === roomType);
  const usedRoomIds = new Set(
    components
      .filter((component) => component.type === "infrastructure" && component.roomNodeId)
      .map((component) => component.roomNodeId),
  );

  return rooms.find((room) => !usedRoomIds.has(room.roomNodeId)) ?? rooms[0] ?? null;
}

export function addPosterComponent(
  document: ScheduleDocument,
  kind: PosterComponentAddKind,
  center?: PosterDropCenter,
): ScheduleDocument {
  const posterCanvas = currentPosterCanvas(document);
  const view = buildPosterViewModel(document);
  const zIndex = nextPosterZIndex(posterCanvas.components);
  let component: PosterComponent | null = null;

  if (kind === "metric") {
    component = {
      id: nextPosterComponentId(posterCanvas.components, kind, "manual"),
      type: "metric",
      title: "产出摘要",
      text: view.metrics.map((metric) => `${metric.label}: ${metric.value}`).join(" / "),
      rect: posterRectFromCenter("metric", DEFAULT_POSTER_COMPONENT_RECTS.production, center),
      zIndex,
    };
  } else if (kind === "note") {
    component = {
      id: nextPosterComponentId(posterCanvas.components, kind, "manual"),
      type: "note",
      title: "文本备注",
      text: "自定义备注",
      rect: posterRectFromCenter("note", DEFAULT_POSTER_COMPONENT_RECTS.note, center),
      zIndex,
    };
  } else if (kind === "divider") {
    component = {
      id: nextPosterComponentId(posterCanvas.components, kind, "manual"),
      type: "divider",
      title: "分隔线",
      rect: posterRectFromCenter("divider", DEFAULT_POSTER_COMPONENT_RECTS.divider, center),
      zIndex,
    };
  }

  if (!component) {
    return document;
  }

  return stamp({
    ...document,
    posterCanvas: {
      ...posterCanvas,
      components: [...posterCanvas.components, component],
    },
  });
}

export function addInfrastructureComponent(
  document: ScheduleDocument,
  roomType: BentoRoomTypeId,
  center?: PosterDropCenter,
): ScheduleDocument {
  const documentWithRoom = document.canvas.rooms.some((room) => room.roomType === roomType)
    ? document
    : addRoom(document, roomType);

  const posterCanvas = currentPosterCanvas(documentWithRoom);
  const sourceRoom = nextInfrastructureRoom(documentWithRoom, roomType, posterCanvas.components);
  if (!sourceRoom) {
    return document;
  }

  const zIndex = nextPosterZIndex(posterCanvas.components);
  const component: PosterComponent = {
    id: nextPosterComponentId(posterCanvas.components, "infrastructure", `room:${sourceRoom.roomNodeId}`),
    type: "infrastructure",
    title: sourceRoom.label,
    roomNodeId: sourceRoom.roomNodeId,
    rect: posterRectFromCenter("infrastructure", DEFAULT_ROOM_RECT, center),
    zIndex,
  };

  return stamp({
    ...documentWithRoom,
    posterCanvas: {
      ...posterCanvas,
      components: [...posterCanvas.components, component],
    },
  });
}

export function duplicatePosterComponent(
  document: ScheduleDocument,
  componentId: string,
): ScheduleDocument {
  const posterCanvas = currentPosterCanvas(document);
  const source = posterCanvas.components.find((component) => component.id === componentId);
  if (!source) {
    return document;
  }

  const copy: PosterComponent = {
    ...source,
    id: nextPosterComponentId(posterCanvas.components, source.type, `${source.id}:copy`),
    rect: clampPosterRect({
      ...source.rect,
      x: source.rect.x + 360,
      y: source.rect.y + 360,
    }),
    zIndex: nextPosterZIndex(posterCanvas.components),
  };

  return stamp({
    ...document,
    posterCanvas: {
      ...posterCanvas,
      components: [...posterCanvas.components, copy],
    },
  });
}

export function deletePosterComponent(
  document: ScheduleDocument,
  componentId: string,
): ScheduleDocument {
  const posterCanvas = currentPosterCanvas(document);
  return stamp({
    ...document,
    posterCanvas: {
      ...posterCanvas,
      components: posterCanvas.components.filter((component) => component.id !== componentId),
    },
  });
}

export function movePosterComponentLayer(
  document: ScheduleDocument,
  componentId: string,
  direction: "up" | "down",
): ScheduleDocument {
  const posterCanvas = currentPosterCanvas(document);
  const zIndex =
    direction === "up"
      ? nextPosterZIndex(posterCanvas.components)
      : Math.min(0, ...posterCanvas.components.map((component) => component.zIndex)) - 1;

  return stamp({
    ...document,
    posterCanvas: {
      ...posterCanvas,
      components: posterCanvas.components.map((component) =>
        component.id === componentId ? { ...component, zIndex } : component,
      ),
    },
  });
}

function replaceRoom(document: ScheduleDocument, roomNodeId: string, nextRect: GridRect): ScheduleDocument {
  return stamp({
    ...document,
    canvas: {
      ...document.canvas,
      rooms: document.canvas.rooms.map((room) =>
        room.roomNodeId === roomNodeId ? { ...room, rect: nextRect } : room,
      ),
    },
  });
}

function canUpdateRoomRect(document: ScheduleDocument, roomNodeId: string, rect: GridRect): GridRect | null {
  const room = document.canvas.rooms.find((item) => item.roomNodeId === roomNodeId);
  if (!room) {
    return null;
  }

  const definition = bentoRoomDefinitions[room.roomType];
  const nextRect = clampRect(rect, definition.minSize, {
    maxSize: definition.maxSize,
    maxArea: "maxArea" in definition ? definition.maxArea : undefined,
  });
  const overlaps = document.canvas.rooms.some(
    (item) => item.roomNodeId !== roomNodeId && rectsOverlap(nextRect, item.rect),
  );

  return overlaps ? null : nextRect;
}

export function moveRoom(document: ScheduleDocument, roomNodeId: string, rect: GridRect): ScheduleDocument {
  const nextRect = canUpdateRoomRect(document, roomNodeId, rect);
  return nextRect ? replaceRoom(document, roomNodeId, nextRect) : document;
}

export function resizeRoom(document: ScheduleDocument, roomNodeId: string, rect: GridRect): ScheduleDocument {
  const room = document.canvas.rooms.find((item) => item.roomNodeId === roomNodeId);
  if (!room || !bentoRoomDefinitions[room.roomType].resizable) {
    return document;
  }

  const nextRect = canUpdateRoomRect(document, roomNodeId, rect);
  return nextRect ? replaceRoom(document, roomNodeId, nextRect) : document;
}

function roomPlacementCandidates(size: Pick<GridRect, "w" | "h">, center?: GridDropCenter): GridRect[] {
  const candidates: Array<{ rect: GridRect; distance: number }> = [];

  for (let y = 0; y <= BENTO_GRID.rows - size.h; y += 1) {
    for (let x = 0; x <= BENTO_GRID.columns - size.w; x += 1) {
      const rect = { x, y, w: size.w, h: size.h };
      const distance = center
        ? (x + size.w / 2 - center.x) ** 2 + (y + size.h / 2 - center.y) ** 2
        : y * BENTO_GRID.columns + x;

      candidates.push({ rect, distance });
    }
  }

  return candidates
    .sort((first, second) => first.distance - second.distance)
    .map((candidate) => candidate.rect);
}

function roomRectForDrop(
  document: ScheduleDocument,
  roomType: BentoRoomTypeId,
  baseRect: GridRect,
  center?: GridDropCenter,
): GridRect {
  const definition = bentoRoomDefinitions[roomType];
  const rect = clampRect(baseRect, definition.minSize, {
    maxSize: definition.maxSize,
    maxArea: "maxArea" in definition ? definition.maxArea : undefined,
  });
  const preferredRect = center
    ? clampRect(
        {
          ...rect,
          x: center.x - rect.w / 2,
          y: center.y - rect.h / 2,
        },
        definition.minSize,
        {
          maxSize: definition.maxSize,
          maxArea: "maxArea" in definition ? definition.maxArea : undefined,
        },
      )
    : rect;
  const candidates = center ? [preferredRect, ...roomPlacementCandidates(rect, center)] : roomPlacementCandidates(rect);

  return candidates.find((candidate) =>
    document.canvas.rooms.every((room) => !rectsOverlap(candidate, room.rect)),
  ) ?? rect;
}

export function addRoom(
  document: ScheduleDocument,
  roomType: BentoRoomTypeId,
  center?: GridDropCenter,
): ScheduleDocument {
  const required = getRequiredRoomCount(document.layoutId, roomType);
  const existing = document.canvas.rooms.filter((room) => room.roomType === roomType);
  if (existing.length >= required) {
    return document;
  }

  const roomIndex = Math.max(0, ...existing.map((room) => room.roomIndex)) + 1;
  const baseRoom = createBentoRoomNode(roomType, roomIndex);
  const rect = roomRectForDrop(document, roomType, baseRoom.rect, center);

  const nextRoom: BentoRoomNode = { ...baseRoom, rect };

  return stamp({
    ...document,
    canvas: {
      ...document.canvas,
      rooms: [...document.canvas.rooms, nextRoom],
    },
    queues: document.queues.map((queue) => ({
      ...queue,
      roomAssignments: [...queue.roomAssignments, createRoomAssignment(queue.id, nextRoom)],
    })),
  });
}

export function removeRoom(document: ScheduleDocument, roomNodeId: string): ScheduleDocument {
  if (!document.canvas.rooms.some((room) => room.roomNodeId === roomNodeId)) {
    return document;
  }

  const next: ScheduleDocument = {
    ...document,
    canvas: {
      ...document.canvas,
      rooms: document.canvas.rooms.filter((room) => room.roomNodeId !== roomNodeId),
    },
    queues: document.queues.map((queue) => ({
      ...queue,
      roomAssignments: queue.roomAssignments.filter((assignment) => assignment.roomNodeId !== roomNodeId),
    })),
  };

  return stamp({
    ...next,
    posterCanvas: next.posterCanvas ? normalizePosterCanvas(next.posterCanvas, next) : undefined,
  });
}

export function setRoomProduct(
  document: ScheduleDocument,
  roomNodeId: string,
  product?: ProductKind,
): ScheduleDocument {
  const room = document.canvas.rooms.find((item) => item.roomNodeId === roomNodeId);
  if (!room) {
    return document;
  }

  const nextProduct: ProductKind | undefined =
    room.roomType === "TRADING"
      ? product ?? "Money"
      : room.roomType === "MANUFACTURE"
        ? product ?? "PureGold"
        : undefined;

  if (room.roomType !== "TRADING" && room.roomType !== "MANUFACTURE") {
    return document;
  }

  return stamp({
    ...document,
    canvas: {
      ...document.canvas,
      rooms: document.canvas.rooms.map((room) =>
        room.roomNodeId === roomNodeId ? { ...room, product: nextProduct } : room,
      ),
    },
    queues: document.queues.map((queue) => ({
      ...queue,
      roomAssignments: queue.roomAssignments.map((assignment) =>
        assignment.roomNodeId === roomNodeId ? { ...assignment, product: nextProduct } : assignment,
      ),
    })),
  });
}

export function assignOperator(
  document: ScheduleDocument,
  queueId: string,
  assignmentId: string,
  slotIndex: number,
  operatorId: string,
): ScheduleDocument {
  return updateAssignment(document, queueId, assignmentId, (assignment) => ({
    ...assignment,
    operators: assignment.operators.map((slot) =>
      slot.slotIndex === slotIndex
        ? applySlotPayload(slot, { operatorId })
        : slot,
    ),
  }));
}

export function setSlotElitePhase(
  document: ScheduleDocument,
  queueId: string,
  assignmentId: string,
  slotIndex: number,
  elitePhase?: ElitePhase,
): ScheduleDocument {
  return updateAssignment(document, queueId, assignmentId, (assignment) => ({
    ...assignment,
    operators: assignment.operators.map((slot) =>
      slot.slotIndex === slotIndex
        ? applySlotPayload(slot, {
            operatorId: slot.operatorId,
            overrideName: slot.overrideName,
            elitePhase,
          })
        : slot,
    ),
  }));
}

export function clearSlot(
  document: ScheduleDocument,
  queueId: string,
  assignmentId: string,
  slotIndex: number,
): ScheduleDocument {
  return updateAssignment(document, queueId, assignmentId, (assignment) => ({
    ...assignment,
    operators: assignment.operators.map((slot) =>
      slot.slotIndex === slotIndex
        ? { slotIndex: slot.slotIndex, isOptional: slot.isOptional }
        : slot,
    ),
  }));
}

export function swapSlots(
  document: ScheduleDocument,
  source: SlotAddress,
  target: SlotAddress,
): ScheduleDocument {
  const sourceSlot = findSlot(document, source).slot;
  const targetSlot = findSlot(document, target).slot;

  if (!sourceSlot || !targetSlot) {
    return document;
  }

  let next = document;
  next = replaceSlotPayload(next, target, slotPayload(sourceSlot));
  next = replaceSlotPayload(next, source, slotPayload(targetSlot));
  return next;
}

export function updateMetadata(
  document: ScheduleDocument,
  patch: ScheduleMetadataPatch,
): ScheduleDocument {
  return stamp({
    ...document,
    ...patch,
    productionSummary: {
      ...document.productionSummary,
      ...patch.productionSummary,
    },
    droneSummary: {
      ...document.droneSummary,
      ...patch.droneSummary,
    },
  });
}

export function updateRoomEfficiencyLabels(
  document: ScheduleDocument,
  queueId: string,
  assignmentId: string,
  labels: { paperEfficiencyLabel?: string; effectiveEfficiencyLabel?: string; notes?: string[] },
): ScheduleDocument {
  return updateAssignment(document, queueId, assignmentId, (assignment) => ({
    ...assignment,
    paperEfficiencyLabel: labels.paperEfficiencyLabel ?? assignment.paperEfficiencyLabel,
    effectiveEfficiencyLabel: labels.effectiveEfficiencyLabel ?? assignment.effectiveEfficiencyLabel,
    notes: labels.notes ?? assignment.notes,
  }));
}

export function updateQueueLabels(
  document: ScheduleDocument,
  queueId: string,
  patch: { label?: string; durationLabel?: string },
): ScheduleDocument {
  return stamp({
    ...document,
    queues: document.queues.map((queue) =>
      queue.id === queueId
        ? {
            ...queue,
            label: patch.label ?? queue.label,
            durationLabel: patch.durationLabel ?? queue.durationLabel,
          }
        : queue,
    ),
  });
}

export function findIncompleteRoomTypes(document: ScheduleDocument): BentoRoomTypeId[] {
  return (Object.keys(bentoRoomDefinitions) as BentoRoomTypeId[]).filter((roomType) => {
    const placed = document.canvas.rooms.filter((room) => room.roomType === roomType).length;
    return placed < getRequiredRoomCount(document.layoutId, roomType);
  });
}
