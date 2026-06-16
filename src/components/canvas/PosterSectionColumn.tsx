import { useMemo } from "react";
import {
  calculateRoomEffectiveEfficiency,
  calculateRoomPaperEfficiency,
} from "../../domain/mockCalculator";
import type { PosterColumnDef } from "../../domain/posterCanvas";
import type {
  BuildingReference,
  Operator,
  ProductKind,
  ScheduleDocument,
  SlotAddress,
} from "../../domain/types";
import {
  manufactureProductOptions,
  productLabel,
  tradingProductOptions,
} from "../../domain/bentoDefinitions";
import styles from "../../styles/PosterCanvas.module.css";
import { EditableText } from "./EditableText";
import { PosterOperatorSlot } from "./PosterOperatorSlot";

interface PosterSectionColumnProps {
  document: ScheduleDocument;
  column: PosterColumnDef;
  operators: Operator[];
  reference: BuildingReference | null;
  selectedSlot: SlotAddress | null;
  onSlotSelect: (address: SlotAddress) => void;
  onRoomProductChange: (roomNodeId: string, product?: ProductKind) => void;
  onRoomEfficiencyLabelsChange?: (
    queueId: string,
    assignmentId: string,
    labels: { paperEfficiencyLabel?: string; effectiveEfficiencyLabel?: string },
  ) => void;
}

export function PosterSectionColumn({
  document,
  column,
  operators,
  reference,
  selectedSlot,
  onSlotSelect,
  onRoomProductChange,
  onRoomEfficiencyLabelsChange,
}: PosterSectionColumnProps) {
  const operatorMap = useMemo(
    () => new Map(operators.map((operator) => [operator.id, operator])),
    [operators],
  );

  return (
    <div className={styles.posterFacilityGroupBody} style={{ gridTemplateRows: "minmax(0, 1fr)" }}>
      <div
        className={styles.posterSectionRows}
        style={{
          "--poster-lane-count": document.queues.length,
          "--poster-room-stack-size": column.roomNodeIds.length,
        } as React.CSSProperties & Record<`--${string}`, string | number>}
      >
        {document.queues.map((queue) => (
          <div className={styles.posterSectionLane} key={queue.id}>
            {column.roomNodeIds.map((roomNodeId) => {
              const room = document.canvas.rooms.find((candidate) => candidate.roomNodeId === roomNodeId);
              const assignment = queue.roomAssignments.find((item) => item.roomNodeId === roomNodeId);
              if (!room || !assignment) return null;

              const slotRows =
                room.roomType === "CONTROL"
                  ? [assignment.operators.slice(0, 3), assignment.operators.slice(3)]
                  : [assignment.operators];

              return (
                <article className={styles.posterRoomBlock} data-product={room.product} data-room-type={room.roomType} key={roomNodeId}>
                  <div className={styles.posterRoomHeader}>
                    <span>{room.label}</span>
                    {room.roomType === "MANUFACTURE" ? (
                      <select
                        className={styles.posterProductSelect}
                        onChange={(e) => onRoomProductChange(room.roomNodeId, e.target.value as ProductKind)}
                        onPointerDown={(e) => e.stopPropagation()}
                        value={room.product ?? ""}
                      >
                        {manufactureProductOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : room.roomType === "TRADING" ? (
                      <select
                        className={styles.posterProductSelect}
                        onChange={(e) => onRoomProductChange(room.roomNodeId, e.target.value as ProductKind)}
                        onPointerDown={(e) => e.stopPropagation()}
                        value={room.product ?? ""}
                      >
                        {tradingProductOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span>{productLabel(room.product)}</span>
                    )}
                  </div>
                  <div className={styles.posterSlotRows}>
                    {slotRows.map((rowSlots, rowIndex) => (
                      <div className={styles.posterSlots} key={rowIndex}>
                        {rowSlots.map((slot) => {
                          const address = {
                            queueId: queue.id,
                            assignmentId: assignment.assignmentId,
                            slotIndex: slot.slotIndex,
                          };
                          const operator = slot.operatorId ? operatorMap.get(slot.operatorId) : undefined;

                          return (
                            <PosterOperatorSlot
                              address={address}
                              key={slot.slotIndex}
                              onSelect={onSlotSelect}
                              operator={operator}
                              product={assignment.product}
                              reference={reference}
                              roomType={room.roomType}
                              selected={
                                selectedSlot?.queueId === address.queueId &&
                                selectedSlot.assignmentId === address.assignmentId &&
                                selectedSlot.slotIndex === address.slotIndex
                              }
                              slot={slot}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  {(() => {
                    const vert = room.roomType === "TRADING" || room.roomType === "MANUFACTURE" || room.roomType === "POWER";
                    const sep = vert ? "\n" : "  ";
                    const stored = assignment.paperEfficiencyLabel.trim();
                    const display = stored || `${calculateRoomPaperEfficiency(assignment)}${sep}${calculateRoomEffectiveEfficiency(assignment)}`;

                    return (
                      <div className={styles.posterEfficiency}>
                        <EditableText
                          ariaLabel={`编辑 ${room.label} 效率`}
                          className={styles.posterEfficiencyText}
                          multiline
                          onCommit={(text) => {
                            if (!text.trim()) {
                              onRoomEfficiencyLabelsChange?.(queue.id, assignment.assignmentId, {
                                paperEfficiencyLabel: "",
                                effectiveEfficiencyLabel: "",
                              });
                            } else {
                              onRoomEfficiencyLabelsChange?.(queue.id, assignment.assignmentId, {
                                paperEfficiencyLabel: text,
                              });
                            }
                          }}
                          value={display}
                        />
                      </div>
                    );
                  })()}
                </article>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
