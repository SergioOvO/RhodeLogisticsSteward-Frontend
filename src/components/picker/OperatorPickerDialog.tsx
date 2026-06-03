import { Dialog } from "@base-ui/react/dialog";
import { XIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { productFormulaMap } from "../../domain/bentoDefinitions";
import { filterOperators, type OperatorFilterState } from "../../domain/operatorFilters";
import { formatOperatorRarity } from "../../domain/operatorPresentation";
import type {
  BuildingReference,
  BuildingRoomTypeId,
  ElitePhase,
  Operator,
  ProductKind,
  ProductionFormulaTypeId,
  SlotAddress,
  SlotAssignment,
} from "../../domain/types";
import styles from "../../styles/editor.module.css";
import { ContourButton } from "../ui/ContourButton";

const ROOM_TYPE_LABEL: Record<string, string> = {
  CONTROL: "控制中枢",
  POWER: "发电站",
  MANUFACTURE: "制造站",
  TRADING: "贸易站",
  DORMITORY: "宿舍",
  HIRE: "办公室",
  MEETING: "会客室",
  TRAINING: "训练室",
  WORKSHOP: "加工站",
};

const FORMULA_TYPE_LABEL: Record<string, string> = {
  F_EXP: "作战记录",
  F_GOLD: "赤金",
  F_ASC: "芯片/双芯片",
  F_DIAMOND: "源石碎片", //源石碎片/合成玉
  F_BUILDING: "基建材料",
  F_EVOLVE: "精英化材料",
  F_SKILL: "技能材料",
};

interface OperatorPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operators: Operator[];
  reference: BuildingReference | null;
  assignedOperatorIds: Set<string>;
  selectedSlot: SlotAddress | null;
  selectedSlotAssignment: SlotAssignment | null;
  selectedRoomType?: string;
  selectedProduct?: ProductKind;
  onAssign: (operatorId: string) => void;
  onClear: () => void;
  onElitePhaseChange: (elitePhase?: ElitePhase) => void;
}

function parseElitePhase(value: string): ElitePhase | undefined {
  return value === "1" || value === "2" ? (Number(value) as ElitePhase) : undefined;
}

function isBuildingRoomType(value: string | undefined): value is BuildingRoomTypeId {
  return (
    value === "CONTROL" ||
    value === "POWER" ||
    value === "MANUFACTURE" ||
    value === "TRADING" ||
    value === "DORMITORY" ||
    value === "HIRE" ||
    value === "MEETING" ||
    value === "TRAINING" ||
    value === "WORKSHOP"
  );
}

function toggleValue<T extends string>(values: T[], value: T, checked: boolean): T[] {
  return checked ? [...values, value] : values.filter((item) => item !== value);
}

function createInitialFilters(selectedRoomType?: string, selectedProduct?: ProductKind): OperatorFilterState {
  const roomTypes = isBuildingRoomType(selectedRoomType) ? [selectedRoomType] : [];
  const formula = selectedProduct ? productFormulaMap[selectedProduct] : undefined;
  const formulaTypes = formula ? [formula] : [];

  return {
    text: "",
    roomTypes,
    formulaTypes,
    assignedOnly: false,
  };
}

export function OperatorPickerDialog({
  open,
  onOpenChange,
  operators,
  reference,
  assignedOperatorIds,
  selectedSlot,
  selectedSlotAssignment,
  selectedRoomType,
  selectedProduct,
  onAssign,
  onClear,
  onElitePhaseChange,
}: OperatorPickerDialogProps) {
  const [filters, setFilters] = useState<OperatorFilterState>(() =>
    createInitialFilters(selectedRoomType, selectedProduct),
  );
  const canEditElitePhase = Boolean(selectedSlotAssignment?.operatorId);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setFilters(createInitialFilters(selectedRoomType, selectedProduct));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [open, selectedProduct, selectedRoomType]);

  const filtered = useMemo(
    () => filterOperators(operators, reference, filters, assignedOperatorIds),
    [assignedOperatorIds, filters, operators, reference],
  );

  return (
    <Dialog.Root onOpenChange={(next) => onOpenChange(next)} open={open}>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.dialogBackdrop} />
        <Dialog.Popup className={styles.dialogPopup}>
          <Dialog.Title className={styles.dialogTitle}>
            {selectedSlot ? `选择干员 · 槽位 ${selectedSlot.slotIndex + 1}` : "选择干员"}
          </Dialog.Title>
          <div className={styles.dialogControls}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>搜索</span>
              <input
                autoFocus
                className={styles.textInput}
                onChange={(event) => setFilters((current) => ({ ...current, text: event.target.value }))}
                placeholder="名称 / alias"
                value={filters.text}
              />
            </label>
            {canEditElitePhase ? (
              <label className={styles.field}>
                <span className={styles.fieldLabel}>精英状态</span>
                <select
                  className={[styles.selectTrigger, styles.eliteSelect].join(" ")}
                  onChange={(event) => onElitePhaseChange(parseElitePhase(event.target.value))}
                  value={selectedSlotAssignment?.elitePhase ? String(selectedSlotAssignment.elitePhase) : "auto"}
                >
                  <option value="auto">自动</option>
                  <option value="1">精一</option>
                  <option value="2">精二</option>
                </select>
              </label>
            ) : null}
          </div>
          <div className={styles.dialogFilterBar}>
            <div className={styles.filterGroup}>
              <span className={styles.fieldLabel}>房间技能</span>
              <div className={styles.chipGrid}>
                {(reference?.roomTypes ?? []).map((roomType) => (
                  <label className={styles.chip} key={roomType.id}>
                    <input
                      checked={filters.roomTypes.includes(roomType.id)}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          roomTypes: toggleValue(current.roomTypes, roomType.id, event.target.checked),
                        }))
                      }
                      type="checkbox"
                    />
                    {roomType.label}
                  </label>
                ))}
              </div>
            </div>
            <div className={styles.filterGroup}>
              <span className={styles.fieldLabel}>产物公式</span>
              <div className={styles.chipGrid}>
                {(reference?.productionFormulaTypes ?? []).map((formulaType) => (
                  <label className={styles.chip} key={formulaType.id}>
                    <input
                      checked={filters.formulaTypes.includes(formulaType.id)}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          formulaTypes: toggleValue<ProductionFormulaTypeId>(
                            current.formulaTypes,
                            formulaType.id,
                            event.target.checked,
                          ),
                        }))
                      }
                      type="checkbox"
                    />
                    {formulaType.label}
                  </label>
                ))}
              </div>
            </div>
            <label className={styles.toggleRow}>
              <input
                checked={filters.assignedOnly}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, assignedOnly: event.target.checked }))
                }
                type="checkbox"
              />
              仅显示已上板干员
            </label>
          </div>
          <div className={styles.pickerGrid}>
            {filtered.map((operator) => (
              <button
                className={styles.pickerCard}
                data-operator-picker-card
                key={operator.id}
                onClick={() => {
                  onAssign(operator.id);
                  onOpenChange(false);
                }}
                type="button"
              >
                <span className={styles.pickerPortrait}>
                  {operator.portraitPath ? (
                    <img
                      alt=""
                      decoding="async"
                      height={180}
                      loading="lazy"
                      src={operator.portraitPath}
                      width={180}
                    />
                  ) : null}
                </span>
                <span>
                  <span className={styles.operatorCardName}>{operator.name}</span>
                  <span className={styles.operatorMeta}>
                    {operator.profession ?? "干员"} · {formatOperatorRarity(operator.rarity)}
                  </span>
                  <span className={styles.tagRow}>
                    {[...new Set(operator.buildingSkills.map((s) => ROOM_TYPE_LABEL[s.roomType] ?? s.roomType))]
                      .slice(0, 3)
                      .map((label) => (
                        <span className={styles.tag} key={`${operator.id}-room-${label}`}>
                          {label}
                        </span>
                      ))}
                    {[...new Set(
                      operator.buildingSkills.flatMap((s) => s.targetFormulaTypes.map((t) => FORMULA_TYPE_LABEL[t] ?? t)),
                    )]
                      .slice(0, 2)
                      .map((label) => (
                        <span className={styles.tag} key={`${operator.id}-formula-${label}`}>
                          {label}
                        </span>
                      ))}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className={styles.dialogActions}>
            <ContourButton
              icon={<XIcon />}
              onClick={() => {
                onClear();
                onOpenChange(false);
              }}
              size="sm"
              variant="red"
            >
              清空
            </ContourButton>
            <Dialog.Close render={<ContourButton size="sm" variant="white">关闭</ContourButton>} />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
