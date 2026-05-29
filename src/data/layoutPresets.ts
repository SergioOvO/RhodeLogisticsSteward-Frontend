import type { CanvasProfile, FacilityColumn, LayoutPreset, RoomTemplate } from "../domain/types";

const controlRoom: RoomTemplate = {
  roomId: "control-1",
  roomType: "CONTROL",
  roomIndex: 1,
  slotCount: 5,
  label: "控制中枢",
};

const powerRoom = (index: number): RoomTemplate => ({
  roomId: `power-${index}`,
  roomType: "POWER",
  roomIndex: index,
  slotCount: 1,
  label: `发电站 ${index}`,
});

const dormRoom = (index: number): RoomTemplate => ({
  roomId: `dormitory-${index}`,
  roomType: "DORMITORY",
  roomIndex: index,
  slotCount: 1,
  product: "Rest",
  label: `宿舍 ${index}`,
});

const tradeRoom = (index: number): RoomTemplate => ({
  roomId: `trading-${index}`,
  roomType: "TRADING",
  roomIndex: index,
  slotCount: 3,
  product: "Money",
  label: `贸易站 ${index}`,
});

const goldRoom = (index: number): RoomTemplate => ({
  roomId: `manufacture-gold-${index}`,
  roomType: "MANUFACTURE",
  roomIndex: index,
  slotCount: 3,
  product: "PureGold",
  label: `赤金 ${index}`,
});

const recordRoom = (index: number): RoomTemplate => ({
  roomId: `manufacture-record-${index}`,
  roomType: "MANUFACTURE",
  roomIndex: index,
  slotCount: 3,
  product: "CombatRecord",
  label: `经验 ${index}`,
});

const otherRooms: RoomTemplate[] = [
  {
    roomId: "reception-1",
    roomType: "MEETING",
    roomIndex: 1,
    slotCount: 2,
    label: "会客室",
  },
  {
    roomId: "office-1",
    roomType: "HIRE",
    roomIndex: 1,
    slotCount: 1,
    label: "办公室",
  },
  {
    roomId: "training-1",
    roomType: "TRAINING",
    roomIndex: 1,
    slotCount: 1,
    label: "训练室",
  },
];

const column = (column: FacilityColumn): FacilityColumn => column;

type ColumnWeights = Record<string, number>;

function canvasProfile(
  oneQueue: ColumnWeights,
  twoQueues: ColumnWeights,
  threeQueues: ColumnWeights,
): CanvasProfile {
  const slotColumns = {
    1: 1,
    2: 2,
    3: 3,
    5: 2,
  };

  return {
    slotColumns,
    queueProfiles: {
      1: {
        columnWeights: oneQueue,
        slotColumns,
        efficiencyWidth: 34,
        maxSlotSize: 58,
        slotGap: 3,
        compact: false,
      },
      2: {
        columnWeights: twoQueues,
        slotColumns,
        efficiencyWidth: 30,
        maxSlotSize: 46,
        slotGap: 2,
        compact: true,
      },
      3: {
        columnWeights: threeQueues,
        slotColumns,
        efficiencyWidth: 24,
        maxSlotSize: 42,
        slotGap: 2,
        compact: true,
      },
    },
  };
}

export const layoutPresets: LayoutPreset[] = [
  {
    id: "153",
    label: "153",
    buildingType: 153,
    defaultQueueCount: 3,
    columns: [
      column({
        id: "control",
        label: "控制",
        facility: "Control",
        theme: "control",
        roomsPerQueue: [controlRoom],
        widthWeight: 1.25,
      }),
      column({
        id: "trade",
        label: "贸易站",
        facility: "Trade",
        product: "Money",
        theme: "trade",
        roomsPerQueue: [tradeRoom(1)],
        widthWeight: 1.1,
      }),
      column({
        id: "gold",
        label: "赤金线",
        facility: "Mfg",
        product: "PureGold",
        theme: "gold",
        roomsPerQueue: [goldRoom(1)],
        widthWeight: 1.05,
      }),
      column({
        id: "record",
        label: "经验线",
        facility: "Mfg",
        product: "CombatRecord",
        theme: "record",
        roomsPerQueue: [recordRoom(1), recordRoom(2), recordRoom(3), recordRoom(4)],
        widthWeight: 3.05,
      }),
      column({
        id: "power",
        label: "电力",
        facility: "Power",
        theme: "other",
        roomsPerQueue: [powerRoom(1), powerRoom(2), powerRoom(3)],
        widthWeight: 1.15,
      }),
    ],
    canvasProfile: canvasProfile(
      { control: 1.2, trade: 1.18, gold: 1.95, record: 2.55, power: 1.0 },
      { control: 1.15, trade: 1.12, gold: 1.95, record: 2.65, power: 0.98 },
      { control: 1.08, trade: 1.05, gold: 1.98, record: 2.78, power: 0.9 },
    ),
    otherRooms,
  },
  {
    id: "243",
    label: "243",
    buildingType: 243,
    defaultQueueCount: 3,
    columns: [
      column({
        id: "control",
        label: "控制",
        facility: "Control",
        theme: "control",
        roomsPerQueue: [controlRoom],
        widthWeight: 1.2,
      }),
      column({
        id: "trade",
        label: "贸易站",
        facility: "Trade",
        product: "Money",
        theme: "trade",
        roomsPerQueue: [tradeRoom(1), tradeRoom(2)],
        widthWeight: 1.8,
      }),
      column({
        id: "gold",
        label: "赤金",
        facility: "Mfg",
        product: "PureGold",
        theme: "gold",
        roomsPerQueue: [goldRoom(1), goldRoom(2)],
        widthWeight: 1.8,
      }),
      column({
        id: "record",
        label: "经验",
        facility: "Mfg",
        product: "CombatRecord",
        theme: "record",
        roomsPerQueue: [recordRoom(1), recordRoom(2)],
        widthWeight: 1.8,
      }),
      column({
        id: "power",
        label: "电力/宿舍",
        facility: "Power",
        theme: "other",
        roomsPerQueue: [powerRoom(1), dormRoom(1), dormRoom(2)],
        widthWeight: 1.35,
      }),
    ],
    canvasProfile: canvasProfile(
      { control: 1.16, trade: 1.9, gold: 1.9, record: 1.9, power: 1.18 },
      { control: 1.12, trade: 1.95, gold: 1.95, record: 1.95, power: 1.08 },
      { control: 1.02, trade: 2.05, gold: 2.02, record: 2.02, power: 0.96 },
    ),
    otherRooms,
  },
  {
    id: "252",
    label: "252",
    buildingType: 252,
    defaultQueueCount: 3,
    columns: [
      column({
        id: "control",
        label: "控制",
        facility: "Control",
        theme: "control",
        roomsPerQueue: [controlRoom],
        widthWeight: 1.15,
      }),
      column({
        id: "trade",
        label: "贸易站",
        facility: "Trade",
        product: "Money",
        theme: "trade",
        roomsPerQueue: [tradeRoom(1), tradeRoom(2)],
        widthWeight: 1.7,
      }),
      column({
        id: "gold",
        label: "赤金",
        facility: "Mfg",
        product: "PureGold",
        theme: "gold",
        roomsPerQueue: [goldRoom(1), goldRoom(2)],
        widthWeight: 1.65,
      }),
      column({
        id: "record",
        label: "经验",
        facility: "Mfg",
        product: "CombatRecord",
        theme: "record",
        roomsPerQueue: [recordRoom(1), recordRoom(2), recordRoom(3)],
        widthWeight: 2.3,
      }),
      column({
        id: "power",
        label: "电力",
        facility: "Power",
        theme: "other",
        roomsPerQueue: [powerRoom(1), dormRoom(1)],
        widthWeight: 1.05,
      }),
    ],
    canvasProfile: canvasProfile(
      { control: 1.08, trade: 1.78, gold: 1.72, record: 2.45, power: 0.95 },
      { control: 1.02, trade: 1.78, gold: 1.72, record: 2.62, power: 0.88 },
      { control: 0.95, trade: 1.75, gold: 1.62, record: 2.82, power: 0.78 },
    ),
    otherRooms,
  },
  {
    id: "333",
    label: "333",
    buildingType: 333,
    defaultQueueCount: 3,
    columns: [
      column({
        id: "control",
        label: "控制",
        facility: "Control",
        theme: "control",
        roomsPerQueue: [controlRoom],
        widthWeight: 1.1,
      }),
      column({
        id: "trade",
        label: "贸易",
        facility: "Trade",
        product: "Money",
        theme: "trade",
        roomsPerQueue: [tradeRoom(1), tradeRoom(2), tradeRoom(3)],
        widthWeight: 2.35,
      }),
      column({
        id: "gold",
        label: "赤金",
        facility: "Mfg",
        product: "PureGold",
        theme: "gold",
        roomsPerQueue: [goldRoom(1)],
        widthWeight: 1.05,
      }),
      column({
        id: "record",
        label: "经验",
        facility: "Mfg",
        product: "CombatRecord",
        theme: "record",
        roomsPerQueue: [recordRoom(1), recordRoom(2)],
        widthWeight: 1.65,
      }),
      column({
        id: "power",
        label: "电力",
        facility: "Power",
        theme: "other",
        roomsPerQueue: [powerRoom(1), powerRoom(2), powerRoom(3)],
        widthWeight: 1.55,
      }),
    ],
    canvasProfile: canvasProfile(
      { control: 1.0, trade: 2.75, gold: 1.18, record: 1.82, power: 1.2 },
      { control: 0.95, trade: 2.95, gold: 1.12, record: 1.82, power: 1.08 },
      { control: 0.86, trade: 3.22, gold: 0.95, record: 1.72, power: 0.98 },
    ),
    otherRooms,
  },
  {
    id: "342",
    label: "342",
    buildingType: 342,
    defaultQueueCount: 3,
    columns: [
      column({
        id: "control",
        label: "控制",
        facility: "Control",
        theme: "control",
        roomsPerQueue: [controlRoom],
        widthWeight: 1.1,
      }),
      column({
        id: "trade",
        label: "贸易",
        facility: "Trade",
        product: "Money",
        theme: "trade",
        roomsPerQueue: [tradeRoom(1), tradeRoom(2), tradeRoom(3)],
        widthWeight: 2.35,
      }),
      column({
        id: "gold",
        label: "赤金",
        facility: "Mfg",
        product: "PureGold",
        theme: "gold",
        roomsPerQueue: [goldRoom(1), goldRoom(2)],
        widthWeight: 1.65,
      }),
      column({
        id: "record",
        label: "经验",
        facility: "Mfg",
        product: "CombatRecord",
        theme: "record",
        roomsPerQueue: [recordRoom(1), recordRoom(2)],
        widthWeight: 1.65,
      }),
      column({
        id: "power",
        label: "电力/宿舍",
        facility: "Power",
        theme: "other",
        roomsPerQueue: [powerRoom(1), powerRoom(2), dormRoom(1)],
        widthWeight: 1.35,
      }),
    ],
    canvasProfile: canvasProfile(
      { control: 1.0, trade: 2.72, gold: 1.75, record: 1.75, power: 1.1 },
      { control: 0.95, trade: 2.86, gold: 1.78, record: 1.78, power: 1.0 },
      { control: 0.86, trade: 3.02, gold: 1.72, record: 1.72, power: 0.92 },
    ),
    otherRooms,
  },
];

export function getLayoutPreset(layoutId: string): LayoutPreset {
  return layoutPresets.find((preset) => preset.id === layoutId) ?? layoutPresets[1];
}
