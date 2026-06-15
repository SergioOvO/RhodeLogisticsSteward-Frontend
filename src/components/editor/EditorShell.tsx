import { useDroppable } from "@dnd-kit/core";
import { Switch } from "@base-ui/react/switch";
import { MinusIcon, PlusIcon, SidebarSimpleIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { bentoLayoutIds } from "../../domain/bentoDefinitions";
import { queueCountOptions } from "../../domain/queueLimits";
import { downloadJson } from "../../export/downloadJson";
import { exportSchedulePng } from "../../export/exportPng";
import { importScheduleJson } from "../../export/importJson";
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
import { BuildingPalette } from "./BuildingPalette";
import { Toolbar } from "./Toolbar";

interface EditorShellProps {
  initialDocument?: ScheduleDocument;
}

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 675;
const MIN_ZOOM = 0.54;
const MAX_ZOOM = 2.4;
const ZOOM_STEP = 0.08;
const SIDEBAR_STORAGE_KEY = "rhode-logistics-sidebar-collapsed";
const POSTER_TOOLBAR_BUTTON_STYLE = { width: 92, minWidth: 92 } satisfies CSSProperties;
const POSTER_TOOLBAR_SHORT_BUTTON_STYLE = { width: 70, minWidth: 70 } satisfies CSSProperties;
const POSTER_TOOLBAR_WIDE_BUTTON_STYLE = { width: 100, minWidth: 100 } satisfies CSSProperties;

function ClearDropZone() {
  const { setNodeRef, isOver } = useDroppable({
    id: "clear-zone",
    data: { type: "clear" },
  });

  return (
    <div
      className={styles.dropZone}
      data-over={isOver}
      ref={setNodeRef}
    >
      拖到这里清空槽位
    </div>
  );
}

function getInitialSidebarCollapsed(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
  if (saved === "true") {
    return true;
  }
  if (saved === "false") {
    return false;
  }

  return window.matchMedia?.("(max-width: 1180px)").matches ?? false;
}

async function loadJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return (await response.json()) as T;
}

function assertLoadedEditorData(
  manifest: OperatorManifest,
  buildingReference: BuildingReference,
): void {
  if (!Array.isArray(manifest.operators) || manifest.operators.length === 0) {
    throw new Error("Operator manifest is empty. Backend data was not loaded.");
  }

  if (!Array.isArray(buildingReference.roomTypes) || buildingReference.roomTypes.length === 0) {
    throw new Error("Building reference room types are empty. Backend data was not loaded.");
  }

  if (
    !Array.isArray(buildingReference.productionFormulaTypes) ||
    buildingReference.productionFormulaTypes.length === 0
  ) {
    throw new Error("Building reference formula types are empty. Backend data was not loaded.");
  }

  if (!Array.isArray(buildingReference.operatorSkills) || buildingReference.operatorSkills.length === 0) {
    throw new Error("Building reference operator skills are empty. Backend data was not loaded.");
  }

  if (
    !buildingReference.skillsById ||
    typeof buildingReference.skillsById !== "object" ||
    Object.keys(buildingReference.skillsById).length === 0
  ) {
    throw new Error("Building reference skills are empty. Backend data was not loaded.");
  }
}

export function EditorShell({ initialDocument }: EditorShellProps) {
  const store = useScheduleStore(initialDocument);
  const [operators, setOperators] = useState<Operator[] | null>(null);
  const [reference, setReference] = useState<BuildingReference | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SlotAddress | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fitZoom, setFitZoom] = useState(1);
  const [zoomOffset, setZoomOffset] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialSidebarCollapsed);
  const [focusMode, setFocusMode] = useState(false);
  const [posterSnapEnabled, setPosterSnapEnabled] = useState(true);
  const [posterGuidesVisible, setPosterGuidesVisible] = useState(true);
  const [selectedPosterComponentId, setSelectedPosterComponentId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const canvasScrollerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const basePath = import.meta.env.BASE_URL;
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fitZoom + zoomOffset));
  const selectedAssignment = useMemo(() => {
    if (!selectedSlot) {
      return null;
    }

    const queue = store.document.queues.find((item) => item.id === selectedSlot.queueId);
    return queue?.roomAssignments.find((item) => item.assignmentId === selectedSlot.assignmentId) ?? null;
  }, [selectedSlot, store.document]);
  const selectedSlotAssignment = useMemo(() => {
    if (!selectedSlot || !selectedAssignment) {
      return null;
    }

    return selectedAssignment.operators.find((slot) => slot.slotIndex === selectedSlot.slotIndex) ?? null;
  }, [selectedAssignment, selectedSlot]);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

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
        assertLoadedEditorData(manifest, buildingReference);
        setOperators(manifest.operators);
        setReference(buildingReference);
        setLoadError("");
      })
      .catch((loadError: unknown) => {
        if (!active) {
          return;
        }

        setOperators(null);
        setReference(null);
        setLoadError(
          loadError instanceof Error
            ? `Backend data load failed: ${loadError.message}`
            : "Backend data load failed.",
        );
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
        const nextFitZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, availableWidth / CANVAS_WIDTH));
        setFitZoom((current) => (Math.abs(current - nextFitZoom) < 0.001 ? current : nextFitZoom));
      }
    };

    const scheduleMeasure = () => window.requestAnimationFrame(measureFitZoom);

    measureFitZoom();
    const frame = scheduleMeasure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureFitZoom);
      return () => window.removeEventListener("resize", measureFitZoom);
    }

    const observer = new ResizeObserver(measureFitZoom);
    observer.observe(node);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [focusMode, sidebarCollapsed]);

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
    if (operators === null) {
      setError("Cannot import before backend data is loaded.");
      setNotice("");
      return;
    }

    try {
      const result = await importScheduleJson(file, operators);
      store.replaceDocument(result.document);
      setError("");
      setNotice(result.message ?? "");
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "导入失败");
      setNotice("");
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
      setError(exportError instanceof Error ? exportError.message : "PNG 导出失败。");
    }
  }

  function renderZoomActions() {
    return (
      <span className={styles.zoomActions}>
        <ContourButton
          aria-label="缩小画布"
          className={styles.posterToolbarContourButton}
          icon={<MinusIcon />}
          iconOnly
          onClick={() => setZoomOffset((value) => Math.max(MIN_ZOOM - fitZoom, value - ZOOM_STEP))}
          size="sm"
          variant="white"
        />
        <ContourButton
          aria-label="放大画布"
          className={styles.posterToolbarContourButton}
          icon={<PlusIcon />}
          iconOnly
          onClick={() => setZoomOffset((value) => Math.min(MAX_ZOOM - fitZoom, value + ZOOM_STEP))}
          size="sm"
          variant="white"
        />
      </span>
    );
  }

  function renderCompactSelects() {
    return (
      <>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>布局</span>
          <select
            aria-label="布局"
            className={styles.textInput}
            onChange={(event) => store.setLayout(event.target.value)}
            value={store.document.layoutId}
          >
            {bentoLayoutIds.map((layoutId) => (
              <option key={layoutId} value={layoutId}>
                {layoutId}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>队列</span>
          <select
            aria-label="队列"
            className={styles.textInput}
            onChange={(event) => store.setQueueCount(Number(event.target.value))}
            value={store.document.queueCount}
          >
            {queueCountOptions.map((count) => (
              <option key={count} value={count}>
                {count} 队列
              </option>
            ))}
          </select>
        </label>
      </>
    );
  }

  function renderPosterEditorToolbar() {
    return (
      <div className={styles.posterEditorToolbar} data-export-hidden data-poster-editor-toolbar>
        <div className={styles.posterToolbarGroup}>
          <ContourButton
            className={styles.posterToolbarContourButton}
            onClick={store.regeneratePosterCanvas}
            size="sm"
            style={POSTER_TOOLBAR_BUTTON_STYLE}
            variant="white"
          >
            重排海报
          </ContourButton>
          <ContourButton
            className={styles.posterToolbarContourButton}
            disabled={!store.canUndoPosterCanvas}
            onClick={store.undoPosterCanvas}
            size="sm"
            style={POSTER_TOOLBAR_SHORT_BUTTON_STYLE}
            variant="white"
          >
            撤销
          </ContourButton>
          <ContourButton
            className={styles.posterToolbarContourButton}
            disabled={!store.canRedoPosterCanvas}
            onClick={store.redoPosterCanvas}
            size="sm"
            style={POSTER_TOOLBAR_SHORT_BUTTON_STYLE}
            variant="white"
          >
            重做
          </ContourButton>
          <ContourButton
            className={styles.posterToolbarContourButton}
            data-poster-clear-canvas
            onClick={() => {
              store.clearPosterCanvas();
              setSelectedPosterComponentId(null);
            }}
            size="sm"
            style={POSTER_TOOLBAR_SHORT_BUTTON_STYLE}
            variant="red"
          >
            清空
          </ContourButton>
          <label className={styles.posterSwitchControl}>
            <span>对齐网格</span>
            <Switch.Root
              aria-label="对齐网格"
              checked={posterSnapEnabled}
              className={styles.posterSwitchRoot}
              data-poster-snap-toggle
              onCheckedChange={setPosterSnapEnabled}
            >
              <Switch.Thumb className={styles.posterSwitchThumb} />
            </Switch.Root>
          </label>
          <ContourButton
            className={styles.posterToolbarContourButton}
            data-poster-guides-toggle
            onClick={() => setPosterGuidesVisible((value) => !value)}
            size="sm"
            style={POSTER_TOOLBAR_WIDE_BUTTON_STYLE}
            variant="white"
          >
            {posterGuidesVisible ? "隐藏参考线" : "显示参考线"}
          </ContourButton>
        </div>
        {!focusMode ? (
          <div className={styles.posterToolbarActions}>
            <ContourButton
              className={styles.posterToolbarContourButton}
              onClick={() => setFocusMode(true)}
              size="sm"
              style={POSTER_TOOLBAR_BUTTON_STYLE}
              variant="white"
            >
              专注编辑
            </ContourButton>
            {renderZoomActions()}
          </div>
        ) : null}
      </div>
    );
  }

  if (loadError || operators === null || reference === null) {
    return (
      <div className={styles.appFrame} data-focus-mode={false} data-sidebar-collapsed>
        <main className={styles.workspace} data-sidebar-collapsed>
          <section className={styles.canvasStage}>
            {loadError ? (
              <div className={styles.error} role="alert">
                {loadError}
              </div>
            ) : (
              <div className={styles.notice}>Loading backend data...</div>
            )}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.appFrame} data-focus-mode={focusMode} data-sidebar-collapsed={sidebarCollapsed}>
      <DragDropProvider
        onAddRoom={store.addRoom}
        onAddInfrastructureComponent={store.addInfrastructureComponent}
        onAddPosterComponent={store.addPosterComponent}
        onAssignOperator={assignToAddress}
        onClearSlot={(address) => store.clearSlot(address.queueId, address.assignmentId, address.slotIndex)}
        onMoveRoom={store.moveRoom}
        onSwapSlots={store.swapSlots}
      >
        {!focusMode ? (
          <header className={styles.topBar}>
            <Toolbar
              document={store.document}
              onExportJson={() => downloadJson(store.document)}
              onExportPng={handleExportPng}
              onImportClick={() => inputRef.current?.click()}
              onLayoutChange={store.setLayout}
              onPosterModeChange={(posterMode) => store.updatePosterSettings({ posterMode })}
              onPosterTemplateChange={(posterTemplateId) => store.updatePosterSettings({ posterTemplateId })}
              onQueueCountChange={store.setQueueCount}
              onReset={() => {
                store.resetDraft();
                setSelectedSlot(null);
                setSelectedPosterComponentId(null);
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
        ) : null}
        <main
          className={styles.workspace}
          data-sidebar-collapsed={sidebarCollapsed || focusMode}
          onClick={(event) => {
            const target = event.target as Element;
            if (target.closest("[data-poster-slot], [data-bento-slot], [data-portrait-slot]")) {
              return;
            }
            setSelectedSlot(null);
            setPickerOpen(false);
          }}
        >
          {!focusMode && !sidebarCollapsed ? (
            <BuildingPalette
              document={store.document}
              onAddRoom={store.addRoom}
              onCollapse={() => setSidebarCollapsed(true)}
              onLayoutChange={store.setLayout}
              onPosterComponentAdd={store.addPosterComponent}
            />
          ) : !focusMode ? (
            <aside className={styles.sidebarRail} data-export-hidden>
              <ContourButton
                aria-label="展开侧栏"
                className={styles.sidebarRailToggle}
                icon={<SidebarSimpleIcon />}
                iconOnly
                onClick={() => setSidebarCollapsed(false)}
                size="sm"
                variant="white"
              />
            </aside>
          ) : null}
          <section className={styles.canvasStage}>
            {focusMode ? (
              <div className={styles.focusToolbar} data-export-hidden>
                {renderCompactSelects()}
                {renderZoomActions()}
                <ContourButton
                  onClick={handleExportPng}
                  size="sm"
                  style={POSTER_TOOLBAR_BUTTON_STYLE}
                  variant="yellow"
                >
                  导出图片
                </ContourButton>
                <ContourButton
                  onClick={() => setFocusMode(false)}
                  size="sm"
                  style={POSTER_TOOLBAR_BUTTON_STYLE}
                  variant="white"
                >
                  退出专注
                </ContourButton>
              </div>
            ) : null}
            {error ? <div className={styles.error}>{error}</div> : null}
            {!error && notice ? <div className={styles.notice}>{notice}</div> : null}
            {renderPosterEditorToolbar()}
            <ClearDropZone />
            <div className={styles.canvasScroller} data-canvas-scroller ref={canvasScrollerRef}>
              <div
                className={styles.canvasFrame}
                data-canvas-frame
                style={{ width: CANVAS_WIDTH * zoom, height: CANVAS_HEIGHT * zoom }}
              >
                <div className={styles.canvasScale} style={{ transform: `scale(${zoom})` }}>
                  <ScheduleCanvas
                    document={store.document}
                    onPosterComponentDelete={(componentId) => {
                      store.deletePosterComponent(componentId);
                      setSelectedPosterComponentId((current) => (current === componentId ? null : current));
                    }}
                    onPosterComponentDuplicate={store.duplicatePosterComponent}
                    onPosterComponentLayerChange={store.movePosterComponentLayer}
                    onPosterComponentContentChange={store.updatePosterComponentContent}
                    onPosterComponentRectChange={store.updatePosterComponentRect}
                    onPosterComponentSelect={setSelectedPosterComponentId}
                    onRoomMove={store.moveRoom}
                    onRoomProductChange={store.setRoomProduct}
                    onRoomRemove={store.removeRoom}
                    onRoomResize={store.resizeRoom}
                    onRoomEfficiencyLabelsChange={store.updateRoomEfficiencyLabels}
                    onSlotSelect={(address) => {
                      setSelectedSlot(address);
                      setPickerOpen(true);
                    }}
                    operators={operators}
                    reference={reference}
                    ref={canvasRef}
                    selectedSlot={selectedSlot}
                    selectedPosterComponentId={selectedPosterComponentId}
                    posterGuidesVisible={posterGuidesVisible}
                    posterSnapEnabled={posterSnapEnabled}
                  />
                </div>
              </div>
            </div>
          </section>
        </main>
        <OperatorPickerDialog
          assignedOperatorIds={store.assignedOperatorIds}
          onAssign={assignSelected}
          onClear={() => {
            if (selectedSlot) {
              store.clearSlot(selectedSlot.queueId, selectedSlot.assignmentId, selectedSlot.slotIndex);
              setPickerOpen(false);
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
          onOpenChange={(open) => {
            setPickerOpen(open);
            if (!open) setSelectedSlot(null);
          }}
          open={pickerOpen}
          operators={operators}
          reference={reference}
          selectedProduct={selectedAssignment?.product}
          selectedRoomType={selectedAssignment?.roomType}
          selectedSlot={selectedSlot}
          selectedSlotAssignment={selectedSlotAssignment}
        />
      </DragDropProvider>
    </div>
  );
}
