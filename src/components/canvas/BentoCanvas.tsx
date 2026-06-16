import { useDroppable } from "@dnd-kit/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { BENTO_GRID } from "../../domain/bentoDefinitions";
import type {
  BuildingReference,
  GridRect,
  Operator,
  ProductKind,
  RoomAssignment,
  ScheduleDocument,
  ScheduleQueue,
  SlotAddress,
} from "../../domain/types";
import styles from "../../styles/BentoCanvas.module.css";
import { BentoRoomCard } from "./BentoRoomCard";

interface BentoCanvasProps {
  document: ScheduleDocument;
  guidesVisible?: boolean;
  operators: Operator[];
  reference: BuildingReference | null;
  selectedSlot: SlotAddress | null;
  onSlotSelect: (address: SlotAddress) => void;
  onRoomMove: (roomNodeId: string, rect: GridRect) => void;
  onRoomResize: (roomNodeId: string, rect: GridRect) => void;
  onRoomProductChange: (roomNodeId: string, product?: ProductKind) => void;
  onRoomRemove: (roomNodeId: string) => void;
}

export interface QueueRoomAssignment {
  queue: ScheduleQueue;
  assignment: RoomAssignment;
}

export function BentoCanvas({
  document,
  guidesVisible = true,
  operators,
  reference,
  selectedSlot,
  onSlotSelect,
  onRoomMove,
  onRoomResize,
  onRoomProductChange,
  onRoomRemove,
}: BentoCanvasProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [cellSize, setCellSize] = useState({ width: 1, height: 1 });
  const { setNodeRef, isOver } = useDroppable({
    id: "bento-canvas",
    data: { type: "canvas" },
  });
  const operatorMap = useMemo(
    () => new Map(operators.map((operator) => [operator.id, operator])),
    [operators],
  );
  const assignmentsByRoom = useMemo(() => {
    const map = new Map<string, QueueRoomAssignment[]>();
    for (const queue of document.queues) {
      for (const assignment of queue.roomAssignments) {
        const assignments = map.get(assignment.roomNodeId) ?? [];
        assignments.push({ queue, assignment });
        map.set(assignment.roomNodeId, assignments);
      }
    }
    return map;
  }, [document.queues]);

  useEffect(() => {
    const node = canvasRef.current;
    if (!node) {
      return undefined;
    }

    const measure = () => {
      const rect = node.getBoundingClientRect();
      setCellSize({
        width: rect.width / BENTO_GRID.columns,
        height: rect.height / BENTO_GRID.rows,
      });
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      className={styles.bentoGrid}
      data-bento-canvas
      data-guides-visible={guidesVisible}
      data-grid-over={isOver}
      ref={(node) => {
        canvasRef.current = node as HTMLDivElement | null;
        setNodeRef(node);
      }}
    >
      {document.canvas.rooms.map((room) => {
        const assignments = assignmentsByRoom.get(room.roomNodeId) ?? [];
        if (assignments.length === 0) {
          return null;
        }

        return (
          <BentoRoomCard
            assignments={assignments}
            cellSize={cellSize}
            key={room.roomNodeId}
            onProductChange={onRoomProductChange}
            onMove={onRoomMove}
            onRemove={onRoomRemove}
            onResize={onRoomResize}
            onSlotSelect={onSlotSelect}
            operatorMap={operatorMap}
            reference={reference}
            room={room}
            selectedSlot={selectedSlot}
          />
        );
      })}
      <div className={styles.gridDropHint}>拖入设施</div>
    </section>
  );
}
