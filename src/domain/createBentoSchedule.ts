/** @fileoverview 根据 layoutId + queueCount 创建新 ScheduleDocument，含默认房间和队列。 */

import { bentoRoomDefinitions, BENTO_GRID, expandBentoLayout, isBentoLayoutId } from "./bentoDefinitions";
import { packRooms } from "./bentoGrid";
import { clampQueueCount } from "./queueLimits";
import type {
  BentoRoomNode,
  BentoRoomTypeId,
  ProductKind,
  RoomAssignment,
  ScheduleDocument,
  ScheduleQueue,
  SlotAssignment,
} from "./types";

const defaultLabels = {
  title: "罗德岛基建排班表",
  author: "Rhode Logistics Steward",
} as const;

function roomNodeId(roomType: BentoRoomTypeId, roomIndex: number): string {
  return `${roomType.toLowerCase()}-${roomIndex}`;
}

function roomLabel(roomType: BentoRoomTypeId, roomIndex: number): string {
  const definition = bentoRoomDefinitions[roomType];
  return roomType === "CONTROL" || roomType === "MEETING" || roomType === "HIRE"
    ? definition.label
    : `${definition.label} ${roomIndex}`;
}

function defaultManufactureProduct(layoutId: string, roomIndex: number): ProductKind {
  const goldRoomCounts: Record<string, number> = {
    "153": 1,
    "243": 2,
    "252": 2,
    "333": 1,
    "342": 2,
  };

  return roomIndex <= (goldRoomCounts[layoutId] ?? 2) ? "PureGold" : "CombatRecord";
}

export function createBentoRoomNode(roomType: BentoRoomTypeId, roomIndex: number): BentoRoomNode {
  const definition = bentoRoomDefinitions[roomType];

  return {
    roomNodeId: roomNodeId(roomType, roomIndex),
    roomType,
    roomIndex,
    label: roomLabel(roomType, roomIndex),
    slotCount: definition.slotCount,
    product: "defaultProduct" in definition ? definition.defaultProduct : undefined,
    rect: { x: 0, y: 0, ...definition.defaultSize },
  };
}

function createRooms(layoutId: string): BentoRoomNode[] {
  const ordinals: Partial<Record<BentoRoomTypeId, number>> = {};
  const rooms = expandBentoLayout(layoutId).map((roomType) => {
    const roomIndex = (ordinals[roomType] ?? 0) + 1;
    ordinals[roomType] = roomIndex;
    const room = createBentoRoomNode(roomType, roomIndex);
    return roomType === "MANUFACTURE"
      ? { ...room, product: defaultManufactureProduct(layoutId, roomIndex) }
      : room;
  });
  const packed = packRooms(
    rooms.map((room) => {
      const definition = bentoRoomDefinitions[room.roomType];
      return {
        ...room,
        defaultSize: definition.defaultSize,
        minSize: definition.minSize,
        maxSize: definition.maxSize,
        maxArea: "maxArea" in definition ? definition.maxArea : undefined,
      };
    }),
  );

  return packed.map((room) => ({
    roomNodeId: room.roomNodeId,
    roomType: room.roomType,
    roomIndex: room.roomIndex,
    label: room.label,
    slotCount: room.slotCount,
    product: room.product,
    rect: room.rect,
  }));
}

export function createRoomAssignment(queueId: string, room: BentoRoomNode): RoomAssignment {
  const operators: SlotAssignment[] = Array.from({ length: room.slotCount }, (_, slotIndex) => ({
    slotIndex,
  }));

  return {
    assignmentId: `${queueId}-${room.roomNodeId}`,
    roomNodeId: room.roomNodeId,
    roomType: room.roomType,
    roomIndex: room.roomIndex,
    product: room.product,
    operators,
    paperEfficiencyLabel: "",
    effectiveEfficiencyLabel: "",
    notes: [],
  };
}

export function createBentoSchedule(layoutId = "243", queueCount?: number): ScheduleDocument {
  const normalizedLayout = isBentoLayoutId(layoutId) ? layoutId : "243";
  const count = clampQueueCount(queueCount ?? 3);
  const rooms = createRooms(normalizedLayout);
  const queues: ScheduleQueue[] = Array.from({ length: count }, (_, index) => {
    const queueId = `queue-${index + 1}`;

    return {
      id: queueId,
      label: `队列 ${index + 1}`,
      durationLabel: index === 0 ? "早班" : index === 1 ? "晚班" : `轮换 ${index + 1}`,
      roomAssignments: rooms.map((room) => createRoomAssignment(queueId, room)),
    };
  });

  return {
    version: 2,
    title: defaultLabels.title,
    subtitle: `${normalizedLayout} 基建轮换方案 | 设施画布`,
    authorText: defaultLabels.author,
    layoutId: normalizedLayout,
    queueCount: count,
    activeQueueId: queues[0]?.id ?? "queue-1",
    posterTemplateId: "auto",
    posterMode: "normal",
    canvas: {
      grid: BENTO_GRID,
      rooms,
    },
    queues,
    productionSummary: {
      orderText: "订单 0.00w",
      goldText: "赤金 0.00w",
      recordText: "经验 0.00w",
      customLine: "生产数值为前端估算，等待真实计算器接入",
    },
    droneSummary: {
      enabled: true,
      targetRoomLabel: "贸易站 1",
      summaryText: "无人机加速：模拟 0.00w 订单 / 0.00w 赤金 / 0.00w 经验",
    },
    notes: ["点击设施空位选择干员；房间可在画布上拖拽和拉伸。"],
    updatedAt: new Date().toISOString(),
  };
}

export function cloneRoomWithProduct(room: BentoRoomNode, product?: ProductKind): BentoRoomNode {
  return {
    ...room,
    product,
  };
}
