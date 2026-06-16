import { useDraggable, useDroppable } from "@dnd-kit/core";
import { formatOperatorRarity, getRequiredElitePhase } from "../../domain/operatorPresentation";
import type {
  BuildingReference,
  ElitePhase,
  Operator,
  SlotAddress,
  SlotAssignment,
} from "../../domain/types";
import styles from "../../styles/PosterCanvas.module.css";
import { OperatorPortrait } from "../shared/OperatorPortrait";

const eliteIconPaths: Record<ElitePhase, string> = {
  1: "/operators/elite/图标_升级_精英化1.webp",
  2: "/operators/elite/图标_升级_精英化2.webp",
};

interface PosterOperatorSlotProps {
  slot: SlotAssignment;
  address: SlotAddress;
  operator?: Operator;
  reference: BuildingReference | null;
  roomType: string;
  product?: string;
  selected: boolean;
  onSelect: (address: SlotAddress) => void;
}

function initials(name: string): string {
  return name.slice(0, 2).toLocaleUpperCase();
}

export function PosterOperatorSlot({
  slot,
  address,
  operator,
  reference,
  roomType,
  product,
  selected,
  onSelect,
}: PosterOperatorSlotProps) {
  const slotId = `poster-slot:${address.queueId}:${address.assignmentId}:${address.slotIndex}`;
  const requiredElitePhase = getRequiredElitePhase(reference, operator, roomType, product);
  const displayElitePhase: ElitePhase | undefined = operator
    ? slot.elitePhase ?? (requiredElitePhase >= 2 ? 2 : requiredElitePhase >= 1 ? 1 : undefined)
    : undefined;
  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: slotId,
    data: { type: "slot", address },
  });
  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({
    id: `assigned:${slotId}`,
    data: { type: "assigned", address, operator, operatorId: operator?.id },
    disabled: !operator?.id,
  });

  return (
    <button
      {...(operator?.id ? attributes : {})}
      {...(operator?.id ? listeners : {})}
      aria-label={operator ? `编辑 ${operator.name}` : "选择干员"}
      className={styles.posterSlot}
      data-filled={Boolean(operator)}
      data-over={isOver}
      data-portrait-slot
      data-poster-slot
      data-selected={selected}
      onClick={() => onSelect(address)}
      ref={(node) => {
        setDropRef(node);
        setDragRef(node);
      }}
      type="button"
    >
      {operator ? (
        <>
          <span className={styles.posterPortrait} data-portrait-frame>
            <OperatorPortrait
              eliteAlt={displayElitePhase ? `精英化 ${displayElitePhase}` : undefined}
              eliteIconPath={displayElitePhase ? eliteIconPaths[displayElitePhase] : undefined}
              fallbackText={initials(operator.name)}
              portraitPath={operator.portraitPath}
              professionAlt={operator.profession ?? ""}
              professionIconPath={operator.professionIconPath}
              rarityIconPath={operator.rarityIconPath}
              variant="tile"
            />
          </span>
          <span className={styles.posterSlotName}>
            <span>{slot.overrideName ?? operator.name}</span>
            <span>{formatOperatorRarity(operator.rarity, "")}</span>
          </span>
        </>
      ) : (
        <span aria-hidden="true" className={styles.posterEmptySlotAdd} data-empty-slot-add>
          +
        </span>
      )}
    </button>
  );
}
