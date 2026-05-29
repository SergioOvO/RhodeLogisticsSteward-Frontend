import type {
  BuildingReference,
  Operator,
  OperatorBuildingSkill,
  ProductKind,
  ProductionFormulaTypeId,
} from "./types";

const formulaByProduct: Partial<Record<ProductKind, ProductionFormulaTypeId>> = {
  CombatRecord: "F_EXP",
  OriginStone: "F_DIAMOND",
  PureGold: "F_GOLD",
};

function matchesOperator(skill: OperatorBuildingSkill, operator: Operator): boolean {
  return (
    skill.operatorId === operator.id ||
    skill.operatorName === operator.name ||
    operator.aliases.includes(skill.operatorId) ||
    operator.aliases.includes(skill.operatorName)
  );
}

function phaseValue(phase: string): number {
  const match = phase.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function matchesRoomProduct(
  skill: OperatorBuildingSkill,
  roomType: string,
  product?: string,
): boolean {
  if (skill.roomType !== roomType) {
    return false;
  }

  const formula = formulaByProduct[product as ProductKind];
  if (!formula) {
    return true;
  }

  return skill.targetFormulaTypes.length === 0 || skill.targetFormulaTypes.includes(formula);
}

export function getRelevantOperatorSkills(
  reference: BuildingReference | null,
  operator: Operator,
  roomType: string,
  product?: string,
): OperatorBuildingSkill[] {
  if (!reference) {
    return [];
  }

  const roomProductMatches = reference.operatorSkills.filter(
    (skill) => matchesOperator(skill, operator) && matchesRoomProduct(skill, roomType, product),
  );

  if (roomProductMatches.length > 0) {
    return roomProductMatches;
  }

  return reference.operatorSkills.filter(
    (skill) => matchesOperator(skill, operator) && skill.roomType === roomType,
  );
}

export function getRequiredElitePhase(
  reference: BuildingReference | null,
  operator: Operator | undefined,
  roomType: string,
  product?: string,
): number {
  if (!operator) {
    return 0;
  }

  return getRelevantOperatorSkills(reference, operator, roomType, product).reduce(
    (highest, skill) => Math.max(highest, phaseValue(skill.conditionPhase)),
    0,
  );
}

export function formatOperatorRarity(rarity: number | undefined, fallback = "rarity ?"): string {
  return typeof rarity === "number" ? `${rarity + 1}★` : fallback;
}
