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
  columnThemeMap,
  getPosterColumns,
  normalizePosterCanvas,
} from "../../domain/posterCanvas";
import {
  eventPosterCanvas,
  nextDragRect,
  nextResizeRect,
  snapPosterRect,
  type InteractionKind,
  type PointerLike,
  type ResizeEdge,
} from "../../domain/posterInteraction";
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
import {
  manufactureProductOptions,
  productLabel,
  tradingProductOptions,
} from "../../domain/bentoDefinitions";
import styles from "../../styles/PosterCanvas.module.css";
import { BentoCanvas } from "./BentoCanvas";
import { EditableText } from "./EditableText";
import { PosterOperatorSlot } from "./PosterOperatorSlot";
import { PosterSectionColumn } from "./PosterSectionColumn";

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
  onRoomEfficiencyLabelsChange?: (queueId: string, assignmentId: string, labels: { paperEfficiencyLabel?: string; effectiveEfficiencyLabel?: string }) => void;
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

const columnThemeStyles: Record<string, string> = {
  control: styles.posterThemeControl,
  trade: styles.posterThemeTrade,
  gold: styles.posterThemeGold,
  record: styles.posterThemeRecord,
  manufacture: styles.posterThemeManufacture,
  power: styles.posterThemePower,
  other: styles.posterThemeOther,
  jade: styles.posterThemeJade,
};

const primaryPointerButton = 0;
const dragThresholdPx = 6;
const resizeEdges = ["top", "right", "bottom", "left"] as const satisfies readonly ResizeEdge[];
const resizeEdgeClasses: Record<ResizeEdge, string> = {
  top: styles.posterResizeHandleTop,
  right: styles.posterResizeHandleRight,
  bottom: styles.posterResizeHandleBottom,
  left: styles.posterResizeHandleLeft,
};

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

function componentClasses(component: PosterComponent, themeClass?: string) {
  return [
    styles.posterComponent,
    component.type === "infrastructure" && themeClass ? themeClass : "",
    component.type === "metric" ? styles.posterComponentMetric : "",
    component.type === "note" ? styles.posterComponentNote : "",
    component.type === "laneLabel" ? styles.posterComponentLane : "",
    component.type === "divider" ? styles.posterComponentDivider : "",
  ]
    .filter(Boolean)
    .join(" ");
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
  onRoomEfficiencyLabelsChange,
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
  const columns = useMemo(() => getPosterColumns(document.layoutId), [document.layoutId]);
  const columnMap = useMemo(() => new Map(columns.map((col) => [col.id, col])), [columns]);
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

  function renderSingleRoom(component: PosterComponent) {
    const room = document.canvas.rooms.find((candidate) => candidate.roomNodeId === component.roomNodeId);
    if (!room) {
      return null;
    }

    return (
      <div className={styles.posterSingleRoom} data-poster-single-room data-product={room.product}>
        <header className={styles.posterRoomHeader}>
          <span className={styles.posterRoomName}>{room.label}</span>
          {room.roomType === "MANUFACTURE" ? (
            <select
              className={styles.posterProductSelect}
              onChange={(e) => onRoomProductChange(room.roomNodeId, e.target.value as ProductKind)}
              onPointerDown={(e) => e.stopPropagation()}
              value={room.product ?? ""}
            >
              {manufactureProductOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : room.roomType === "TRADING" ? (
            <select
              className={styles.posterProductSelect}
              onChange={(e) => onRoomProductChange(room.roomNodeId, e.target.value as ProductKind)}
              onPointerDown={(e) => e.stopPropagation()}
              value={room.product ?? ""}
            >
              {tradingProductOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <span>{productLabel(room.product)}</span>
          )}
        </header>
        <div className={styles.posterRoomQueueList}>
          {document.queues.map((queue) => {
            const assignment = queue.roomAssignments.find((item) => item.roomNodeId === room.roomNodeId);
            if (!assignment) {
              return null;
            }

            const slotRows =
              room.roomType === "CONTROL"
                ? [assignment.operators.slice(0, 3), assignment.operators.slice(3)]
                : [assignment.operators];

            return (
              <div className={styles.posterRoomQueueRow} key={queue.id}>
                <div className={styles.posterRoomQueueLabel}>
                  <span>{queue.label}</span>
                  <span>{assignment.effectiveEfficiencyLabel || assignment.paperEfficiencyLabel}</span>
                </div>
                {slotRows.map((rowSlots, rowIndex) => (
                  <div className={styles.posterSlots} key={rowIndex}>
                    {rowSlots.map((slot) => {
                      const address = {
                        queueId: queue.id,
                        assignmentId: assignment.assignmentId,
                        slotIndex: slot.slotIndex,
                      };
                      const operator = slot.operatorId ? operatorMap.get(slot.operatorId) : undefined;

                      return (
                        <PosterOperatorSlot
                          address={address}
                          key={slot.slotIndex}
                          onSelect={onSlotSelect}
                          operator={operator}
                          product={assignment.product}
                          reference={reference}
                          roomType={room.roomType}
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
                ))}
              </div>
            );
          })}
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
      const column = columnMap.get(component.sectionId);
      if (column) {
        return (
          <PosterSectionColumn
            column={column}
            document={document}
            onRoomEfficiencyLabelsChange={onRoomEfficiencyLabelsChange}
            onRoomProductChange={onRoomProductChange}
            onSlotSelect={onSlotSelect}
            operators={operators}
            reference={reference}
            selectedSlot={selectedSlot}
          />
        );
      }
      const section = sectionMap.get(component.sectionId);
      return section ? renderInfrastructureSection(component, section) : null;
    }

    if (component.type === "infrastructure" && component.roomNodeId) {
      return renderSingleRoom(component);
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
            multiline
            onCommit={(title) => onPosterComponentContentChange(component.id, { title })}
            value={component.title}
          />
          <EditableText
            ariaLabel={`编辑${component.title}内容`}
            as="span"
            multiline
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
    const column = component.sectionId ? columnMap.get(component.sectionId) : undefined;
    const vsection = column
      ? undefined
      : component.sectionId
        ? sectionMap.get(component.sectionId)
        : infrastructureRoom
          ? sectionForRoom(infrastructureRoom)
          : component.roomType
            ? view.sections.find((item) => item.blocks.some((block) => block.roomType === component.roomType))
            : undefined;
    const themeClass = column
      ? columnThemeStyles[columnThemeMap[column.id] ?? "other"]
      : vsection
        ? sectionTheme[vsection.kind]
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
          className={componentClasses(component, themeClass)}
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
