import type {
  BentoRoomColorRole,
  BentoRoomTypeId,
  GridRect,
  ProductKind,
  ProductionFormulaTypeId,
} from "./types";

export const BENTO_GRID = {
  columns: 6,
  rows: 4,
} as const;

export const bentoLayoutIds = ["153", "243", "252", "333", "342"] as const;

export type BentoLayoutId = (typeof bentoLayoutIds)[number];

export interface BentoLayoutCounts {
  TRADING: number;
  MANUFACTURE: number;
  POWER: number;
  CONTROL: 1;
  MEETING: 1;
  HIRE: 1;
}

export interface BentoRoomDefinition {
  label: string;
  slotCount: number;
  colorRole: BentoRoomColorRole;
  defaultProduct?: ProductKind;
  defaultSize: Pick<GridRect, "w" | "h">;
  minSize: Pick<GridRect, "w" | "h">;
  maxSize: Pick<GridRect, "w" | "h">;
  maxArea?: number;
  resizable: boolean;
}

export const fixedBentoRooms = ["CONTROL", "MEETING", "HIRE"] as const satisfies readonly BentoRoomTypeId[];

export const excludedBentoRoomTypes = [
  "DORMITORY",
  "TRAINING",
  "WORKSHOP",
  "PRIVATE",
  "ELEVATOR",
  "CORRIDOR",
] as const;

export const bentoRoomDefinitions = {
  CONTROL: {
    label: "控制中枢",
    slotCount: 5,
    colorRole: "other",
    defaultSize: { w: 2, h: 1 },
    minSize: { w: 2, h: 1 },
    maxSize: { w: 3, h: 3 },
    maxArea: 6,
    resizable: true,
  },
  TRADING: {
    label: "贸易站",
    slotCount: 3,
    colorRole: "trade",
    defaultProduct: "Money",
    defaultSize: { w: 1, h: 1 },
    minSize: { w: 1, h: 1 },
    maxSize: { w: 2, h: 2 },
    resizable: true,
  },
  MANUFACTURE: {
    label: "制造站",
    slotCount: 3,
    colorRole: "manufacture",
    defaultProduct: "PureGold",
    defaultSize: { w: 1, h: 1 },
    minSize: { w: 1, h: 1 },
    maxSize: { w: 2, h: 2 },
    resizable: true,
  },
  POWER: {
    label: "发电站",
    slotCount: 1,
    colorRole: "power",
    defaultSize: { w: 1, h: 1 },
    minSize: { w: 1, h: 1 },
    maxSize: { w: 1, h: 1 },
    resizable: false,
  },
  MEETING: {
    label: "会客室",
    slotCount: 2,
    colorRole: "other",
    defaultSize: { w: 1, h: 1 },
    minSize: { w: 1, h: 1 },
    maxSize: { w: 1, h: 1 },
    resizable: false,
  },
  HIRE: {
    label: "办公室",
    slotCount: 1,
    colorRole: "other",
    defaultSize: { w: 1, h: 1 },
    minSize: { w: 1, h: 1 },
    maxSize: { w: 1, h: 1 },
    resizable: false,
  },
} as const satisfies Record<BentoRoomTypeId, BentoRoomDefinition>;

export const productFormulaMap: Partial<Record<ProductKind, ProductionFormulaTypeId>> = {
  PureGold: "F_GOLD",
  CombatRecord: "F_EXP",
  OriginStone: "F_DIAMOND",
};

export function isBentoLayoutId(value: string): value is BentoLayoutId {
  return bentoLayoutIds.includes(value as BentoLayoutId);
}

export function getBentoLayoutCounts(layoutId: string): BentoLayoutCounts {
  const normalized = isBentoLayoutId(layoutId) ? layoutId : "243";

  return {
    CONTROL: 1,
    TRADING: Number(normalized[0]),
    MANUFACTURE: Number(normalized[1]),
    POWER: Number(normalized[2]),
    MEETING: 1,
    HIRE: 1,
  };
}

export function getRequiredRoomCount(layoutId: string, roomType: BentoRoomTypeId): number {
  return getBentoLayoutCounts(layoutId)[roomType];
}

export function getRequiredTotalRoomCount(layoutId: string): number {
  const counts = getBentoLayoutCounts(layoutId);
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

export function expandBentoLayout(layoutId: string): BentoRoomTypeId[] {
  const counts = getBentoLayoutCounts(layoutId);
  return [
    "CONTROL",
    ...Array.from({ length: counts.TRADING }, () => "TRADING" as const),
    ...Array.from({ length: counts.MANUFACTURE }, () => "MANUFACTURE" as const),
    ...Array.from({ length: counts.POWER }, () => "POWER" as const),
    "MEETING",
    "HIRE",
  ];
}

export function productLabel(product?: ProductKind): string {
  if (product === "Money") return "龙门币";
  if (product === "PureGold") return "赤金";
  if (product === "CombatRecord") return "经验";
  if (product === "OriginStone") return "源石碎片";
  return "";
}

export const manufactureProductOptions = [
  { value: "PureGold" as const, label: "赤金" },
  { value: "CombatRecord" as const, label: "作战记录" },
  { value: "OriginStone" as const, label: "源石碎片" },
];

export const tradingProductOptions = [
  { value: "Money" as const, label: "龙门币" },
  { value: "OriginStone" as const, label: "合成玉" },
];
