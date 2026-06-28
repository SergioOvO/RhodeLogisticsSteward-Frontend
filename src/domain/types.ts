/** @fileoverview 核心数据模型：ScheduleDocument、BentoRoomNode、PosterComponent 等类型定义。 */

export type ProductKind =
  | "Money"
  | "PureGold"
  | "CombatRecord"
  | "OriginStone"
  | "General"
  | "HR"
  | "Rest";

export type BuildingRoomTypeId =
  | "CONTROL"
  | "POWER"
  | "MANUFACTURE"
  | "TRADING"
  | "DORMITORY"
  | "HIRE"
  | "MEETING"
  | "TRAINING"
  | "WORKSHOP";

export type BentoRoomTypeId =
  | "CONTROL"
  | "TRADING"
  | "MANUFACTURE"
  | "POWER"
  | "MEETING"
  | "HIRE";

export type BentoRoomColorRole = "trade" | "manufacture" | "power" | "other";

export type PosterTemplateId = "auto" | "matrix" | "splitPanel" | "card" | "combo";

export type PosterMode = "normal" | "autoRotation" | "dailyRotation" | "combo";

export type ProductionFormulaTypeId =
  | "F_EXP"
  | "F_GOLD"
  | "F_ASC"
  | "F_DIAMOND"
  | "F_BUILDING"
  | "F_EVOLVE"
  | "F_SKILL";

export type ElitePhase = 1 | 2;

export interface Operator {
  id: string;
  name: string;
  portraitPath: string;
  professionIconPath?: string;
  rarityIconPath?: string;
  aliases: string[];
  tags: string[];
  profession?: string;
  subProfession?: string;
  rarity?: number;
  source: "avatars" | "mock";
}

export interface OperatorManifest {
  source: {
    localSourcePath: string;
    metadataRows: number;
    portraitFiles: number;
    professionIconFiles: number;
    rarityIconFiles: number;
    eliteIconFiles: number;
    warnings: string[];
  };
  operators: Operator[];
}

export interface SlotAssignment {
  slotIndex: number;
  operatorId?: string;
  overrideName?: string;
  elitePhase?: ElitePhase;
  isOptional?: boolean;
}

export interface GridRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BentoCanvasGrid {
  columns: 6;
  rows: 4;
}

export interface PosterGrid {
  columns: 12;
  rows: 6;
}

export type PosterComponentType =
  | "infrastructure"
  | "laneLabel"
  | "metric"
  | "note"
  | "divider";

export interface PosterRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PosterComponent {
  id: string;
  type: PosterComponentType;
  title: string;
  rect: PosterRect;
  zIndex: number;
  roomNodeId?: string;
  roomType?: BentoRoomTypeId;
  sectionId?: string;
  laneId?: string;
  metricId?: string;
  text?: string;
}

export interface PosterCanvasState {
  schemaVersion: 2;
  sourceTemplateId: Exclude<PosterTemplateId, "auto">;
  components: PosterComponent[];
}

export interface BentoRoomNode {
  roomNodeId: string;
  roomType: BentoRoomTypeId;
  roomIndex: number;
  label: string;
  slotCount: number;
  product?: ProductKind;
  rect: GridRect;
}

export interface BentoCanvasState {
  grid: BentoCanvasGrid;
  rooms: BentoRoomNode[];
}

export interface RoomAssignment {
  assignmentId: string;
  roomNodeId: string;
  roomType: string;
  roomIndex: number;
  product?: ProductKind;
  operators: SlotAssignment[];
  paperEfficiencyLabel: string;
  effectiveEfficiencyLabel: string;
  notes: string[];
}

export interface ScheduleQueue {
  id: string;
  label: string;
  durationLabel: string;
  roomAssignments: RoomAssignment[];
}

export interface ProductionSummary {
  orderText: string;
  goldText: string;
  recordText: string;
  originStoneText?: string;
  customLine?: string;
}

export interface DroneSummary {
  enabled: boolean;
  targetRoomLabel: string;
  summaryText: string;
}

export interface ScheduleDocument {
  version: 2;
  title: string;
  subtitle: string;
  authorText: string;
  layoutId: string;
  queueCount: number;
  activeQueueId: string;
  posterTemplateId?: PosterTemplateId;
  posterMode?: PosterMode;
  posterCanvas?: PosterCanvasState;
  canvas: BentoCanvasState;
  queues: ScheduleQueue[];
  productionSummary: ProductionSummary;
  droneSummary: DroneSummary;
  notes: string[];
  updatedAt: string;
}

export interface BuildingReferenceSource {
  localSourcePath: string;
  upstreamRepository: string;
  upstreamCommit: string;
  generatedAt: string;
  rowCounts: Record<string, number>;
}

export interface BuildingRoomTypeOption {
  id: BuildingRoomTypeId;
  label: string;
  sourceRoomId?: string;
  operatorCount: number;
  skillRowCount: number;
}

export interface ProductionFormulaTypeOption {
  id: ProductionFormulaTypeId;
  label: string;
  sources: ("manufacturing" | "workshop")[];
  buffTypeIds: string[];
  itemNames: string[];
  skillTargetCount: number;
}

export interface OperatorBuildingSkill {
  operatorId: string;
  operatorName: string;
  roomType: BuildingRoomTypeId;
  buffId: string;
  buffName: string;
  descriptionText: string;
  targetFormulaTypes: ProductionFormulaTypeId[];
  conditionPhase: string;
  conditionLevel: number;
}

export interface BuildingSkillDefinition {
  buffId: string;
  buffName: string;
  roomType: BuildingRoomTypeId;
  descriptionText: string;
  efficiency: number;
  targetFormulaTypes: ProductionFormulaTypeId[];
}

export interface BuildingReference {
  source: BuildingReferenceSource;
  roomTypes: BuildingRoomTypeOption[];
  productionFormulaTypes: ProductionFormulaTypeOption[];
  operatorSkills: OperatorBuildingSkill[];
  skillsById: Record<string, BuildingSkillDefinition>;
}

export interface SlotAddress {
  queueId: string;
  assignmentId: string;
  slotIndex: number;
}
