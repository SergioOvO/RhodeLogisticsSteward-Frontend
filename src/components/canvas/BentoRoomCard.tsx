import { useDraggable } from "@dnd-kit/core";
import { XIcon } from "@phosphor-icons/react";
import { useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";
import { bentoRoomDefinitions, BENTO_GRID, manufactureProductOptions, productLabel } from "../../domain/bentoDefinitions";
import {
  calculateRoomEffectiveEfficiency,
  calculateRoomPaperEfficiency,
} from "../../domain/mockCalculator";
import type {
  BentoRoomNode,
  BuildingReference,
  GridRect,
  Operator,
  ProductKind,
  SlotAddress,
} from "../../domain/types";
import styles from "../../styles/canvas.module.css";
import type { QueueRoomAssignment } from "./BentoCanvas";
import { BentoRoomSlot } from "./BentoRoomSlot";

interface BentoRoomCardProps {
  room: BentoRoomNode;
  assignments: QueueRoomAssignment[];
  operatorMap: Map<string, Operator>;
  reference: BuildingReference | null;
  selectedSlot: SlotAddress | null;
  cellSize: { width: number; height: number };
  onSlotSelect: (address: SlotAddress) => void;
  onMove: (roomNodeId: string, rect: GridRect) => void;
  onProductChange: (roomNodeId: string, product?: ProductKind) => void;
  onResize: (roomNodeId: string, rect: GridRect) => void;
  onRemove: (roomNodeId: string) => void;
}

function isInteractiveTarget(target: EventTarget): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("button, select, input, [role='dialog']"));
}

export function BentoRoomCard({
  room,
  assignments,
  operatorMap,
  reference,
  selectedSlot,
  cellSize,
  onSlotSelect,
  onMove,
  onProductChange,
  onResize,
  onRemove,
}: BentoRoomCardProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const definition = bentoRoomDefinitions[room.roomType];
  const product = room.roomType === "TRADING" ? "Money" : assignments[0]?.assignment.product ?? room.product;
  const canResize = definition.resizable;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `room:${room.roomNodeId}`,
    data: {
      type: "room",
      roomNodeId: room.roomNodeId,
      rect: room.rect,
      cellWidth: cellSize.width,
      cellHeight: cellSize.height,
    },
  });
  const style = {
    left: `${(room.rect.x / BENTO_GRID.columns) * 100}%`,
    top: `${(room.rect.y / BENTO_GRID.rows) * 100}%`,
    width: `${(room.rect.w / BENTO_GRID.columns) * 100}%`,
    height: `${(room.rect.h / BENTO_GRID.rows) * 100}%`,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
  } satisfies CSSProperties;

  function openSettings(event: MouseEvent<HTMLElement>) {
    if (room.roomType !== "MANUFACTURE" || isInteractiveTarget(event.target)) {
      return;
    }

    setSettingsOpen(true);
  }

  function startMove(event: PointerEvent<HTMLElement>) {
    if (isInteractiveTarget(event.target)) {
      return;
    }

    event.preventDefault();
    const target = event.currentTarget;
    const origin = { x: event.clientX, y: event.clientY };
    const startRect = room.rect;

    target.setPointerCapture(event.pointerId);

    const handleUp = (upEvent: globalThis.PointerEvent) => {
      const dx = Math.round((upEvent.clientX - origin.x) / Math.max(1, cellSize.width));
      const dy = Math.round((upEvent.clientY - origin.y) / Math.max(1, cellSize.height));
      onMove(room.roomNodeId, {
        ...startRect,
        x: startRect.x + dx,
        y: startRect.y + dy,
      });
      if (target.hasPointerCapture(upEvent.pointerId)) {
        target.releasePointerCapture(upEvent.pointerId);
      }
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };

    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  }

  function startResize(direction: "right" | "bottom", event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    const origin = { x: event.clientX, y: event.clientY };
    const startRect = room.rect;

    target.setPointerCapture(event.pointerId);

    const handleUp = (upEvent: globalThis.PointerEvent) => {
      const dx = Math.round((upEvent.clientX - origin.x) / Math.max(1, cellSize.width));
      const dy = Math.round((upEvent.clientY - origin.y) / Math.max(1, cellSize.height));
      onResize(room.roomNodeId, {
        ...startRect,
        w: direction === "right" ? startRect.w + dx : startRect.w,
        h: direction === "bottom" ? startRect.h + dy : startRect.h,
      });
      if (target.hasPointerCapture(upEvent.pointerId)) {
        target.releasePointerCapture(upEvent.pointerId);
      }
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };

    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  }

  return (
    <article
      className={styles.bentoRoomCard}
      data-bento-room
      data-color-role={definition.colorRole}
      data-dragging={isDragging}
      data-room-node-id={room.roomNodeId}
      onClick={openSettings}
      ref={setNodeRef}
      style={style}
    >
      <header className={styles.bentoRoomHeader} {...attributes} {...listeners} onPointerDown={startMove}>
        <div className={styles.bentoRoomTitleGroup}>
          <span className={styles.bentoRoomTitle} data-facility-title>
            {room.label}
          </span>
          <span className={styles.bentoRoomMeta}>
            {room.slotCount} 人
            {room.roomType === "MANUFACTURE" ? (
              <span data-product-label data-product-value={product}>
                {" · "}
                {productLabel(product)}
              </span>
            ) : null}
          </span>
        </div>
        <button
          aria-label={`移除 ${room.label}`}
          className={styles.iconButton}
          data-export-hidden
          onClick={() => onRemove(room.roomNodeId)}
          type="button"
        >
          <XIcon size={12} />
        </button>
      </header>

      <div className={styles.bentoQueueList}>
        {assignments.map(({ queue, assignment }, queueIndex) => (
          <div className={styles.bentoQueueRow} data-bento-queue-row key={assignment.assignmentId}>
            <div className={styles.bentoQueueLabel}>
              <span>{queue.label || `队列 ${queueIndex + 1}`}</span>
              <span>{calculateRoomEffectiveEfficiency(assignment)}</span>
            </div>
            <div className={styles.bentoQueueSlots}>
              {assignment.operators.map((slot) => {
                const address = { queueId: queue.id, assignmentId: assignment.assignmentId, slotIndex: slot.slotIndex };
                const operator = slot.operatorId ? operatorMap.get(slot.operatorId) : undefined;
                return (
                  <BentoRoomSlot
                    address={address}
                    key={slot.slotIndex}
                    onSelect={onSlotSelect}
                    operator={operator}
                    product={assignment.product}
                    reference={reference}
                    roomType={assignment.roomType}
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
            <span className={styles.bentoQueuePaper}>{calculateRoomPaperEfficiency(assignment)}</span>
          </div>
        ))}
      </div>

      {settingsOpen && room.roomType === "MANUFACTURE" ? (
        <div
          aria-label={`${room.label} 设施设置`}
          className={styles.facilitySettings}
          data-export-hidden
          data-facility-settings
          onClick={(event) => event.stopPropagation()}
          role="dialog"
        >
          <div className={styles.facilitySettingsTitle}>产物</div>
          <div className={styles.productOptionGroup}>
            {manufactureProductOptions.map((option) => (
              <button
                className={styles.productOption}
                data-active={product === option.value}
                data-product-option={option.value}
                key={option.value}
                onClick={() => {
                  onProductChange(room.roomNodeId, option.value);
                  setSettingsOpen(false);
                }}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {canResize ? (
        <>
          <button
            aria-label={`向右调整 ${room.label} 大小`}
            className={[styles.resizeHandle, styles.resizeHandleRight].join(" ")}
            data-resize-handle="right"
            onPointerDown={(event) => startResize("right", event)}
            type="button"
          />
          <button
            aria-label={`向下调整 ${room.label} 大小`}
            className={[styles.resizeHandle, styles.resizeHandleBottom].join(" ")}
            data-resize-handle="bottom"
            onPointerDown={(event) => startResize("bottom", event)}
            type="button"
          />
        </>
      ) : null}
    </article>
  );
}
