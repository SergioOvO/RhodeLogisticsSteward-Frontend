import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState, type ReactNode } from "react";
import { OperatorPortrait } from "../shared/OperatorPortrait";
import type { Operator, SlotAddress } from "../../domain/types";
import styles from "../../styles/drag.module.css";

interface DragDropProviderProps {
  children: ReactNode;
  onAssignOperator: (address: SlotAddress, operatorId: string) => void;
  onSwapSlots: (source: SlotAddress, target: SlotAddress) => void;
  onClearSlot: (address: SlotAddress) => void;
}

function isSlotAddress(value: unknown): value is SlotAddress {
  const address = value as SlotAddress;
  return (
    typeof address === "object" &&
    address !== null &&
    typeof address.queueId === "string" &&
    typeof address.assignmentId === "string" &&
    typeof address.slotIndex === "number"
  );
}

function isOperator(value: unknown): value is Operator {
  const operator = value as Operator;
  return (
    typeof operator === "object" &&
    operator !== null &&
    typeof operator.id === "string" &&
    typeof operator.name === "string"
  );
}

function initials(name: string): string {
  return name.slice(0, 2).toLocaleUpperCase();
}

function SquareDragPreview({ operator }: { operator: Operator }) {
  return (
    <div className={styles.dragPreview} data-drag-preview="operator">
      <OperatorPortrait
        fallbackText={initials(operator.name)}
        portraitPath={operator.portraitPath}
        professionIconPath={operator.professionIconPath}
        rarityIconPath={operator.rarityIconPath}
      />
      <span className={styles.name}>{operator.name}</span>
    </div>
  );
}

export function DragDropProvider({
  children,
  onAssignOperator,
  onSwapSlots,
  onClearSlot,
}: DragDropProviderProps) {
  const [activeOperator, setActiveOperator] = useState<Operator | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragStart(event: DragStartEvent) {
    const operator = event.active.data.current?.operator;
    setActiveOperator(isOperator(operator) ? operator : null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveOperator(null);
    const active = event.active.data.current;
    const over = event.over?.data.current;

    if (!event.over || !active) {
      return;
    }

    if (event.over.id === "clear-zone" && active.type === "assigned" && isSlotAddress(active.address)) {
      onClearSlot(active.address);
      return;
    }

    if (!over || over.type !== "slot" || !isSlotAddress(over.address)) {
      return;
    }

    if (active.type === "operator" && typeof active.operatorId === "string") {
      onAssignOperator(over.address, active.operatorId);
      return;
    }

    if (active.type === "assigned" && isSlotAddress(active.address)) {
      onSwapSlots(active.address, over.address);
    }
  }

  return (
    <DndContext
      onDragCancel={() => setActiveOperator(null)}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {activeOperator ? <SquareDragPreview operator={activeOperator} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
