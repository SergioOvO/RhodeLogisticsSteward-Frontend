import { useDraggable } from "@dnd-kit/core";
import { DotsSixVerticalIcon } from "@phosphor-icons/react";
import { OperatorPortrait } from "../shared/OperatorPortrait";
import type { Dispatch, SetStateAction } from "react";
import { filterOperators, type OperatorFilterState } from "../../domain/operatorFilters";
import type { BuildingReference, Operator, SlotAddress } from "../../domain/types";
import styles from "../../styles/editor.module.css";

interface OperatorPanelProps {
  operators: Operator[];
  reference: BuildingReference | null;
  filters: OperatorFilterState;
  setFilters: Dispatch<SetStateAction<OperatorFilterState>>;
  assignedOperatorIds: Set<string>;
  selectedSlot: SlotAddress | null;
  onAssignToSelected: (operatorId: string) => void;
}

function DraggableOperatorCard({
  operator,
  selectedSlot,
  onAssignToSelected,
}: {
  operator: Operator;
  selectedSlot: SlotAddress | null;
  onAssignToSelected: (operatorId: string) => void;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `operator:${operator.id}`,
    data: { type: "operator", operator, operatorId: operator.id },
  });

  return (
    <button
      {...attributes}
      {...listeners}
      className={styles.operatorCard}
      data-operator-pool-card
      data-rarity={operator.rarity}
      onClick={() => {
        if (selectedSlot) {
          onAssignToSelected(operator.id);
        }
      }}
      ref={setNodeRef}
      type="button"
    >
      <span className={styles.operatorPortraitFrame}>
        <OperatorPortrait
          fallbackText={operator.name.slice(0, 2)}
          portraitPath={operator.portraitPath}
          professionIconPath={operator.professionIconPath}
          rarityIconPath={operator.rarityIconPath}
        />
      </span>
      <span className={styles.operatorCardName}>
        {operator.name}
        <span className={styles.operatorMeta}>
          <DotsSixVerticalIcon size={10} /> {operator.profession ?? "干员"}
        </span>
      </span>
    </button>
  );
}

export function OperatorPanel({
  operators,
  reference,
  filters,
  setFilters,
  assignedOperatorIds,
  selectedSlot,
  onAssignToSelected,
}: OperatorPanelProps) {
  const filtered = filterOperators(operators, reference, filters, assignedOperatorIds);

  return (
    <aside className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>干员池</h2>
        <span className={styles.countPill}>{filtered.length} / {operators.length}</span>
      </div>
      <div className={styles.panelBody}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>搜索</span>
          <input
            className={styles.textInput}
            onChange={(event) => setFilters((current) => ({ ...current, text: event.target.value }))}
            placeholder="名称 / alias"
            value={filters.text}
          />
        </label>
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
                      roomTypes: event.target.checked
                        ? [...current.roomTypes, roomType.id]
                        : current.roomTypes.filter((id) => id !== roomType.id),
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
                      formulaTypes: event.target.checked
                        ? [...current.formulaTypes, formulaType.id]
                        : current.formulaTypes.filter((id) => id !== formulaType.id),
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
        <div className={styles.operatorGrid}>
          {filtered.map((operator) => (
            <DraggableOperatorCard
              key={operator.id}
              onAssignToSelected={onAssignToSelected}
              operator={operator}
              selectedSlot={selectedSlot}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
