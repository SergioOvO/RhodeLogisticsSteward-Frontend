/** @fileoverview ScheduleDocument → 海报视图模型（sections/lanes/blocks），供默认布局和旧 section 渲染使用。 */

import { calculateRoomEffectiveEfficiency, calculateRoomPaperEfficiency } from "./mockCalculator";
import {
  normalizePosterMode,
  normalizePosterTemplateId,
  POSTER_GRID,
} from "./posterDefinitions";
import type {
  BentoRoomNode,
  PosterGrid,
  PosterMode,
  PosterTemplateId,
  ProductKind,
  RoomAssignment,
  ScheduleDocument,
  ScheduleQueue,
  SlotAssignment,
} from "./types";

export { POSTER_GRID } from "./posterDefinitions";

export type ConcretePosterTemplateId = Exclude<PosterTemplateId, "auto">;

export type PosterSectionKind =
  | "control"
  | "trade"
  | "gold"
  | "record"
  | "jadeManufacture"
  | "jadeTrade"
  | "power"
  | "other";

export interface PosterLane {
  id: string;
  label: string;
  durationLabel: string;
  queueId?: string;
}

export interface PosterMetric {
  label: string;
  value: string;
}

export interface PosterBlock {
  id: string;
  laneId: string;
  queueId?: string;
  assignmentId?: string;
  roomNodeId: string;
  roomType: string;
  roomIndex: number;
  label: string;
  product?: ProductKind;
  operators: SlotAssignment[];
  paperEfficiencyLabel: string;
  effectiveEfficiencyLabel: string;
  notes: string[];
}

export interface PosterSection {
  id: string;
  title: string;
  kind: PosterSectionKind;
  product?: ProductKind;
  blocks: PosterBlock[];
}

export interface PosterViewModel {
  requestedTemplateId: PosterTemplateId;
  templateId: ConcretePosterTemplateId;
  mode: PosterMode;
  grid: PosterGrid;
  title: string;
  subtitle: string;
  authorText: string;
  layoutId: string;
  queueCount: number;
  lanes: PosterLane[];
  sections: PosterSection[];
  metrics: PosterMetric[];
  notes: string[];
}

interface SectionMeta {
  id: string;
  title: string;
  kind: PosterSectionKind;
  product?: ProductKind;
}

const sectionOrder = [
  "control",
  "trade",
  "jade-trade",
  "gold",
  "record",
  "jade-manufacture",
  "power",
  "other",
];

const comboLabels = ["A", "B", "C", "A+B", "A+C", "B+C"] as const;

function concreteTemplateId(
  requestedTemplateId: PosterTemplateId,
  mode: PosterMode,
  queueCount: number,
): ConcretePosterTemplateId {
  if (requestedTemplateId !== "auto") {
    return requestedTemplateId;
  }

  if (mode === "combo") {
    return "combo";
  }

  if (mode === "autoRotation" || mode === "dailyRotation") {
    return "card";
  }

  return queueCount === 2 ? "splitPanel" : "matrix";
}

function hasOriginStoneManufacturing(document: ScheduleDocument): boolean {
  return (
    document.canvas.rooms.some((room) => room.roomType === "MANUFACTURE" && room.product === "OriginStone") ||
    document.queues.some((queue) =>
      queue.roomAssignments.some(
        (assignment) => assignment.roomType === "MANUFACTURE" && assignment.product === "OriginStone",
      ),
    )
  );
}

function sectionMetaForRoom(
  room: BentoRoomNode,
  document: ScheduleDocument,
  hasOriginStone: boolean,
): SectionMeta {
  if (room.roomType === "CONTROL") {
    return { id: "control", title: "中枢", kind: "control" };
  }

  if (room.roomType === "TRADING") {
    const tradingCount = document.canvas.rooms.filter((candidate) => candidate.roomType === "TRADING").length;
    if (hasOriginStone && tradingCount >= 3 && room.roomIndex === tradingCount) {
      return { id: "jade-trade", title: "玉贸易", kind: "jadeTrade", product: "Money" };
    }
    return { id: "trade", title: "贸易", kind: "trade", product: "Money" };
  }

  if (room.roomType === "MANUFACTURE") {
    if (room.product === "OriginStone") {
      return {
        id: "jade-manufacture",
        title: "搓玉制造",
        kind: "jadeManufacture",
        product: "OriginStone",
      };
    }

    if (room.product === "CombatRecord") {
      return { id: "record", title: "经验", kind: "record", product: "CombatRecord" };
    }

    return { id: "gold", title: "赤金", kind: "gold", product: "PureGold" };
  }

  if (room.roomType === "POWER") {
    return { id: "power", title: "发电", kind: "power" };
  }

  return { id: "other", title: "其他", kind: "other" };
}

function assignmentForRoom(queue: ScheduleQueue, room: BentoRoomNode): RoomAssignment | undefined {
  return queue.roomAssignments.find((assignment) => assignment.roomNodeId === room.roomNodeId);
}

function blockForAssignment(
  queue: ScheduleQueue,
  lane: PosterLane,
  room: BentoRoomNode,
  assignment: RoomAssignment,
): PosterBlock {
  return {
    id: `${lane.id}:${assignment.assignmentId}`,
    laneId: lane.id,
    queueId: queue.id,
    assignmentId: assignment.assignmentId,
    roomNodeId: room.roomNodeId,
    roomType: assignment.roomType,
    roomIndex: assignment.roomIndex,
    label: room.label,
    product: room.roomType === "TRADING" ? "Money" : assignment.product,
    operators: assignment.operators,
    paperEfficiencyLabel: calculateRoomPaperEfficiency(assignment),
    effectiveEfficiencyLabel: calculateRoomEffectiveEfficiency(assignment),
    notes: assignment.notes,
  };
}

function normalLanes(document: ScheduleDocument): PosterLane[] {
  return document.queues.map((queue, index) => ({
    id: queue.id,
    queueId: queue.id,
    label: queue.label || `队列 ${index + 1}`,
    durationLabel: queue.durationLabel,
  }));
}

function comboLanes(document: ScheduleDocument): PosterLane[] {
  return comboLabels.map((label, index) => ({
    id: `combo-${label.toLowerCase().replace("+", "")}`,
    queueId: index < document.queues.length ? document.queues[index]?.id : undefined,
    label,
    durationLabel: index < 3 ? document.queues[index]?.durationLabel ?? "组合" : "组合",
  }));
}

function buildSections(document: ScheduleDocument, lanes: PosterLane[], mode: PosterMode): PosterSection[] {
  const hasOriginStone = hasOriginStoneManufacturing(document);
  const sections = new Map<string, PosterSection>();
  const sourceLanes = mode === "combo" ? lanes.slice(0, 3) : lanes;

  for (const room of document.canvas.rooms) {
    const meta = sectionMetaForRoom(room, document, hasOriginStone);
    const section = sections.get(meta.id) ?? {
      id: meta.id,
      title: meta.title,
      kind: meta.kind,
      product: meta.product,
      blocks: [],
    };

    for (const lane of sourceLanes) {
      if (!lane.queueId) {
        continue;
      }

      const queue = document.queues.find((candidate) => candidate.id === lane.queueId);
      const assignment = queue ? assignmentForRoom(queue, room) : undefined;
      if (queue && assignment) {
        section.blocks.push(blockForAssignment(queue, lane, room, assignment));
      }
    }

    sections.set(meta.id, section);
  }

  return [...sections.values()].sort(
    (first, second) => sectionOrder.indexOf(first.id) - sectionOrder.indexOf(second.id),
  );
}

function productionMetric(document: ScheduleDocument): string {
  return [document.productionSummary.orderText, document.productionSummary.goldText, document.productionSummary.recordText]
    .filter(Boolean)
    .join("、");
}

export function buildPosterViewModel(document: ScheduleDocument): PosterViewModel {
  const requestedTemplateId = normalizePosterTemplateId(document.posterTemplateId);
  const mode = normalizePosterMode(document.posterMode);
  const templateId = concreteTemplateId(requestedTemplateId, mode, document.queueCount);
  const lanes = mode === "combo" ? comboLanes(document) : normalLanes(document);

  return {
    requestedTemplateId,
    templateId,
    mode,
    grid: POSTER_GRID,
    title: document.title,
    subtitle: document.subtitle,
    authorText: document.authorText,
    layoutId: document.layoutId,
    queueCount: document.queueCount,
    lanes,
    sections: buildSections(document, lanes, mode),
    metrics: [
      { label: "预计产出", value: productionMetric(document) },
      { label: "无人机加速", value: document.droneSummary.summaryText },
    ],
    notes: [
      ...(document.productionSummary.customLine ? [document.productionSummary.customLine] : []),
      ...document.notes,
    ],
  };
}
