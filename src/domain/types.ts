export type FacilityKind =
  | "Control"
  | "Trade"
  | "Mfg"
  | "Power"
  | "Reception"
  | "Office"
  | "Dormitory"
  | "Other";

export type ProductKind =
  | "Money"
  | "PureGold"
  | "CombatRecord"
  | "OriginStone"
  | "General"
  | "HR"
  | "Rest";

export type FacilityTheme = "control" | "trade" | "gold" | "record" | "other";

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
    generatedAt: string;
    metadataRows: number;
    portraitFiles: number;
    professionIconFiles: number;
    rarityIconFiles: number;
    eliteIconFiles: number;
    warnings: string[];
  };
  operators: Operator[];
}

export interface RoomTemplate {
  roomId: string;
  roomType: string;
  roomIndex: number;
  slotCount: number;
  product?: string;
  label?: string;
}

export interface FacilityColumn {
  id: string;
  label: string;
  facility: FacilityKind;
  product?: ProductKind;
  theme: FacilityTheme;
  roomsPerQueue: RoomTemplate[];
  widthWeight: number;
}

export interface CanvasQueueProfile {
  columnWeights: Record<string, number>;
  slotColumns: Record<number, number>;
  efficiencyWidth: number;
  maxSlotSize: number;
  slotGap: number;
  compact: boolean;
}

export interface CanvasProfile {
  queueProfiles: Record<number, CanvasQueueProfile>;
  slotColumns: Record<number, number>;
}

export interface LayoutPreset {
  id: string;
  label: string;
  buildingType: number;
  defaultQueueCount: number;
  columns: FacilityColumn[];
  canvasProfile: CanvasProfile;
  otherRooms: RoomTemplate[];
}

export interface SlotAssignment {
  slotIndex: number;
  operatorId?: string;
  overrideName?: string;
  elitePhase?: ElitePhase;
  isOptional?: boolean;
}

export interface RoomAssignment {
  assignmentId: string;
  roomType: string;
  roomIndex: number;
  product?: string;
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
  version: 1;
  title: string;
  subtitle: string;
  authorText: string;
  layoutId: string;
  queueCount: number;
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
