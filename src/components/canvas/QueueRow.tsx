import type {
  BuildingReference,
  LayoutPreset,
  Operator,
  ScheduleQueue,
  SlotAddress,
} from "../../domain/types";
import styles from "../../styles/canvas.module.css";
import { EditableText } from "./EditableText";
import { FacilityColumn } from "./FacilityColumn";

interface QueueRowProps {
  preset: LayoutPreset;
  queue: ScheduleQueue;
  queueCount: number;
  operatorMap: Map<string, Operator>;
  reference: BuildingReference | null;
  selectedSlot: SlotAddress | null;
  onSlotSelect: (address: SlotAddress) => void;
  onQueueChange: (queueId: string, patch: { label?: string; durationLabel?: string }) => void;
  onRoomLabelsChange: (
    queueId: string,
    assignmentId: string,
    labels: { paperEfficiencyLabel?: string; effectiveEfficiencyLabel?: string; notes?: string[] },
  ) => void;
}

export function QueueRow({
  preset,
  queue,
  queueCount,
  operatorMap,
  reference,
  selectedSlot,
  onSlotSelect,
  onQueueChange,
  onRoomLabelsChange,
}: QueueRowProps) {
  const profile =
    preset.canvasProfile.queueProfiles[queueCount] ?? preset.canvasProfile.queueProfiles[preset.defaultQueueCount];
  const columnWeight = (columnId: string, fallback: number) =>
    profile.columnWeights[columnId] ?? fallback;
  const totalWeight = preset.columns.reduce(
    (sum, column) => sum + columnWeight(column.id, column.widthWeight),
    0,
  );

  return (
    <section className={styles.queueRow} data-queue-row={queue.id}>
      <div
        className={styles.columns}
        style={{
          gridTemplateColumns: preset.columns
            .map((column) => `${(columnWeight(column.id, column.widthWeight) / totalWeight).toFixed(4)}fr`)
            .join(" "),
        }}
      >
        {preset.columns.map((column) => (
          <FacilityColumn
            column={column}
            key={column.id}
            profile={profile}
            onRoomLabelsChange={onRoomLabelsChange}
            onSlotSelect={onSlotSelect}
            operatorMap={operatorMap}
            queue={queue}
            reference={reference}
            selectedSlot={selectedSlot}
          />
        ))}
      </div>
      <div
        aria-label="Queue index"
        className={styles.queueIndexBadge}
        data-queue-index-badge
      >
        <EditableText
          ariaLabel="编辑队列名称"
          className={styles.queueIndexItem}
          onCommit={(label) => onQueueChange(queue.id, { label })}
          value={queue.label}
        />
      </div>
    </section>
  );
}
