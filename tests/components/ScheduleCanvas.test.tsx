import { DndContext } from "@dnd-kit/core";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScheduleCanvas } from "../../src/components/canvas/ScheduleCanvas";
import { createDefaultSchedule } from "../../src/domain/createDefaultSchedule";
import { addInfrastructureComponent, assignOperator } from "../../src/domain/scheduleDocument";
import type { BuildingReference, Operator, ScheduleDocument } from "../../src/domain/types";

const operator: Operator = {
  id: "op-a",
  name: "Amiya",
  portraitPath: "",
  aliases: ["Amiya"],
  tags: [],
  profession: "Caster",
  rarity: 5,
  source: "mock",
};

function renderCanvas(schedule: ScheduleDocument, extra: Partial<Parameters<typeof ScheduleCanvas>[0]> = {}) {
  return render(
    <DndContext>
      <ScheduleCanvas
        document={schedule}
        onPosterComponentRectChange={vi.fn()}
        onRoomMove={vi.fn()}
        onRoomProductChange={vi.fn()}
        onRoomRemove={vi.fn()}
        onRoomResize={vi.fn()}
        onSlotSelect={vi.fn()}
        operators={[]}
        reference={null}
        selectedSlot={null}
        {...extra}
      />
    </DndContext>,
  );
}

function setPosterCanvasRect(container: HTMLElement) {
  Object.defineProperty(container.querySelector("[data-poster-canvas]"), "getBoundingClientRect", {
    configurable: true,
    value: () => ({ left: 0, top: 0, width: 1000, height: 500, right: 1000, bottom: 500 }),
  });
}

function dragResizeHandle(handle: HTMLElement, pointerId: number, dx: number, dy: number) {
  handle.setPointerCapture = vi.fn();
  handle.releasePointerCapture = vi.fn();
  handle.hasPointerCapture = vi.fn(() => true);

  fireEvent.pointerDown(handle, { button: 0, clientX: 100, clientY: 100, pointerId });
  fireEvent.pointerMove(handle, { clientX: 100 + dx, clientY: 100 + dy, pointerId });
  fireEvent.pointerUp(handle, { clientX: 100 + dx, clientY: 100 + dy, pointerId });
}

function manualManufacturePosterDocument(): ScheduleDocument {
  const base = createDefaultSchedule("243", 1);
  const manufacture = base.canvas.rooms.find((room) => room.roomType === "MANUFACTURE")!;

  return {
    ...base,
    posterCanvas: {
      schemaVersion: 2,
      sourceTemplateId: "matrix",
      components: [
        {
          id: "manual-manufacture",
          type: "infrastructure",
          title: "制造站",
          roomType: "MANUFACTURE",
          roomNodeId: manufacture.roomNodeId,
          rect: { x: 1200, y: 1400, w: 1400, h: 760 },
          zIndex: 10,
        },
      ],
    } as ScheduleDocument["posterCanvas"],
  };
}

function manualSectionPosterDocument(): ScheduleDocument {
  return addInfrastructureComponent(
    {
      ...createDefaultSchedule("243", 1),
      posterCanvas: {
        schemaVersion: 2,
        sourceTemplateId: "matrix",
        components: [],
      },
    },
    "MANUFACTURE",
  );
}

describe("ScheduleCanvas", () => {
  it("renders every queue in the smart matrix poster instead of queue tabs", () => {
    const { container } = renderCanvas(createDefaultSchedule("153", 4));

    expect(container.querySelector("[data-canvas-root]")).toBeInTheDocument();
    expect(container.querySelector("[data-poster-canvas]")).toHaveAttribute("data-poster-template", "matrix");
    expect(screen.queryByRole("navigation", { name: /queue|队列/i })).not.toBeInTheDocument();
    expect(container.querySelectorAll("[data-poster-lane]")).toHaveLength(4);
    expect(container.querySelectorAll("[data-poster-slot]")).toHaveLength(116);
    expect(screen.getByText("队列 4")).toBeInTheDocument();
  });

  it("renders assignments from every queue even when another queue is active", () => {
    const schedule = createDefaultSchedule("243", 3);
    const first = schedule.queues[0].roomAssignments[0];
    const assignedFirst = assignOperator(schedule, "queue-1", first.assignmentId, 0, "op-a");
    const secondQueueDocument = {
      ...assignedFirst,
      activeQueueId: "queue-2",
    };

    const { container } = renderCanvas(secondQueueDocument, { operators: [operator] });

    expect(screen.getByText("Amiya")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-poster-slot]")).toHaveLength(87);
  });

  it("renders combo and jade strategy poster sections", () => {
    const comboDocument = {
      ...createDefaultSchedule("252", 3),
      posterMode: "combo" as const,
    };
    const jadeDocument = createDefaultSchedule("342", 3);
    const manufacture = jadeDocument.canvas.rooms.find(
      (room) => room.roomType === "MANUFACTURE" && room.roomIndex === 4,
    )!;

    const { container, rerender } = renderCanvas(comboDocument);

    expect(container.querySelector("[data-poster-canvas]")).toHaveAttribute("data-poster-template", "combo");
    expect(screen.getByText("A+B")).toBeInTheDocument();
    expect(screen.getByText("B+C")).toBeInTheDocument();

    rerender(
      <DndContext>
        <ScheduleCanvas
          document={{
            ...jadeDocument,
            canvas: {
              ...jadeDocument.canvas,
              rooms: jadeDocument.canvas.rooms.map((room) =>
                room.roomNodeId === manufacture.roomNodeId ? { ...room, product: "OriginStone" } : room,
              ),
            },
            queues: jadeDocument.queues.map((queue) => ({
              ...queue,
              roomAssignments: queue.roomAssignments.map((assignment) =>
                assignment.roomNodeId === manufacture.roomNodeId
                  ? { ...assignment, product: "OriginStone" }
                  : assignment,
              ),
            })),
          }}
          onPosterComponentRectChange={vi.fn()}
          onRoomMove={vi.fn()}
          onRoomProductChange={vi.fn()}
          onRoomRemove={vi.fn()}
          onRoomResize={vi.fn()}
          onSlotSelect={vi.fn()}
          operators={[]}
          reference={null}
          selectedSlot={null}
        />
      </DndContext>,
    );

    expect(screen.getByText("搓玉制造")).toBeInTheDocument();
    expect(screen.getByText("玉贸易")).toBeInTheDocument();
  });

  it("moves product controls into a manufacturing facility settings dialog", () => {
    const onRoomProductChange = vi.fn();
    const { container } = renderCanvas(
      { ...createDefaultSchedule("243", 1), posterTemplateId: "card" },
      { onRoomProductChange },
    );

    expect(container.querySelectorAll("[data-product-select]")).toHaveLength(0);
    expect(container.querySelector('[data-room-node-id="trading-1"] [data-product-label]')).toBeNull();
    expect(container.querySelector('[data-room-node-id="manufacture-1"] [data-product-label]')).toHaveTextContent(
      "赤金",
    );

    fireEvent.click(container.querySelector('[data-room-node-id="manufacture-1"]')!);

    expect(globalThis.document.body.querySelector("[data-facility-settings]")).toBeInTheDocument();
    fireEvent.click(globalThis.document.body.querySelector('[data-product-option="CombatRecord"]')!);
    expect(onRoomProductChange).toHaveBeenCalledWith("manufacture-1", "CombatRecord");
  });

  it("renders a saved free poster canvas instead of regenerating the template", () => {
    const document: ScheduleDocument = {
      ...createDefaultSchedule("243", 3),
      posterCanvas: {
        schemaVersion: 2,
        sourceTemplateId: "matrix",
        components: [
          {
            id: "manual-note",
            type: "note",
            title: "手动备注",
            text: "这里是自定义海报说明",
            rect: { x: 1200, y: 1400, w: 2600, h: 900 },
            zIndex: 10,
          },
        ],
      },
    };

    const { container } = renderCanvas(document);

    expect(screen.getByText("这里是自定义海报说明")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-poster-component]")).toHaveLength(1);
    expect(container.querySelector("[data-poster-component-id='manual-note']")).toHaveStyle({
      left: "12%",
      top: "14%",
    });
  });

  it("renders manually dragged infrastructure as a compact room card", () => {
    const { container } = renderCanvas(manualManufacturePosterDocument());
    const component = container.querySelector("[data-poster-component-id='manual-manufacture']")!;

    expect(component).toHaveAttribute("data-poster-infrastructure-source", "room");
    expect(component).toHaveTextContent("制造站 1");
    expect(component).toHaveTextContent("赤金");
    expect(component.querySelector("[data-poster-slot]")).toBeNull();
  });

  it("renders dropped infrastructure as an editable section with operator slots", () => {
    const onPosterComponentContentChange = vi.fn();
    const onSlotSelect = vi.fn();
    const document = manualSectionPosterDocument();
    const { container } = renderCanvas(document, {
      onPosterComponentContentChange,
      onSlotSelect,
    });
    const component = container.querySelector("[data-poster-component-type='infrastructure']") as HTMLElement;
    const componentId = component.dataset.posterComponentId!;

    expect(component).toHaveAttribute("data-poster-infrastructure-source", "section");
    expect(component.querySelector("[data-poster-compact-infrastructure]")).toBeNull();
    expect(component.querySelectorAll("[data-poster-slot]").length).toBeGreaterThan(0);

    const title = within(component).getByRole("textbox", { name: /编辑.*标题/ });
    title.textContent = "手动制造区";
    fireEvent.blur(title);

    expect(onPosterComponentContentChange).toHaveBeenCalledWith(componentId, { title: "手动制造区" });

    fireEvent.click(component.querySelector("[data-poster-slot]")!);
    expect(onSlotSelect).toHaveBeenCalled();
  });

  it("changes a compact manufacturing poster component product from its context submenu", async () => {
    const onRoomProductChange = vi.fn();
    const document = manualManufacturePosterDocument();
    const manufacture = document.canvas.rooms.find((room) => room.roomType === "MANUFACTURE")!;
    const { container } = renderCanvas(document, { onRoomProductChange });
    const component = container.querySelector("[data-poster-component-id='manual-manufacture']") as HTMLElement;

    fireEvent.contextMenu(component);
    await waitFor(() =>
      expect(globalThis.document.body.querySelector("[data-poster-component-menu-item='manufacture-product']")).toBeInTheDocument(),
    );
    fireEvent.click(globalThis.document.body.querySelector("[data-poster-component-menu-item='manufacture-product']")!);
    await waitFor(() =>
      expect(globalThis.document.body.querySelector("[data-product-option='CombatRecord']")).toBeInTheDocument(),
    );
    fireEvent.click(globalThis.document.body.querySelector("[data-product-option='CombatRecord']")!);

    expect(onRoomProductChange).toHaveBeenCalledWith(manufacture.roomNodeId, "CombatRecord");
  });

  it("keeps poster headers componentized and editing controls outside the export canvas", () => {
    const { container } = renderCanvas(createDefaultSchedule("243", 3));
    const root = container.querySelector("[data-canvas-root]")!;

    expect(root.querySelector(":scope > header")).toBeNull();
    expect(root.querySelector("[data-poster-canvas-tools]")).toBeNull();
    expect(root.querySelector("[data-poster-component-id='metric:title']")).toBeInTheDocument();
    expect(root.querySelector("[data-poster-component-id='metric:production']")).toBeInTheDocument();
    expect(root.querySelector("[data-poster-component-id='metric:drone']")).toBeInTheDocument();
  });

  it("hides poster guides and card template guides from one visibility flag", () => {
    const { container, rerender } = renderCanvas(createDefaultSchedule("243", 3), {
      posterGuidesVisible: false,
    });

    expect(container.querySelector("[data-canvas-root]")).toHaveAttribute("data-guides-visible", "false");
    expect(container.querySelector("[data-poster-canvas]")).toHaveAttribute("data-guides-visible", "false");
    expect(container.querySelector("[data-poster-guide-layer]")).toBeNull();

    rerender(
      <DndContext>
        <ScheduleCanvas
          document={{ ...createDefaultSchedule("243", 1), posterTemplateId: "card" }}
          onPosterComponentRectChange={vi.fn()}
          onRoomMove={vi.fn()}
          onRoomProductChange={vi.fn()}
          onRoomRemove={vi.fn()}
          onRoomResize={vi.fn()}
          onSlotSelect={vi.fn()}
          operators={[]}
          posterGuidesVisible={false}
          reference={null}
          selectedSlot={null}
        />
      </DndContext>,
    );

    expect(container.querySelector("[data-poster-canvas]")).toHaveAttribute("data-guides-visible", "false");
    expect(container.querySelector("[data-bento-canvas]")).toHaveAttribute("data-guides-visible", "false");
  });

  it("renders empty poster slots as a lightweight add affordance", () => {
    const { container } = renderCanvas(createDefaultSchedule("243", 3));
    const emptySlot = container.querySelector("[data-poster-slot][data-filled='false']")!;

    expect(emptySlot.querySelector("[data-empty-slot-add]")).toHaveTextContent("+");
    expect(emptySlot.querySelector("[data-portrait-frame]")).toBeNull();
    expect(emptySlot).not.toHaveTextContent("空位");
  });

  it("selects poster components without rendering component actions inside the export canvas", () => {
    const onPosterComponentSelect = vi.fn();
    const { container } = renderCanvas(createDefaultSchedule("243", 3), {
      onPosterComponentSelect,
      selectedPosterComponentId: null,
    });
    const component = container.querySelector("[data-poster-component]") as HTMLElement;
    const componentId = component.dataset.posterComponentId;

    expect(container.querySelector("[data-canvas-root] [data-poster-component-actions]")).toBeNull();
    expect(container.querySelector("[data-poster-component-selected='true']")).toBeNull();

    fireEvent.click(component);

    expect(onPosterComponentSelect).toHaveBeenCalledWith(componentId);
    expect(container.querySelector("[data-canvas-root] [data-poster-component-actions]")).toBeNull();

    fireEvent.click(container.querySelector("[data-poster-canvas]")!);

    expect(onPosterComponentSelect).toHaveBeenCalledWith(null);
  });

  it("uses a Base UI context menu for poster component actions", async () => {
    const onPosterComponentDelete = vi.fn();
    const onPosterComponentDuplicate = vi.fn();
    const onPosterComponentLayerChange = vi.fn();
    const { container } = renderCanvas(createDefaultSchedule("243", 3), {
      onPosterComponentDelete,
      onPosterComponentDuplicate,
      onPosterComponentLayerChange,
    });
    const component = container.querySelector("[data-poster-component]") as HTMLElement;
    const componentId = component.dataset.posterComponentId!;

    fireEvent.contextMenu(component);
    await waitFor(() =>
      expect(globalThis.document.body.querySelector("[data-poster-component-menu-item='duplicate']")).toBeInTheDocument(),
    );
    fireEvent.click(globalThis.document.body.querySelector("[data-poster-component-menu-item='duplicate']")!);
    expect(onPosterComponentDuplicate).toHaveBeenCalledWith(componentId);

    fireEvent.contextMenu(component);
    await waitFor(() =>
      expect(globalThis.document.body.querySelector("[data-poster-component-menu-item='delete']")).toBeInTheDocument(),
    );
    fireEvent.click(globalThis.document.body.querySelector("[data-poster-component-menu-item='delete']")!);
    expect(onPosterComponentDelete).toHaveBeenCalledWith(componentId);

    fireEvent.contextMenu(component);
    await waitFor(() =>
      expect(globalThis.document.body.querySelector("[data-poster-component-menu-item='layer-up']")).toBeInTheDocument(),
    );
    fireEvent.click(globalThis.document.body.querySelector("[data-poster-component-menu-item='layer-up']")!);
    expect(onPosterComponentLayerChange).toHaveBeenCalledWith(componentId, "up");
  });

  it("commits poster component drag only after crossing the movement threshold", () => {
    const onPosterComponentRectChange = vi.fn();
    const { container } = renderCanvas(createDefaultSchedule("243", 3), {
      onPosterComponentRectChange,
    });
    const handle = container.querySelector("[data-poster-component-handle]") as HTMLElement;

    setPosterCanvasRect(container);
    handle.setPointerCapture = vi.fn();
    handle.releasePointerCapture = vi.fn();
    handle.hasPointerCapture = vi.fn(() => true);

    fireEvent.pointerDown(handle, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 103, clientY: 103, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 103, clientY: 103, pointerId: 1 });

    expect(onPosterComponentRectChange).not.toHaveBeenCalled();

    fireEvent.pointerDown(handle, { button: 0, clientX: 100, clientY: 100, pointerId: 2 });
    fireEvent.pointerMove(handle, { clientX: 130, clientY: 100, pointerId: 2 });
    expect(onPosterComponentRectChange).not.toHaveBeenCalled();

    fireEvent.pointerUp(handle, { clientX: 130, clientY: 100, pointerId: 2 });

    expect(onPosterComponentRectChange).toHaveBeenCalledTimes(1);
    expect(onPosterComponentRectChange.mock.calls[0][1].x).toBeGreaterThan(0);
  });

  it("snaps poster component drag to dense guides when snap is enabled", () => {
    const onPosterComponentRectChange = vi.fn();
    const { container } = renderCanvas(createDefaultSchedule("243", 3), {
      onPosterComponentRectChange,
      posterSnapEnabled: true,
    });
    const handle = container.querySelector("[data-poster-component-handle]") as HTMLElement;

    setPosterCanvasRect(container);
    handle.setPointerCapture = vi.fn();
    handle.releasePointerCapture = vi.fn();
    handle.hasPointerCapture = vi.fn(() => true);

    fireEvent.pointerDown(handle, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 161, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 161, clientY: 100, pointerId: 1 });

    expect(onPosterComponentRectChange).toHaveBeenCalledTimes(1);
    expect(onPosterComponentRectChange.mock.calls[0][1].x).toBe(833);
  });

  it("renders invisible edge resize handles only for the selected poster component", () => {
    const { container } = renderCanvas(createDefaultSchedule("243", 3), {
      selectedPosterComponentId: "metric:title",
    });
    const handles = Array.from(container.querySelectorAll("[data-poster-resize-handle]")).map(
      (handle) => (handle as HTMLElement).dataset.posterResizeHandle,
    );

    expect(handles.sort()).toEqual(["bottom", "left", "right", "top"]);
    expect(handles).not.toEqual(expect.arrayContaining(["nw", "ne", "sw", "se"]));
  });

  it("resizes poster components from the right and bottom edges", () => {
    const onPosterComponentRectChange = vi.fn();
    const { container, rerender } = renderCanvas(createDefaultSchedule("243", 3), {
      onPosterComponentRectChange,
      posterSnapEnabled: false,
      selectedPosterComponentId: "metric:title",
    });

    setPosterCanvasRect(container);
    dragResizeHandle(container.querySelector('[data-poster-resize-handle="right"]') as HTMLElement, 1, 100, 0);

    expect(onPosterComponentRectChange).toHaveBeenCalledWith("metric:title", {
      x: 220,
      y: 180,
      w: 3700,
      h: 640,
    });

    onPosterComponentRectChange.mockClear();
    rerender(
      <DndContext>
        <ScheduleCanvas
          document={createDefaultSchedule("243", 3)}
          onPosterComponentRectChange={onPosterComponentRectChange}
          posterSnapEnabled={false}
          onRoomMove={vi.fn()}
          onRoomProductChange={vi.fn()}
          onRoomRemove={vi.fn()}
          onRoomResize={vi.fn()}
          onSlotSelect={vi.fn()}
          operators={[]}
          reference={null}
          selectedPosterComponentId="metric:title"
          selectedSlot={null}
        />
      </DndContext>,
    );
    setPosterCanvasRect(container);
    dragResizeHandle(container.querySelector('[data-poster-resize-handle="bottom"]') as HTMLElement, 2, 0, 20);

    expect(onPosterComponentRectChange).toHaveBeenCalledWith("metric:title", {
      x: 220,
      y: 180,
      w: 2700,
      h: 1040,
    });
  });

  it("resizes poster components from the left and top edges with the opposite edge anchored", () => {
    const onPosterComponentRectChange = vi.fn();
    const { container, rerender } = renderCanvas(createDefaultSchedule("243", 3), {
      onPosterComponentRectChange,
      posterSnapEnabled: false,
      selectedPosterComponentId: "metric:title",
    });

    setPosterCanvasRect(container);
    dragResizeHandle(container.querySelector('[data-poster-resize-handle="left"]') as HTMLElement, 1, 100, 0);

    expect(onPosterComponentRectChange).toHaveBeenCalledWith("metric:title", {
      x: 1220,
      y: 180,
      w: 1700,
      h: 640,
    });

    onPosterComponentRectChange.mockClear();
    rerender(
      <DndContext>
        <ScheduleCanvas
          document={createDefaultSchedule("243", 3)}
          onPosterComponentRectChange={onPosterComponentRectChange}
          posterSnapEnabled={false}
          onRoomMove={vi.fn()}
          onRoomProductChange={vi.fn()}
          onRoomRemove={vi.fn()}
          onRoomResize={vi.fn()}
          onSlotSelect={vi.fn()}
          operators={[]}
          reference={null}
          selectedPosterComponentId="metric:title"
          selectedSlot={null}
        />
      </DndContext>,
    );
    setPosterCanvasRect(container);
    dragResizeHandle(container.querySelector('[data-poster-resize-handle="top"]') as HTMLElement, 2, 0, 10);

    expect(onPosterComponentRectChange).toHaveBeenCalledWith("metric:title", {
      x: 220,
      y: 380,
      w: 2700,
      h: 440,
    });
  });

  it("keeps the opposite edge anchored when edge resize reaches minimum size", () => {
    const onPosterComponentRectChange = vi.fn();
    const { container } = renderCanvas(createDefaultSchedule("243", 3), {
      onPosterComponentRectChange,
      posterSnapEnabled: false,
      selectedPosterComponentId: "metric:title",
    });

    setPosterCanvasRect(container);
    dragResizeHandle(container.querySelector('[data-poster-resize-handle="left"]') as HTMLElement, 1, 300, 0);

    expect(onPosterComponentRectChange).toHaveBeenCalledWith("metric:title", {
      x: 2520,
      y: 180,
      w: 400,
      h: 640,
    });
  });

  it("snaps poster component edge resize to dense guides when snap is enabled", () => {
    const onPosterComponentRectChange = vi.fn();
    const { container } = renderCanvas(createDefaultSchedule("243", 3), {
      onPosterComponentRectChange,
      posterSnapEnabled: true,
      selectedPosterComponentId: "metric:title",
    });

    setPosterCanvasRect(container);
    dragResizeHandle(container.querySelector('[data-poster-resize-handle="right"]') as HTMLElement, 1, 36, 0);

    expect(onPosterComponentRectChange).toHaveBeenCalledWith("metric:title", {
      x: 220,
      y: 180,
      w: 3113,
      h: 640,
    });
  });

  it("renders an auto elite phase icon when building skills require elite 2", () => {
    const schedule = createDefaultSchedule("243", 1);
    const assignment = schedule.queues[0].roomAssignments[0];
    const assigned = assignOperator(schedule, "queue-1", assignment.assignmentId, 0, "op-a");
    const reference: BuildingReference = {
      source: {
        localSourcePath: "",
        upstreamRepository: "",
        upstreamCommit: "",
        generatedAt: "",
        rowCounts: {},
      },
      roomTypes: [],
      productionFormulaTypes: [],
      operatorSkills: [
        {
          operatorId: "op-a",
          operatorName: "Amiya",
          roomType: assignment.roomType as BuildingReference["operatorSkills"][number]["roomType"],
          buffId: "buff-a",
          buffName: "Test buff",
          descriptionText: "Test description",
          targetFormulaTypes: [],
          conditionPhase: "PHASE_2",
          conditionLevel: 1,
        },
      ],
      skillsById: {},
    };

    const { container } = renderCanvas(assigned, { operators: [operator], reference });

    expect(container.querySelector("[data-elite-icon]")).toBeInTheDocument();
  });
});
