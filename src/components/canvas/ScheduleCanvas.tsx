import { forwardRef, useMemo } from "react";
import {
  findIncompleteRoomTypes,
  type PosterComponentContentPatch,
} from "../../domain/scheduleDocument";
import { withMockCalculations } from "../../domain/mockCalculator";
import type {
  BuildingReference,
  GridRect,
  Operator,
  PosterRect,
  ProductKind,
  ScheduleDocument,
  SlotAddress,
} from "../../domain/types";
import styles from "../../styles/ScheduleCanvas.module.css";
import { PosterCanvas } from "./PosterCanvas";

interface ScheduleCanvasProps {
  document: ScheduleDocument;
  operators: Operator[];
  reference: BuildingReference | null;
  selectedSlot: SlotAddress | null;
  onSlotSelect: (address: SlotAddress) => void;
  onRoomMove: (roomNodeId: string, rect: GridRect) => void;
  onRoomResize: (roomNodeId: string, rect: GridRect) => void;
  onRoomProductChange: (roomNodeId: string, product?: ProductKind) => void;
  onRoomRemove: (roomNodeId: string) => void;
  onRoomEfficiencyLabelsChange?: (queueId: string, assignmentId: string, labels: { paperEfficiencyLabel?: string; effectiveEfficiencyLabel?: string }) => void;
  onPosterComponentRectChange: (componentId: string, rect: PosterRect) => void;
  onPosterComponentContentChange?: (componentId: string, patch: PosterComponentContentPatch) => void;
  onPosterComponentSelect?: (componentId: string | null) => void;
  onPosterComponentDelete?: (componentId: string) => void;
  onPosterComponentDuplicate?: (componentId: string) => void;
  onPosterComponentLayerChange?: (componentId: string, direction: "up" | "down") => void;
  posterGuidesVisible?: boolean;
  posterSnapEnabled?: boolean;
  selectedPosterComponentId?: string | null;
}

export const ScheduleCanvas = forwardRef<HTMLDivElement, ScheduleCanvasProps>(
  (
    {
      document,
      operators,
      reference,
      selectedSlot,
      onSlotSelect,
      onRoomMove,
      onRoomResize,
      onRoomProductChange,
      onRoomRemove,
      onRoomEfficiencyLabelsChange = () => undefined,
      onPosterComponentRectChange,
      onPosterComponentContentChange = () => undefined,
      onPosterComponentDelete = () => undefined,
      onPosterComponentDuplicate = () => undefined,
      onPosterComponentLayerChange = () => undefined,
      onPosterComponentSelect = () => undefined,
      posterGuidesVisible = true,
      posterSnapEnabled = true,
      selectedPosterComponentId = null,
    },
    ref,
  ) => {
    const calculated = useMemo(() => withMockCalculations(document), [document]);
    const missingRooms = findIncompleteRoomTypes(calculated);

    return (
      <div
        aria-label="Schedule export canvas"
        className={styles.canvas}
        data-canvas-root
        data-guides-visible={posterGuidesVisible}
        ref={ref}
      >
        <div className={styles.bentoShell}>
          {missingRooms.length > 0 ? (
            <div className={styles.validationWarning}>
              缺少必要设施：{missingRooms.join(", ")}。草稿仍可导出 PNG。
            </div>
          ) : null}
          <PosterCanvas
            document={calculated}
            onRoomMove={onRoomMove}
            onRoomProductChange={onRoomProductChange}
            onRoomRemove={onRoomRemove}
            onRoomResize={onRoomResize}
            onRoomEfficiencyLabelsChange={onRoomEfficiencyLabelsChange}
            onPosterComponentRectChange={onPosterComponentRectChange}
            onPosterComponentContentChange={onPosterComponentContentChange}
            onPosterComponentDelete={onPosterComponentDelete}
            onPosterComponentDuplicate={onPosterComponentDuplicate}
            onPosterComponentLayerChange={onPosterComponentLayerChange}
            onPosterComponentSelect={onPosterComponentSelect}
            posterGuidesVisible={posterGuidesVisible}
            posterSnapEnabled={posterSnapEnabled}
            selectedPosterComponentId={selectedPosterComponentId}
            onSlotSelect={onSlotSelect}
            operators={operators}
            reference={reference}
            selectedSlot={selectedSlot}
          />
        </div>
      </div>
    );
  },
);

ScheduleCanvas.displayName = "ScheduleCanvas";
