import {
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ContextMenu } from "@base-ui/react/context-menu";
import { useDroppable } from "@dnd-kit/core";
import {
  buildDefaultPosterCanvas,
  clampPosterRect,
  MIN_POSTER_COMPONENT_SIZE,
  normalizePosterCanvas,
  POSTER_COORD_MAX,
} from "../../domain/posterCanvas";
import { buildPosterViewModel, type PosterBlock, type PosterSection } from "../../domain/posterViewModel";
import type { PosterComponentContentPatch } from "../../domain/scheduleDocument";
import type {
  BentoRoomNode,
  BuildingReference,
  GridRect,
  Operator,
  PosterComponent,
  PosterRect,
  ProductKind,
  ScheduleDocument,
  SlotAddress,
} from "../../domain/types";
import styles from "../../styles/canvas.module.css";
import { BentoCanvas } from "./BentoCanvas";
import { EditableText } from "./EditableText";
import { PosterOperatorSlot } from "./PosterOperatorSlot";

interface PosterCanvasProps {
  document: ScheduleDocument;
  operators: Operator[];
  reference: BuildingReference | null;
  selectedSlot: SlotAddress | null;
  onSlotSelect: (address: SlotAddress) => void;
  onRoomMove: (roomNodeId: string, rect: GridRect) => void;
  onRoomResize: (roomNodeId: string, rect: GridRect) => void;
  onRoomProductChange: (roomNodeId: string, product?: ProductKind) => void;
  onRoomRemove: (roomNodeId: string) => void;
  onPosterComponentRectChange: (componentId: string, rect: PosterRect) => void;
  onPosterComponentContentChange: (componentId: string, patch: PosterComponentContentPatch) => void;
  onPosterComponentDelete: (componentId: string) => void;
  onPosterComponentDuplicate: (componentId: string) => void;
  onPosterComponentLayerChange: (componentId: string, direction: "up" | "down") => void;
  onPosterComponentSelect: (componentId: string | null) => void;
  posterGuidesVisible: boolean;
  posterSnapEnabled: boolean;
  selectedPosterComponentId: string | null;
}

type PosterStyle = CSSProperties & Record<`--${string}`, string | number>;
type ResizeEdge = "top" | "right" | "bottom" | "left";
type InteractionKind = "drag" | "resize";

interface PointerLike {
  clientX: number;
  clientY: number;
}

interface PosterInteractionState {
  componentId: string;
  edge?: ResizeEdge;
  didMove: boolean;
  kind: InteractionKind;
  pointerId: number;
  startRect: PosterRect;
  startX: number;
  startY: number;
  target: HTMLElement;
}

const sectionTheme: Record<PosterSection["kind"], string> = {
  control: styles.posterThemeControl,
  trade: styles.posterThemeTrade,
  jadeTrade: styles.posterThemeTrade,
  gold: styles.posterThemeGold,
  record: styles.posterThemeRecord,
  jadeManufacture: styles.posterThemeJade,
  power: styles.posterThemePower,
  other: styles.posterThemeOther,
};

const primaryPointerButton = 0;
const dragThresholdPx = 6;
const POSTER_GUIDE_COLUMNS = 24;
const POSTER_GUIDE_ROWS = 12;
const POSTER_SNAP_THRESHOLD_PX = 8;
const manufactureProductOptions = [
  { value: "PureGold", label: "赤金" },
  { value: "CombatRecord", label: "作战记录" },
  { value: "OriginStone", label: "源石碎片" },
] as const satisfies readonly { value: ProductKind; label: string }[];
const resizeEdges = ["top", "right", "bottom", "left"] as const satisfies readonly ResizeEdge[];
const resizeEdgeClasses: Record<ResizeEdge, string> = {
  top: styles.posterResizeHandleTop,
  right: styles.posterResizeHandleRight,
  bottom: styles.posterResizeHandleBottom,
  left: styles.posterResizeHandleLeft,
};

function productLabel(product?: ProductKind): string {
  if (product === "Money") {
    return "龙门币";
  }
  if (product === "PureGold") {
    return "赤金";
  }
  if (product === "CombatRecord") {
    return "经验";
  }
  if (product === "OriginStone") {
    return "源石碎片";
  }
  return "";
}

function groupedBlocks(section: PosterSection, laneId: string): PosterBlock[] {
  return section.blocks.filter((block) => block.laneId === laneId);
}

function componentStyle(rect: PosterRect, zIndex: number): CSSProperties {
  return {
    left: `${rect.x / 100}%`,
    top: `${rect.y / 100}%`,
    width: `${rect.w / 100}%`,
    height: `${rect.h / 100}%`,
    zIndex,
  };
}

function componentClasses(component: PosterComponent, section?: PosterSection) {
  return [
    styles.posterComponent,
    component.type === "infrastructure" && section ? sectionTheme[section.kind] : "",
    component.type === "metric" ? styles.posterComponentMetric : "",
    component.type === "note" ? styles.posterComponentNote : "",
    component.type === "laneLabel" ? styles.posterComponentLane : "",
    component.type === "divider" ? styles.posterComponentDivider : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function nextDragRect(
  canvas: HTMLElement,
  startRect: PosterRect,
  startX: number,
  startY: number,
  event: PointerLike,
): PosterRect {
  const bounds = canvas.getBoundingClientRect();
  const dx = ((event.clientX - startX) / bounds.width) * 10000;
  const dy = ((event.clientY - startY) / bounds.height) * 10000;

  return clampPosterRect({
    ...startRect,
    x: startRect.x + dx,
    y: startRect.y + dy,
  });
}

function nextResizeRect(
  canvas: HTMLElement,
  startRect: PosterRect,
  startX: number,
  startY: number,
  event: PointerLike,
  edge: ResizeEdge,
): PosterRect {
  const bounds = canvas.getBoundingClientRect();
  const dx = ((event.clientX - startX) / bounds.width) * 10000;
  const dy = ((event.clientY - startY) / bounds.height) * 10000;

  if (edge === "right") {
    return resizeRectFromEdge(startRect, edge, startRect.x + startRect.w + dx);
  }
  if (edge === "bottom") {
    return resizeRectFromEdge(startRect, edge, startRect.y + startRect.h + dy);
  }
  if (edge === "left") {
    return resizeRectFromEdge(startRect, edge, startRect.x + dx);
  }
  return resizeRectFromEdge(startRect, edge, startRect.y + dy);
}

function snapCoordinate(value: number, step: number, threshold: number): number {
  const guide = Math.round(value / step) * step;
  return Math.abs(guide - value) <= threshold ? Math.round(guide) : Math.round(value);
}

function clampValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resizeRectFromEdge(rect: PosterRect, edge: ResizeEdge, edgePosition: number): PosterRect {
  const right = rect.x + rect.w;
  const bottom = rect.y + rect.h;

  if (edge === "right") {
    const nextRight = clampValue(edgePosition, rect.x + MIN_POSTER_COMPONENT_SIZE, POSTER_COORD_MAX);
    return { ...rect, w: Math.round(nextRight - rect.x) };
  }
  if (edge === "bottom") {
    const nextBottom = clampValue(edgePosition, rect.y + MIN_POSTER_COMPONENT_SIZE, POSTER_COORD_MAX);
    return { ...rect, h: Math.round(nextBottom - rect.y) };
  }
  if (edge === "left") {
    const nextLeft = clampValue(edgePosition, 0, right - MIN_POSTER_COMPONENT_SIZE);
    const x = Math.round(nextLeft);
    return { ...rect, x, w: Math.round(right - x) };
  }

  const nextTop = clampValue(edgePosition, 0, bottom - MIN_POSTER_COMPONENT_SIZE);
  const y = Math.round(nextTop);
  return { ...rect, y, h: Math.round(bottom - y) };
}

function snapPosterRect(
  canvas: HTMLElement,
  rect: PosterRect,
  kind: InteractionKind,
  edge?: ResizeEdge,
): PosterRect {
  const bounds = canvas.getBoundingClientRect();
  const thresholdX = (POSTER_SNAP_THRESHOLD_PX / Math.max(1, bounds.width)) * 10000;
  const thresholdY = (POSTER_SNAP_THRESHOLD_PX / Math.max(1, bounds.height)) * 10000;
  const stepX = 10000 / POSTER_GUIDE_COLUMNS;
  const stepY = 10000 / POSTER_GUIDE_ROWS;

  if (kind === "drag") {
    return clampPosterRect({
      ...rect,
      x: snapCoordinate(rect.x, stepX, thresholdX),
      y: snapCoordinate(rect.y, stepY, thresholdY),
    });
  }

  const next = { ...rect };
  const right = rect.x + rect.w;
  const bottom = rect.y + rect.h;

  if (edge === "left") {
    return resizeRectFromEdge(rect, edge, snapCoordinate(rect.x, stepX, thresholdX));
  }
  if (edge === "right") {
    return resizeRectFromEdge(rect, edge, snapCoordinate(right, stepX, thresholdX));
  }
  if (edge === "top") {
    return resizeRectFromEdge(rect, edge, snapCoordinate(rect.y, stepY, thresholdY));
  }
  if (edge === "bottom") {
    return resizeRectFromEdge(rect, edge, snapCoordinate(bottom, stepY, thresholdY));
  }

  return clampPosterRect(next);
}

function eventPosterCanvas(target: Element): HTMLElement | null {
  return target.closest("[data-poster-canvas]") as HTMLElement | null;
}

export function PosterCanvas({
  document,
  operators,
  reference,
  selectedSlot,
  onSlotSelect,
  onRoomMove,
  onRoomResize,
  onRoomProductChange,
  onRoomRemove,
  onPosterComponentRectChange,
  onPosterComponentContentChange,
  onPosterComponentDelete,
  onPosterComponentDuplicate,
  onPosterComponentLayerChange,
  onPosterComponentSelect,
  posterGuidesVisible,
  posterSnapEnabled,
  selectedPosterComponentId,
}: PosterCanvasProps) {
  const [draftRects, setDraftRects] = useState<Record<string, PosterRect>>({});
  const [interactionState, setInteractionState] = useState<PosterInteractionState | null>(null);
  const view = useMemo(() => buildPosterViewModel(document), [document]);
  const posterCanvas = useMemo(
    () =>
      document.posterCanvas
        ? normalizePosterCanvas(document.posterCanvas, document)
        : buildDefaultPosterCanvas(document),
    [document],
  );
  const operatorMap = useMemo(
    () => new Map(operators.map((operator) => [operator.id, operator])),
    [operators],
  );
  const sectionMap = useMemo(
    () => new Map(view.sections.map((section) => [section.id, section])),
    [view.sections],
  );
  const { setNodeRef: setPosterDropRef, isOver: isPosterDropOver } = useDroppable({
    id: "poster-canvas",
    data: { type: "poster-canvas" },
  });

  function roomForInfrastructureComponent(component: PosterComponent): BentoRoomNode | undefined {
    if (component.roomNodeId) {
      return document.canvas.rooms.find((room) => room.roomNodeId === component.roomNodeId);
    }

    return component.roomType
      ? document.canvas.rooms.find((room) => room.roomType === component.roomType)
      : undefined;
  }

  function sectionForRoom(room: BentoRoomNode | undefined): PosterSection | undefined {
    return room
      ? view.sections.find((section) =>
          section.blocks.some((block) => block.roomNodeId === room.roomNodeId),
        )
      : undefined;
  }

  if (view.templateId === "card" && !document.posterCanvas) {
    return (
      <div
        className={styles.posterCardShell}
        data-guides-visible={posterGuidesVisible}
        data-poster-canvas
        data-poster-template="card"
      >
        <BentoCanvas
          document={document}
          guidesVisible={posterGuidesVisible}
          onRoomMove={onRoomMove}
          onRoomProductChange={onRoomProductChange}
          onRoomRemove={onRoomRemove}
          onRoomResize={onRoomResize}
          onSlotSelect={onSlotSelect}
          operators={operators}
          reference={reference}
          selectedSlot={selectedSlot}
        />
      </div>
    );
  }

  function startInteraction(
    component: PosterComponent,
    event: ReactPointerEvent<HTMLElement>,
    kind: InteractionKind,
    edge?: ResizeEdge,
  ) {
    if (event.button !== primaryPointerButton) {
      return;
    }

    if (!eventPosterCanvas(event.currentTarget)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onPosterComponentSelect(component.id);

    setInteractionState({
      componentId: component.id,
      edge,
      didMove: false,
      kind,
      pointerId: event.pointerId,
      startRect: component.rect,
      startX: event.clientX,
      startY: event.clientY,
      target: event.currentTarget,
    });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function nextInteractionRect(interaction: PosterInteractionState, event: PointerLike): PosterRect | null {
    const canvas = eventPosterCanvas(interaction.target);
    if (!canvas) {
      return null;
    }

    const rect = interaction.kind === "drag"
      ? nextDragRect(canvas, interaction.startRect, interaction.startX, interaction.startY, event)
      : nextResizeRect(
          canvas,
          interaction.startRect,
          interaction.startX,
          interaction.startY,
          event,
          interaction.edge ?? "right",
        );

    return posterSnapEnabled ? snapPosterRect(canvas, rect, interaction.kind, interaction.edge) : rect;
  }

  function handleInteractionPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const interaction = interactionState;
    if (!interaction || interaction.pointerId !== event.pointerId) {
      return;
    }

    const distance = Math.hypot(event.clientX - interaction.startX, event.clientY - interaction.startY);
    if (!interaction.didMove && distance < dragThresholdPx) {
      return;
    }

    if (!interaction.didMove) {
      setInteractionState((current) =>
        current && current.pointerId === event.pointerId ? { ...current, didMove: true } : current,
      );
    }
    event.preventDefault();
    event.stopPropagation();

    const rect = nextInteractionRect(interaction, event);
    if (!rect) {
      return;
    }

    setDraftRects((current) => ({ ...current, [interaction.componentId]: rect }));
  }

  function finishInteraction(event: ReactPointerEvent<HTMLElement>) {
    const interaction = interactionState;
    if (!interaction || interaction.pointerId !== event.pointerId) {
      return;
    }

    if (interaction.target.hasPointerCapture?.(event.pointerId)) {
      interaction.target.releasePointerCapture?.(event.pointerId);
    }

    const distance = Math.hypot(event.clientX - interaction.startX, event.clientY - interaction.startY);
    if (interaction.didMove || distance >= dragThresholdPx) {
      const rect = nextInteractionRect(interaction, event);
      if (rect) {
        onPosterComponentRectChange(interaction.componentId, rect);
      }
    }

    setDraftRects((current) => {
      const next = { ...current };
      delete next[interaction.componentId];
      return next;
    });
    setInteractionState(null);
  }

  function cancelInteraction(event: ReactPointerEvent<HTMLElement>) {
    const interaction = interactionState;
    if (!interaction || interaction.pointerId !== event.pointerId) {
      return;
    }

    if (interaction.target.hasPointerCapture?.(event.pointerId)) {
      interaction.target.releasePointerCapture?.(event.pointerId);
    }

    setDraftRects((current) => {
      const next = { ...current };
      delete next[interaction.componentId];
      return next;
    });
    setInteractionState(null);
  }

  function renderBlock(block: PosterBlock) {
    const addressable = block.queueId && block.assignmentId;

    return (
      <article
        className={styles.posterRoomBlock}
        data-room-node-id={block.roomNodeId}
        key={block.id}
      >
        <div className={styles.posterRoomHeader}>
          <span>{block.label}</span>
          <span>{productLabel(block.product)}</span>
        </div>
        <div className={styles.posterSlots}>
          {block.operators.map((slot) => {
            const address = {
              queueId: block.queueId ?? "",
              assignmentId: block.assignmentId ?? "",
              slotIndex: slot.slotIndex,
            };
            const operator = slot.operatorId ? operatorMap.get(slot.operatorId) : undefined;

            return addressable ? (
              <PosterOperatorSlot
                address={address}
                key={slot.slotIndex}
                onSelect={onSlotSelect}
                operator={operator}
                product={block.product}
                reference={reference}
                roomType={block.roomType}
                selected={
                  selectedSlot?.queueId === address.queueId &&
                  selectedSlot.assignmentId === address.assignmentId &&
                  selectedSlot.slotIndex === address.slotIndex
                }
                slot={slot}
              />
            ) : null;
          })}
        </div>
        <div className={styles.posterEfficiency}>
          <span>{block.paperEfficiencyLabel}</span>
          <span>{block.effectiveEfficiencyLabel}</span>
        </div>
        {block.notes.length > 0 ? <div className={styles.posterBlockNote}>{block.notes.join(" / ")}</div> : null}
      </article>
    );
  }

  function renderInfrastructureSection(component: PosterComponent, section: PosterSection) {
    const lanes = view.mode === "combo" ? view.lanes.slice(0, 3) : view.lanes;
    const laneBlocks = lanes.map((lane) => ({
      lane,
      blocks: groupedBlocks(section, lane.id),
    }));
    const maxBlocksPerLane = Math.max(1, ...laneBlocks.map((lane) => lane.blocks.length));

    return (
      <div className={styles.posterFacilityGroupBody}>
        <header className={styles.posterSectionHeader}>
          <EditableText
            ariaLabel={`编辑${component.title}标题`}
            as="span"
            onCommit={(title) => onPosterComponentContentChange(component.id, { title })}
            value={component.title}
          />
          {section.product ? <span>{productLabel(section.product)}</span> : null}
        </header>
        <div
          className={styles.posterSectionRows}
          style={{
            "--poster-lane-count": lanes.length,
            "--poster-room-stack-size": maxBlocksPerLane,
          } as PosterStyle}
        >
          {laneBlocks.map(({ lane, blocks }) => (
            <div className={styles.posterSectionLane} key={lane.id}>
              {blocks.map(renderBlock)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderCompactInfrastructureRoom(component: PosterComponent, room: BentoRoomNode) {
    const meta = [productLabel(room.product), `${room.slotCount} 人`].filter(Boolean).join(" · ");
    return (
      <div
        className={styles.posterCompactInfrastructure}
        data-poster-compact-infrastructure
        data-room-node-id={room.roomNodeId}
      >
        <span aria-hidden="true" className={styles.posterCompactInfrastructureMark} />
        <span className={styles.posterCompactInfrastructureText}>
          <strong>{room.label || component.title}</strong>
          <span>{meta}</span>
        </span>
      </div>
    );
  }

  function renderComponentBody(component: PosterComponent) {
    if (component.type === "infrastructure" && component.sectionId) {
      const section = sectionMap.get(component.sectionId);
      return section ? renderInfrastructureSection(component, section) : null;
    }

    if (component.type === "infrastructure") {
      const room = roomForInfrastructureComponent(component);
      return room ? renderCompactInfrastructureRoom(component, room) : null;
    }

    if (component.type === "metric" || component.type === "note") {
      return (
        <div className={styles.posterTextComponent}>
          <EditableText
            ariaLabel={`编辑${component.title}标题`}
            as="strong"
            onCommit={(title) => onPosterComponentContentChange(component.id, { title })}
            value={component.title}
          />
          <EditableText
            ariaLabel={`编辑${component.title}内容`}
            as="span"
            multiline={component.type === "note"}
            onCommit={(text) => onPosterComponentContentChange(component.id, { text })}
            value={component.text ?? ""}
          />
        </div>
      );
    }

    if (component.type === "laneLabel") {
      return (
        <div className={styles.posterLaneComponent} data-poster-lane>
          <EditableText
            ariaLabel={`编辑${component.title}标题`}
            as="strong"
            onCommit={(title) => onPosterComponentContentChange(component.id, { title })}
            value={component.title}
          />
          <EditableText
            ariaLabel={`编辑${component.title}内容`}
            as="small"
            onCommit={(text) => onPosterComponentContentChange(component.id, { text })}
            value={component.text ?? ""}
          />
        </div>
      );
    }

    return <div className={styles.posterDividerLine} />;
  }

  function renderResizeHandles(component: PosterComponent) {
    return resizeEdges.map((edge) => (
      <button
        aria-label={`${component.title} ${edge} resize`}
        className={[styles.posterResizeHandle, resizeEdgeClasses[edge]].join(" ")}
        data-export-hidden
        data-poster-resize-handle={edge}
        key={edge}
        onPointerCancel={cancelInteraction}
        onPointerDown={(event) => startInteraction(component, event, "resize", edge)}
        onPointerMove={handleInteractionPointerMove}
        onPointerUp={finishInteraction}
        tabIndex={-1}
        type="button"
      />
    ));
  }

  function renderManufactureProductMenu(room: BentoRoomNode) {
    return (
      <>
        <ContextMenu.Separator className={styles.contextMenuSeparator} />
        <ContextMenu.SubmenuRoot>
          <ContextMenu.SubmenuTrigger
            className={styles.contextMenuItem}
            data-poster-component-menu-item="manufacture-product"
          >
            <span>制造类型</span>
            <span className={styles.contextMenuChevron}>›</span>
          </ContextMenu.SubmenuTrigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner align="start" className={styles.contextMenuPositioner} side="right">
              <ContextMenu.Popup className={styles.contextMenuPopup} data-export-hidden>
                {manufactureProductOptions.map((option) => (
                  <ContextMenu.Item
                    className={styles.contextMenuItem}
                    data-product-option={option.value}
                    data-selected={room.product === option.value}
                    key={option.value}
                    onClick={() => onRoomProductChange(room.roomNodeId, option.value)}
                  >
                    {option.label}
                  </ContextMenu.Item>
                ))}
              </ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.SubmenuRoot>
      </>
    );
  }

  function clearSelectionOnCanvasClick(event: ReactMouseEvent<HTMLElement>) {
    if ((event.target as Element).closest("[data-poster-component]")) {
      return;
    }

    onPosterComponentSelect(null);
  }

  function renderComponent(component: PosterComponent) {
    const infrastructureRoom =
      component.type === "infrastructure" ? roomForInfrastructureComponent(component) : undefined;
    const section = component.sectionId
      ? sectionMap.get(component.sectionId)
      : infrastructureRoom
        ? sectionForRoom(infrastructureRoom)
        : component.roomType
        ? view.sections.find((item) => item.blocks.some((block) => block.roomType === component.roomType))
        : undefined;
    const selected = selectedPosterComponentId === component.id;
    const activeRect = draftRects[component.id] ?? component.rect;
    const infrastructureSource =
      component.type === "infrastructure"
        ? component.sectionId
          ? "section"
          : component.roomNodeId
            ? "room"
            : component.roomType
              ? "room-type"
              : undefined
        : undefined;
    const hasManufactureProductMenu =
      component.type === "infrastructure" &&
      component.roomNodeId &&
      infrastructureRoom?.roomType === "MANUFACTURE";

    return (
      <ContextMenu.Root key={component.id}>
        <ContextMenu.Trigger
          className={componentClasses(component, section)}
          data-poster-component
          data-poster-component-id={component.id}
          data-poster-component-selected={selected}
          data-poster-component-type={component.type}
          data-poster-infrastructure-source={infrastructureSource}
          onClick={() => onPosterComponentSelect(component.id)}
          render={<article />}
          style={componentStyle(activeRect, component.zIndex)}
        >
          <button
            aria-label={`移动${component.title}`}
            className={styles.posterComponentHandle}
            data-export-hidden
            data-poster-component-handle
            onPointerCancel={cancelInteraction}
            onPointerDown={(event) => startInteraction(component, event, "drag")}
            onPointerMove={handleInteractionPointerMove}
            onPointerUp={finishInteraction}
            type="button"
          />
          <div className={styles.posterComponentBody}>{renderComponentBody(component)}</div>
          {selected ? renderResizeHandles(component) : null}
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner className={styles.contextMenuPositioner}>
            <ContextMenu.Popup className={styles.contextMenuPopup} data-export-hidden>
              <ContextMenu.Item
                className={styles.contextMenuItem}
                data-poster-component-menu-item="duplicate"
                onClick={() => onPosterComponentDuplicate(component.id)}
              >
                复制
              </ContextMenu.Item>
              <ContextMenu.Item
                className={styles.contextMenuItem}
                data-poster-component-menu-item="layer-up"
                onClick={() => onPosterComponentLayerChange(component.id, "up")}
              >
                上移
              </ContextMenu.Item>
              <ContextMenu.Item
                className={styles.contextMenuItem}
                data-poster-component-menu-item="layer-down"
                onClick={() => onPosterComponentLayerChange(component.id, "down")}
              >
                下移
              </ContextMenu.Item>
              {hasManufactureProductMenu && infrastructureRoom
                ? renderManufactureProductMenu(infrastructureRoom)
                : null}
              <ContextMenu.Separator className={styles.contextMenuSeparator} />
              <ContextMenu.Item
                className={styles.contextMenuItem}
                data-danger="true"
                data-poster-component-menu-item="delete"
                onClick={() => onPosterComponentDelete(component.id)}
              >
                删除
              </ContextMenu.Item>
            </ContextMenu.Popup>
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    );
  }

  return (
    <section
      className={styles.posterCanvas}
      data-guides-visible={posterGuidesVisible}
      data-poster-canvas
      data-poster-over={isPosterDropOver}
      data-poster-mode={view.mode}
      data-poster-template={posterCanvas.sourceTemplateId}
      onClick={clearSelectionOnCanvasClick}
      ref={setPosterDropRef}
      style={{
        "--poster-lane-count": view.mode === "combo" ? 3 : view.lanes.length,
        "--poster-section-count": view.sections.length,
      } as PosterStyle}
    >
      {posterGuidesVisible ? <div className={styles.posterGuideLayer} data-export-hidden data-poster-guide-layer /> : null}
      <div className={styles.posterComponentLayer}>{posterCanvas.components.map(renderComponent)}</div>
    </section>
  );
}
