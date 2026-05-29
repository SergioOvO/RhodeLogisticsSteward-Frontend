import { Dialog } from "@base-ui/react/dialog";
import { XIcon } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { filterOperators, type OperatorFilterState } from "../../domain/operatorFilters";
import { formatOperatorRarity } from "../../domain/operatorPresentation";
import type {
  BuildingReference,
  ElitePhase,
  Operator,
  SlotAddress,
  SlotAssignment,
} from "../../domain/types";
import styles from "../../styles/editor.module.css";
import { ContourButton } from "../ui/ContourButton";

interface OperatorPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operators: Operator[];
  reference: BuildingReference | null;
  baseFilters: OperatorFilterState;
  assignedOperatorIds: Set<string>;
  selectedSlot: SlotAddress | null;
  selectedSlotAssignment: SlotAssignment | null;
  onAssign: (operatorId: string) => void;
  onClear: () => void;
  onElitePhaseChange: (elitePhase?: ElitePhase) => void;
}

function parseElitePhase(value: string): ElitePhase | undefined {
  return value === "1" || value === "2" ? Number(value) as ElitePhase : undefined;
}

export function OperatorPickerDialog({
  open,
  onOpenChange,
  operators,
  reference,
  baseFilters,
  assignedOperatorIds,
  selectedSlot,
  selectedSlotAssignment,
  onAssign,
  onClear,
  onElitePhaseChange,
}: OperatorPickerDialogProps) {
  const [search, setSearch] = useState("");
  const canEditElitePhase = Boolean(selectedSlotAssignment?.operatorId);
  const filtered = useMemo(
    () =>
      filterOperators(
        operators,
        reference,
        {
          ...baseFilters,
          text: search,
          assignedOnly: false,
        },
        assignedOperatorIds,
      ),
    [assignedOperatorIds, baseFilters, operators, reference, search],
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
                onChange={(event) => setSearch(event.target.value)}
                placeholder="中文名 / English / file stem"
                value={search}
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
          <div className={styles.pickerGrid}>
            {filtered.map((operator) => (
              <button
                className={styles.pickerCard}
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
                    {operator.buildingSkills.slice(0, 3).map((skill) => (
                      <span className={styles.tag} key={`${operator.id}-${skill.buffId}`}>
                        {skill.roomType}
                      </span>
                    ))}
                    {operator.buildingSkills
                      .flatMap((skill) => skill.targetFormulaTypes)
                      .slice(0, 2)
                      .map((formulaType) => (
                        <span className={styles.tag} key={`${operator.id}-${formulaType}`}>
                          {formulaType}
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
