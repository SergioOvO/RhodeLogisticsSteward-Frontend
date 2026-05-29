import { createDefaultSchedule } from "../domain/createDefaultSchedule";
import type { Operator, RoomAssignment, ScheduleDocument, SlotAssignment } from "../domain/types";

type MaaRoomKey =
  | "control"
  | "trading"
  | "manufacture"
  | "power"
  | "dormitory"
  | "meeting"
  | "hire"
  | "training";

interface MaaRoom {
  skip?: boolean;
  product?: string;
  operators?: string[];
  sort?: boolean;
  autofill?: boolean;
}

interface MaaPlan {
  name?: string;
  description?: string;
  period?: [string, string][];
  drones?: {
    room?: string;
    index?: number;
    enable?: boolean;
    order?: string;
  };
  rooms?: Partial<Record<MaaRoomKey, MaaRoom[]>>;
}

interface MaaCustomInfrast {
  title?: string;
  author?: string;
  description?: string;
  planTimes?: string;
  plans?: MaaPlan[];
}

export interface MaaImportReport {
  document: ScheduleDocument;
  unmatchedOperatorNames: string[];
  importedPlanCount: number;
  skippedPlanCount: number;
  dronePlanCount: number;
}

const MAX_IMPORT_PLAN_COUNT = 3;

const productMap: Record<string, string> = {
  lmd: "Money",
  "pure gold": "PureGold",
  puregold: "PureGold",
  "battle record": "CombatRecord",
  battlerecord: "CombatRecord",
  originstone: "OriginStone",
  "origin stone": "OriginStone",
};

const roomTypeMap: Partial<Record<MaaRoomKey, string>> = {
  control: "CONTROL",
  trading: "TRADING",
  manufacture: "MANUFACTURE",
  power: "POWER",
  dormitory: "DORMITORY",
  meeting: "MEETING",
  hire: "HIRE",
  training: "TRAINING",
};

function isMaaCustomInfrast(value: unknown): value is MaaCustomInfrast {
  const candidate = value as MaaCustomInfrast;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    Array.isArray(candidate.plans) &&
    candidate.plans.some((plan) => typeof plan === "object" && plan !== null && plan.rooms)
  );
}

function activeRoomCount(rooms: MaaRoom[] | undefined): number {
  return rooms?.filter((room) => !room.skip).length ?? 0;
}

function inferLayoutId(plans: MaaPlan[]): string {
  const counts = plans.reduce(
    (maxCounts, plan) => ({
      trading: Math.max(maxCounts.trading, activeRoomCount(plan.rooms?.trading)),
      manufacture: Math.max(maxCounts.manufacture, activeRoomCount(plan.rooms?.manufacture)),
      power: Math.max(maxCounts.power, activeRoomCount(plan.rooms?.power)),
    }),
    { trading: 0, manufacture: 0, power: 0 },
  );
  const inferred = `${counts.trading}${counts.manufacture}${counts.power}`;

  return ["153", "243", "252", "333", "342"].includes(inferred) ? inferred : "243";
}

function normalizeKey(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function normalizeProduct(product?: string): string | undefined {
  if (!product) {
    return undefined;
  }
  return productMap[normalizeKey(product)] ?? product.trim();
}

function operatorNameMap(operators: Operator[]): Map<string, Operator> {
  const map = new Map<string, Operator>();
  for (const operator of operators) {
    map.set(normalizeKey(operator.name), operator);
    map.set(normalizeKey(operator.id), operator);
    for (const alias of operator.aliases) {
      map.set(normalizeKey(alias), operator);
    }
  }
  return map;
}

function setOperators(
  assignment: RoomAssignment,
  names: string[],
  operatorsByName: Map<string, Operator>,
  unmatchedOperatorNames: Set<string>,
): RoomAssignment {
  const slots: SlotAssignment[] = assignment.operators.map((slot, index) => {
    const name = names[index]?.trim();
    if (!name) {
      return { slotIndex: slot.slotIndex, isOptional: slot.isOptional };
    }

    const operator = operatorsByName.get(normalizeKey(name));
    if (!operator) {
      unmatchedOperatorNames.add(name);
    }

    return {
      slotIndex: slot.slotIndex,
      ...(operator ? { operatorId: operator.id } : { overrideName: name }),
      ...(slot.isOptional !== undefined ? { isOptional: slot.isOptional } : {}),
    };
  });

  return {
    ...assignment,
    operators: slots,
  };
}

function findAssignment(
  assignments: RoomAssignment[],
  roomType: string,
  roomIndex: number,
  product?: string,
): RoomAssignment | undefined {
  return assignments.find(
    (assignment) =>
      assignment.roomType === roomType &&
      assignment.roomIndex === roomIndex &&
      (assignment.product ?? "") === (product ?? ""),
  );
}

function applyRoomList(
  assignments: RoomAssignment[],
  key: MaaRoomKey,
  rooms: MaaRoom[] | undefined,
  operatorsByName: Map<string, Operator>,
  unmatchedOperatorNames: Set<string>,
): RoomAssignment[] {
  if (!rooms?.length) {
    return assignments;
  }

  const roomType = roomTypeMap[key];
  if (!roomType) {
    return assignments;
  }

  const productOrdinals = new Map<string, number>();
  return rooms.reduce((current, room, index) => {
    if (room.skip) {
      return current;
    }

    const product = normalizeProduct(room.product);
    const productKey = `${roomType}:${product ?? ""}`;
    const nextOrdinal = (productOrdinals.get(productKey) ?? 0) + 1;
    productOrdinals.set(productKey, nextOrdinal);

    const roomIndex = roomType === "MANUFACTURE" || roomType === "TRADING" ? nextOrdinal : index + 1;
    const target = findAssignment(current, roomType, roomIndex, product);
    if (!target) {
      return current;
    }

    return current.map((assignment) =>
      assignment.assignmentId === target.assignmentId
        ? setOperators(assignment, room.operators ?? [], operatorsByName, unmatchedOperatorNames)
        : assignment,
    );
  }, assignments);
}

function queueDuration(plan: MaaPlan, index: number): string {
  const period = plan.period?.[0];
  if (period) {
    return `${period[0]}-${period[1]}`;
  }
  if (plan.description) {
    return plan.description;
  }
  return index === 0 ? "第一班" : index === 1 ? "第二班" : `轮换 ${index + 1}`;
}

function droneRoomLabel(room?: string): string {
  if (room === "manufacture") {
    return "制造站";
  }
  if (room === "trading") {
    return "贸易站";
  }
  return "目标房间";
}

function describeDrone(plan: MaaPlan): string | null {
  const drones = plan.drones;
  if (!drones || drones.enable === false) {
    return null;
  }

  return `${droneRoomLabel(drones.room)} ${drones.index ?? 1}，${drones.order ?? "pre"}`;
}

function droneSummary(plans: MaaPlan[]): ScheduleDocument["droneSummary"] {
  const droneDescriptions = plans
    .map((plan, index) => {
      const description = describeDrone(plan);
      return description ? `${plan.name ?? `轮换 ${index + 1}`}: ${description}` : null;
    })
    .filter((item): item is string => Boolean(item));

  if (!droneDescriptions.length) {
    return {
      enabled: false,
      targetRoomLabel: "未配置",
      summaryText: "无人机加速未配置",
    };
  }

  if (droneDescriptions.length === 1) {
    return {
      enabled: true,
      targetRoomLabel: droneDescriptions[0].replace(/^.*: /, ""),
      summaryText: `无人机加速：${droneDescriptions[0]}`,
    };
  }

  return {
    enabled: true,
    targetRoomLabel: "按班次配置",
    summaryText: `无人机加速按班次配置：${droneDescriptions.join("；")}`,
  };
}

export function maaCustomInfrastToScheduleImport(
  value: unknown,
  operators: Operator[],
): MaaImportReport | null {
  if (!isMaaCustomInfrast(value)) {
    return null;
  }

  const sourcePlans = value.plans ?? [];
  const plans = sourcePlans.slice(0, MAX_IMPORT_PLAN_COUNT);
  const layoutId = inferLayoutId(sourcePlans);
  const document = createDefaultSchedule(layoutId, Math.max(1, plans.length));
  const operatorsByName = operatorNameMap(operators);
  const unmatchedOperatorNames = new Set<string>();

  const importedDocument: ScheduleDocument = {
    ...document,
    title: value.title ?? document.title,
    subtitle: `${layoutId} MAA 基建排班图`,
    authorText: value.author ?? document.authorText,
    queues: document.queues.map((queue, index) => {
      const plan = plans[index];
      if (!plan?.rooms) {
        return queue;
      }

      let roomAssignments = queue.roomAssignments;
      roomAssignments = applyRoomList(roomAssignments, "control", plan.rooms.control, operatorsByName, unmatchedOperatorNames);
      roomAssignments = applyRoomList(roomAssignments, "trading", plan.rooms.trading, operatorsByName, unmatchedOperatorNames);
      roomAssignments = applyRoomList(roomAssignments, "manufacture", plan.rooms.manufacture, operatorsByName, unmatchedOperatorNames);
      roomAssignments = applyRoomList(roomAssignments, "power", plan.rooms.power, operatorsByName, unmatchedOperatorNames);
      roomAssignments = applyRoomList(roomAssignments, "dormitory", plan.rooms.dormitory, operatorsByName, unmatchedOperatorNames);
      roomAssignments = applyRoomList(roomAssignments, "meeting", plan.rooms.meeting, operatorsByName, unmatchedOperatorNames);
      roomAssignments = applyRoomList(roomAssignments, "hire", plan.rooms.hire, operatorsByName, unmatchedOperatorNames);
      roomAssignments = applyRoomList(roomAssignments, "training", plan.rooms.training, operatorsByName, unmatchedOperatorNames);

      return {
        ...queue,
        label: plan.name ?? queue.label,
        durationLabel: queueDuration(plan, index),
        roomAssignments,
      };
    }),
    productionSummary: {
      ...document.productionSummary,
      customLine: "由 MAA custom_infrast JSON 导入，仅用于排班图展示",
    },
    droneSummary: droneSummary(plans),
    notes: value.description ? value.description.split("\n").filter(Boolean).slice(0, 3) : document.notes,
    updatedAt: new Date().toISOString(),
  };

  return {
    document: importedDocument,
    unmatchedOperatorNames: [...unmatchedOperatorNames].sort((left, right) => left.localeCompare(right)),
    importedPlanCount: plans.length,
    skippedPlanCount: Math.max(0, sourcePlans.length - plans.length),
    dronePlanCount: plans.filter((plan) => Boolean(describeDrone(plan))).length,
  };
}

export function maaCustomInfrastToScheduleDocument(
  value: unknown,
  operators: Operator[],
): ScheduleDocument | null {
  return maaCustomInfrastToScheduleImport(value, operators)?.document ?? null;
}
