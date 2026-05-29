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

const productMap: Record<string, string> = {
  LMD: "Money",
  "Pure Gold": "PureGold",
  "Battle Record": "CombatRecord",
  OriginStone: "OriginStone",
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

function inferLayoutId(plans: MaaPlan[]): string {
  const firstRooms = plans.find((plan) => plan.rooms)?.rooms;
  const tradeCount = firstRooms?.trading?.filter((room) => !room.skip).length ?? 0;
  const manufactureCount = firstRooms?.manufacture?.filter((room) => !room.skip).length ?? 0;
  const powerCount = firstRooms?.power?.filter((room) => !room.skip).length ?? 0;
  const inferred = `${tradeCount}${manufactureCount}${powerCount}`;

  return ["153", "243", "252", "333", "342"].includes(inferred) ? inferred : "243";
}

function normalizeProduct(product?: string): string | undefined {
  if (!product) {
    return undefined;
  }
  return productMap[product] ?? product;
}

function operatorNameMap(operators: Operator[]): Map<string, Operator> {
  const map = new Map<string, Operator>();
  for (const operator of operators) {
    map.set(operator.name, operator);
    map.set(operator.id, operator);
    for (const alias of operator.aliases) {
      map.set(alias, operator);
    }
  }
  return map;
}

function setOperators(
  assignment: RoomAssignment,
  names: string[],
  operatorsByName: Map<string, Operator>,
): RoomAssignment {
  const slots: SlotAssignment[] = assignment.operators.map((slot, index) => {
    const name = names[index];
    if (!name) {
      return { slotIndex: slot.slotIndex, isOptional: slot.isOptional };
    }

    const operator = operatorsByName.get(name);
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
        ? setOperators(assignment, room.operators ?? [], operatorsByName)
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
  return index === 0 ? "早班" : index === 1 ? "晚班" : `轮换 ${index + 1}`;
}

function droneSummary(plan: MaaPlan): ScheduleDocument["droneSummary"] {
  const drones = plan.drones;
  if (!drones?.enable && drones?.enable !== undefined) {
    return {
      enabled: false,
      targetRoomLabel: "未启用",
      summaryText: "无人机加速未启用",
    };
  }

  const roomLabel = drones?.room === "manufacture" ? "制造站" : drones?.room === "trading" ? "贸易站" : "目标房间";
  return {
    enabled: Boolean(drones),
    targetRoomLabel: drones ? `${roomLabel} ${drones.index ?? 1}` : "未指定",
    summaryText: drones ? `无人机加速：${roomLabel} ${drones.index ?? 1}，${drones.order ?? "pre"}` : "无人机加速未指定",
  };
}

export function maaCustomInfrastToScheduleDocument(
  value: unknown,
  operators: Operator[],
): ScheduleDocument | null {
  if (!isMaaCustomInfrast(value)) {
    return null;
  }

  const plans = value.plans?.slice(0, 3) ?? [];
  const layoutId = inferLayoutId(plans);
  const document = createDefaultSchedule(layoutId, Math.max(1, plans.length));
  const operatorsByName = operatorNameMap(operators);

  return {
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
      roomAssignments = applyRoomList(roomAssignments, "control", plan.rooms.control, operatorsByName);
      roomAssignments = applyRoomList(roomAssignments, "trading", plan.rooms.trading, operatorsByName);
      roomAssignments = applyRoomList(roomAssignments, "manufacture", plan.rooms.manufacture, operatorsByName);
      roomAssignments = applyRoomList(roomAssignments, "power", plan.rooms.power, operatorsByName);
      roomAssignments = applyRoomList(roomAssignments, "dormitory", plan.rooms.dormitory, operatorsByName);
      roomAssignments = applyRoomList(roomAssignments, "meeting", plan.rooms.meeting, operatorsByName);
      roomAssignments = applyRoomList(roomAssignments, "hire", plan.rooms.hire, operatorsByName);
      roomAssignments = applyRoomList(roomAssignments, "training", plan.rooms.training, operatorsByName);

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
    droneSummary: droneSummary(plans[0] ?? {}),
    notes: value.description ? value.description.split("\n").filter(Boolean).slice(0, 3) : document.notes,
    updatedAt: new Date().toISOString(),
  };
}
