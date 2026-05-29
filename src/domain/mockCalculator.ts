import { getLayoutPreset } from "../data/layoutPresets";
import type { DroneSummary, ProductionSummary, RoomAssignment, ScheduleDocument } from "./types";

function hasAssignedName(slot: RoomAssignment["operators"][number]): boolean {
  return Boolean(slot.operatorId || slot.overrideName?.trim());
}

export function calculateRoomPaperEfficiency(assignment: RoomAssignment): string {
  if (assignment.paperEfficiencyLabel.trim()) {
    return assignment.paperEfficiencyLabel;
  }

  const filled = assignment.operators.filter(hasAssignedName).length;
  const base = assignment.roomType === "CONTROL" ? 7 : assignment.roomType === "POWER" ? 5 : 18;
  return `纸面 +${base + filled * 12}%`;
}

export function calculateRoomEffectiveEfficiency(assignment: RoomAssignment): string {
  if (assignment.effectiveEfficiencyLabel.trim()) {
    return assignment.effectiveEfficiencyLabel;
  }

  const filled = assignment.operators.filter(hasAssignedName).length;
  const base = assignment.product === "Money" ? 82 : assignment.product === "CombatRecord" ? 76 : 68;
  return `折算 ${Math.min(140, base + filled * 9)}%`;
}

export function calculateProductionSummary(document: ScheduleDocument): ProductionSummary {
  if (document.productionSummary.customLine?.includes("手动")) {
    return document.productionSummary;
  }

  const preset = getLayoutPreset(document.layoutId);
  const roomCount = preset.columns.reduce((sum, column) => sum + column.roomsPerQueue.length, 0);
  const filledSlots = document.queues.reduce(
    (sum, queue) =>
      sum +
      queue.roomAssignments.reduce(
        (queueSum, assignment) =>
          queueSum + assignment.operators.filter(hasAssignedName).length,
        0,
      ),
    0,
  );
  const multiplier = Math.max(1, document.queueCount);
  const order = ((roomCount + filledSlots * 0.22) * multiplier * 0.18).toFixed(2);
  const gold = ((roomCount + filledSlots * 0.18) * multiplier * 0.13).toFixed(2);
  const record = ((roomCount + filledSlots * 0.2) * multiplier * 0.24).toFixed(2);

  return {
    ...document.productionSummary,
    orderText: `订单 ${order}w`,
    goldText: `赤金 ${gold}w`,
    recordText: `经验 ${record}w`,
    customLine: document.productionSummary.customLine ?? "mock 估算，非真实游戏公式",
  };
}

export function calculateDroneSummary(document: ScheduleDocument): DroneSummary {
  if (!document.droneSummary.enabled) {
    return document.droneSummary;
  }

  const value = (document.queueCount * 0.21 + document.queues.length * 0.13).toFixed(2);

  return {
    ...document.droneSummary,
    summaryText: `无人机加速：${document.droneSummary.targetRoomLabel} 模拟 +${value}w 订单等效`,
  };
}

export function withMockCalculations(document: ScheduleDocument): ScheduleDocument {
  return {
    ...document,
    productionSummary: calculateProductionSummary(document),
    droneSummary: calculateDroneSummary(document),
  };
}
