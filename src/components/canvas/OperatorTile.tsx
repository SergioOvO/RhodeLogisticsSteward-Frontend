import { useDraggable, useDroppable } from "@dnd-kit/core";
import { formatOperatorRarity, getRequiredElitePhase } from "../../domain/operatorPresentation";
import type {
  BuildingReference,
  ElitePhase,
  Operator,
  SlotAddress,
  SlotAssignment,
} from "../../domain/types";
import { OperatorPortrait } from "../shared/OperatorPortrait";
import styles from "../../styles/canvas.module.css";

const eliteIconPaths: Record<ElitePhase, string> = {
  1: "/operators/elite/图标_升级_精英化1.webp",
  2: "/operators/elite/图标_升级_精英化2.webp",
};

interface OperatorTileProps {
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

export function OperatorTile({
  slot,
  address,
  operator,
  reference,
  roomType,
  product,
  selected,
  onSelect,
}: OperatorTileProps) {
  const slotId = `slot:${address.queueId}:${address.assignmentId}:${address.slotIndex}`;
  const displayName = slot.overrideName ?? operator?.name;
  const isFilled = Boolean(displayName);
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
      {...attributes}
      {...listeners}
      aria-label={displayName ? `编辑 ${displayName}` : "选择干员"}
      className={styles.operatorTile}
      data-filled={isFilled}
      data-operator-tile
      data-over={isOver}
      data-selected={selected}
      onClick={() => onSelect(address)}
      ref={(node) => {
        setDropRef(node);
        setDragRef(node);
      }}
      type="button"
    >
      <span className={styles.portraitFrame} data-portrait-frame>
        <OperatorPortrait
          eliteAlt={displayElitePhase ? `精英化${displayElitePhase}` : undefined}
          eliteIconPath={displayElitePhase ? eliteIconPaths[displayElitePhase] : undefined}
          fallbackText={displayName ? initials(displayName) : String(slot.slotIndex + 1)}
          portraitPath={operator?.portraitPath}
          professionAlt={operator?.profession ?? ""}
          professionIconPath={operator?.professionIconPath}
          rarityIconPath={operator?.rarityIconPath}
          variant="tile"
        />
      </span>
      <span className={styles.slotText}>
        <span className={styles.operatorName} data-slot-name>
          {displayName ?? "空位"}
        </span>
        <span className={styles.slotHint}>
          {operator
            ? `${operator.profession ?? "干员"} ${formatOperatorRarity(operator.rarity, "")}`
            : displayName
              ? "未匹配，保留原名"
              : "点击选择"}
        </span>
      </span>
    </button>
  );
}
