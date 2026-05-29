import { useDroppable } from "@dnd-kit/core";
import { MinusIcon, PlusIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { importScheduleJson } from "../../export/importJson";
import { downloadJson } from "../../export/downloadJson";
import { exportSchedulePng } from "../../export/exportPng";
import type { OperatorFilterState } from "../../domain/operatorFilters";
import type {
  BuildingReference,
  Operator,
  OperatorManifest,
  ScheduleDocument,
  SlotAddress,
} from "../../domain/types";
import { useScheduleStore } from "../../state/useScheduleStore";
import styles from "../../styles/editor.module.css";
import { ScheduleCanvas } from "../canvas/ScheduleCanvas";
import { DragDropProvider } from "../dnd/DragDropProvider";
import { OperatorPickerDialog } from "../picker/OperatorPickerDialog";
import { ContourButton } from "../ui/ContourButton";
import { OperatorPanel } from "./OperatorPanel";
import { Toolbar } from "./Toolbar";

interface EditorShellProps {
  initialDocument?: ScheduleDocument;
}

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;
const MIN_ZOOM = 0.54;
const MAX_ZOOM = 2.4;
const ZOOM_STEP = 0.08;

const defaultFilters: OperatorFilterState = {
  text: "",
  roomTypes: [],
  formulaTypes: [],
  assignedOnly: false,
};

function ClearDropZone({ visible }: { visible: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "clear-zone",
    data: { type: "clear" },
  });

  return (
    <div
      className={[styles.dropZone, visible ? styles.dropZoneVisible : ""].filter(Boolean).join(" ")}
      data-over={isOver}
      ref={setNodeRef}
    >
      拖到这里清空槽位
    </div>
  );
}

async function loadJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return (await response.json()) as T;
}

export function EditorShell({ initialDocument }: EditorShellProps) {
  const store = useScheduleStore(initialDocument);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [reference, setReference] = useState<BuildingReference | null>(null);
  const [filters, setFilters] = useState<OperatorFilterState>(defaultFilters);
  const [selectedSlot, setSelectedSlot] = useState<SlotAddress | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState("");
  const [fitZoom, setFitZoom] = useState(1);
  const [zoomOffset, setZoomOffset] = useState(0);
  const [dragUiVisible] = useState(true);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const canvasScrollerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const basePath = import.meta.env.BASE_URL;
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fitZoom + zoomOffset));
  const selectedSlotAssignment = useMemo(() => {
    if (!selectedSlot) {
      return null;
    }

    const queue = store.document.queues.find((item) => item.id === selectedSlot.queueId);
    const assignment = queue?.roomAssignments.find(
      (item) => item.assignmentId === selectedSlot.assignmentId,
    );

    return (
      assignment?.operators.find((slot) => slot.slotIndex === selectedSlot.slotIndex) ?? null
    );
  }, [selectedSlot, store.document]);

  useEffect(() => {
    let active = true;

    Promise.all([
      loadJson<OperatorManifest>(`${basePath}operators/manifest.json`),
      loadJson<BuildingReference>(`${basePath}data/building-reference.json`),
    ])
      .then(([manifest, buildingReference]) => {
        if (!active) {
          return;
        }
        setOperators(manifest.operators);
        setReference(buildingReference);
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "静态数据加载失败");
      });

    return () => {
      active = false;
    };
  }, [basePath]);

  useEffect(() => {
    const node = canvasScrollerRef.current;
    if (!node) {
      return undefined;
    }

    const measureFitZoom = () => {
      const style = window.getComputedStyle(node);
      const paddingInline =
        Number.parseFloat(style.paddingLeft || "0") + Number.parseFloat(style.paddingRight || "0");
      const availableWidth = node.clientWidth - paddingInline;

      if (availableWidth > 0) {
        setFitZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, availableWidth / CANVAS_WIDTH)));
      }
    };

    measureFitZoom();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureFitZoom);
      return () => window.removeEventListener("resize", measureFitZoom);
    }

    const observer = new ResizeObserver(measureFitZoom);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  function assignToAddress(address: SlotAddress, operatorId: string) {
    store.assignOperator(address.queueId, address.assignmentId, address.slotIndex, operatorId);
    setSelectedSlot(address);
  }

  function assignSelected(operatorId: string) {
    if (!selectedSlot) {
      return;
    }

    assignToAddress(selectedSlot, operatorId);
  }

  async function handleImport(file: File | undefined) {
    if (!file) {
      return;
    }

    try {
      const next = await importScheduleJson(file, operators);
      store.replaceDocument(next);
      setError("");
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "导入失败");
    }
  }

  async function handleExportPng() {
    if (!canvasRef.current) {
      setError("找不到可导出的画布。");
      return;
    }

    try {
      await exportSchedulePng(canvasRef.current, store.document);
      setError("");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "PNG 导出失败");
    }
  }

  return (
    <div className={styles.appFrame}>
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <h1 className={styles.brandTitle}>罗德岛排班表生成器</h1>
        </div>
        <Toolbar
          document={store.document}
          onExportJson={() => downloadJson(store.document)}
          onExportPng={handleExportPng}
          onImportClick={() => inputRef.current?.click()}
          onLayoutChange={store.setLayout}
          onQueueCountChange={store.setQueueCount}
          onReset={() => {
            store.resetDraft();
            setSelectedSlot(null);
          }}
        />
        <input
          accept="application/json"
          hidden
          onChange={(event) => void handleImport(event.target.files?.[0])}
          ref={inputRef}
          type="file"
        />
      </header>
      <DragDropProvider
        onAssignOperator={assignToAddress}
        onClearSlot={(address) =>
          store.clearSlot(address.queueId, address.assignmentId, address.slotIndex)
        }
        onSwapSlots={store.swapSlots}
      >
        <main className={styles.workspace}>
          <OperatorPanel
            assignedOperatorIds={store.assignedOperatorIds}
            filters={filters}
            onAssignToSelected={assignSelected}
            operators={operators}
            reference={reference}
            selectedSlot={selectedSlot}
            setFilters={setFilters}
          />
          <section className={styles.canvasStage}>
            <div className={styles.canvasToolbar}>
              <span>导出版只包含下方 16:9 画布</span>
              <span className={styles.zoomActions}>
                <ContourButton
                  aria-label="缩小画布"
                  icon={<MinusIcon />}
                  iconOnly
                  onClick={() => setZoomOffset((value) => Math.max(MIN_ZOOM - fitZoom, value - ZOOM_STEP))}
                  size="sm"
                  variant="white"
                />
                <ContourButton
                  aria-label="放大画布"
                  icon={<PlusIcon />}
                  iconOnly
                  onClick={() => setZoomOffset((value) => Math.min(MAX_ZOOM - fitZoom, value + ZOOM_STEP))}
                  size="sm"
                  variant="white"
                />
              </span>
            </div>
            {error ? <div className={styles.error}>{error}</div> : null}
            <ClearDropZone visible={dragUiVisible} />
            <div className={styles.canvasScroller} ref={canvasScrollerRef}>
              <div
                className={styles.canvasFrame}
                style={{ width: CANVAS_WIDTH * zoom, height: CANVAS_HEIGHT * zoom }}
              >
                <div className={styles.canvasScale} style={{ transform: `scale(${zoom})` }}>
                  <ScheduleCanvas
                    document={store.document}
                    onMetadataChange={store.updateMetadata}
                    onQueueChange={store.updateQueueLabels}
                    onRoomLabelsChange={store.updateRoomEfficiencyLabels}
                    onSlotSelect={(address) => {
                      setSelectedSlot(address);
                      setPickerOpen(true);
                    }}
                    operators={operators}
                    reference={reference}
                    ref={canvasRef}
                    selectedSlot={selectedSlot}
                  />
                </div>
              </div>
            </div>
          </section>
        </main>
        <OperatorPickerDialog
          assignedOperatorIds={store.assignedOperatorIds}
          baseFilters={filters}
          onAssign={assignSelected}
          onClear={() => {
            if (selectedSlot) {
              store.clearSlot(selectedSlot.queueId, selectedSlot.assignmentId, selectedSlot.slotIndex);
            }
          }}
          onElitePhaseChange={(elitePhase) => {
            if (selectedSlot) {
              store.setSlotElitePhase(
                selectedSlot.queueId,
                selectedSlot.assignmentId,
                selectedSlot.slotIndex,
                elitePhase,
              );
            }
          }}
          onOpenChange={setPickerOpen}
          open={pickerOpen}
          operators={operators}
          reference={reference}
          selectedSlotAssignment={selectedSlotAssignment}
          selectedSlot={selectedSlot}
        />
      </DragDropProvider>
    </div>
  );
}
