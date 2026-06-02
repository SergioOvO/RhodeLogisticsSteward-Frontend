import { describe, expect, it } from "vitest";
import { createDefaultSchedule } from "../../src/domain/createDefaultSchedule";
import {
  addInfrastructureComponent,
  addPosterComponent,
  addRoom,
  assignOperator,
  clearSlot,
  moveRoom,
  resizeRoom,
  setRoomProduct,
  setSlotElitePhase,
  setLayout,
  setQueueCount,
  swapSlots,
  validateScheduleDocument,
} from "../../src/domain/scheduleDocument";

describe("schedule document operations", () => {
  it("round-trips as valid JSON", () => {
    const document = createDefaultSchedule("243", 3);
    const parsed = JSON.parse(JSON.stringify(document)) as unknown;

    expect(validateScheduleDocument(parsed)).toBe(true);
    expect(document.version).toBe(2);
    expect(document.canvas.rooms).toHaveLength(12);
  });

  it("assigns, clears, and swaps slots", () => {
    const document = createDefaultSchedule("243", 1);
    const first = document.queues[0].roomAssignments[0];
    const second = document.queues[0].roomAssignments[1];
    const assigned = assignOperator(document, "queue-1", first.assignmentId, 0, "op-a");
    const swapped = swapSlots(
      assigned,
      { queueId: "queue-1", assignmentId: first.assignmentId, slotIndex: 0 },
      { queueId: "queue-1", assignmentId: second.assignmentId, slotIndex: 0 },
    );

    expect(swapped.queues[0].roomAssignments[1].operators[0].operatorId).toBe("op-a");
    expect(
      clearSlot(swapped, "queue-1", second.assignmentId, 0).queues[0].roomAssignments[1].operators[0]
        .operatorId,
    ).toBeUndefined();
  });

  it("stores and clears manual elite phase on a slot", () => {
    const document = createDefaultSchedule("243", 1);
    const assignment = document.queues[0].roomAssignments[0];
    const withElite = setSlotElitePhase(document, "queue-1", assignment.assignmentId, 0, 2);
    const autoElite = setSlotElitePhase(withElite, "queue-1", assignment.assignmentId, 0);

    expect(withElite.queues[0].roomAssignments[0].operators[0].elitePhase).toBe(2);
    expect(autoElite.queues[0].roomAssignments[0].operators[0].elitePhase).toBeUndefined();
  });

  it("resets manual elite phase when assigning or clearing an operator", () => {
    const document = createDefaultSchedule("243", 1);
    const assignment = document.queues[0].roomAssignments[0];
    const withElite = setSlotElitePhase(document, "queue-1", assignment.assignmentId, 0, 2);
    const assigned = assignOperator(withElite, "queue-1", assignment.assignmentId, 0, "op-a");
    const cleared = clearSlot(withElite, "queue-1", assignment.assignmentId, 0);

    expect(assigned.queues[0].roomAssignments[0].operators[0].elitePhase).toBeUndefined();
    expect(cleared.queues[0].roomAssignments[0].operators[0].elitePhase).toBeUndefined();
  });

  it("swaps manual elite phase with assigned operators", () => {
    const document = createDefaultSchedule("243", 1);
    const first = document.queues[0].roomAssignments[0];
    const second = document.queues[0].roomAssignments[1];
    const firstAddress = { queueId: "queue-1", assignmentId: first.assignmentId, slotIndex: 0 };
    const secondAddress = { queueId: "queue-1", assignmentId: second.assignmentId, slotIndex: 0 };
    const assignedFirst = assignOperator(document, "queue-1", first.assignmentId, 0, "op-a");
    const assignedSecond = assignOperator(assignedFirst, "queue-1", second.assignmentId, 0, "op-b");
    const firstElite = setSlotElitePhase(assignedSecond, "queue-1", first.assignmentId, 0, 2);
    const secondElite = setSlotElitePhase(firstElite, "queue-1", second.assignmentId, 0, 1);
    const swapped = swapSlots(secondElite, firstAddress, secondAddress);

    expect(swapped.queues[0].roomAssignments[1].operators[0]).toMatchObject({
      operatorId: "op-a",
      elitePhase: 2,
    });
    expect(swapped.queues[0].roomAssignments[0].operators[0]).toMatchObject({
      operatorId: "op-b",
      elitePhase: 1,
    });
  });

  it("layout switching creates a valid document", () => {
    const next = setLayout(createDefaultSchedule("243", 3), "333");

    expect(next.layoutId).toBe("333");
    expect(validateScheduleDocument(next)).toBe(true);
  });

  it("setQueueCount clamps to the supported queue range", () => {
    const document = createDefaultSchedule("243", 2);

    expect(setQueueCount(document, 0).queues).toHaveLength(1);
    expect(setQueueCount(document, 4).queues).toHaveLength(4);
    expect(setQueueCount(document, 5).queueCount).toBe(4);
  });

  it("moves and resizes shared canvas rooms without changing assignments", () => {
    const document = createDefaultSchedule("243", 2);
    const room = document.canvas.rooms.find((item) => item.roomNodeId === "power-1")!;
    const assignmentBefore = document.queues[0].roomAssignments.find(
      (assignment) => assignment.roomNodeId === room.roomNodeId,
    )!;
    const moved = moveRoom(document, room.roomNodeId, { ...room.rect, x: 5, y: 3 });
    const movedRoom = moved.canvas.rooms.find((item) => item.roomNodeId === room.roomNodeId)!;
    const resized = resizeRoom(moved, room.roomNodeId, {
      ...movedRoom.rect,
      w: room.rect.w + 1,
      h: room.rect.h,
    });

    expect(resized.canvas.rooms.find((item) => item.roomNodeId === room.roomNodeId)?.rect.x).toBe(5);
    expect(resized.queues[0].roomAssignments.find((assignment) => assignment.roomNodeId === room.roomNodeId)).toEqual(
      assignmentBefore,
    );
  });

  it("keeps fixed one-cell facilities from resizing", () => {
    const document = createDefaultSchedule("243", 1);
    const room = document.canvas.rooms.find((item) => item.roomNodeId === "power-1")!;
    const resized = resizeRoom(document, room.roomNodeId, { ...room.rect, w: 2, h: 2 });

    expect(resized.canvas.rooms.find((item) => item.roomNodeId === room.roomNodeId)?.rect).toEqual(room.rect);
  });

  it("ignores trading product changes and keeps trading rooms on money", () => {
    const document = createDefaultSchedule("243", 2);
    const trading = document.canvas.rooms.find((item) => item.roomType === "TRADING")!;
    const changed = setRoomProduct(document, trading.roomNodeId, "CombatRecord");

    expect(changed.canvas.rooms.find((item) => item.roomNodeId === trading.roomNodeId)?.product).toBe("Money");
    expect(
      changed.queues.every((queue) =>
        queue.roomAssignments
          .filter((assignment) => assignment.roomNodeId === trading.roomNodeId)
          .every((assignment) => assignment.product === "Money"),
      ),
    ).toBe(true);
  });

  it("updates manufacturing product across every queue assignment", () => {
    const document = createDefaultSchedule("243", 3);
    const manufacture = document.canvas.rooms.find((item) => item.roomType === "MANUFACTURE")!;
    const changed = setRoomProduct(document, manufacture.roomNodeId, "CombatRecord");

    expect(changed.canvas.rooms.find((item) => item.roomNodeId === manufacture.roomNodeId)?.product).toBe(
      "CombatRecord",
    );
    expect(
      changed.queues.every((queue) =>
        queue.roomAssignments
          .filter((assignment) => assignment.roomNodeId === manufacture.roomNodeId)
          .every((assignment) => assignment.product === "CombatRecord"),
      ),
    ).toBe(true);
  });

  it("adds an infrastructure poster component from an empty facility canvas", () => {
    const document = createDefaultSchedule("243", 3);
    const emptyDocument = {
      ...document,
      canvas: {
        ...document.canvas,
        rooms: [],
      },
      queues: document.queues.map((queue) => ({
        ...queue,
        roomAssignments: [],
      })),
      posterCanvas: {
        schemaVersion: 2 as const,
        sourceTemplateId: "matrix" as const,
        components: [],
      },
    };

    const next = addInfrastructureComponent(emptyDocument, "TRADING");
    const component = next.posterCanvas?.components.at(-1);

    expect(next.canvas.rooms).toHaveLength(1);
    expect(next.canvas.rooms[0]).toMatchObject({ roomType: "TRADING", roomIndex: 1 });
    expect(next.queues.every((queue) => queue.roomAssignments.length === 1)).toBe(true);
    expect(component).toMatchObject({
      type: "infrastructure",
      roomType: "TRADING",
      sectionId: "trade",
    });
    expect(component?.roomNodeId).toBeUndefined();
    expect(component?.rect.w).toBeGreaterThan(1800);
    expect(component?.rect.h).toBeGreaterThan(900);
    expect(validateScheduleDocument(next)).toBe(true);
  });

  it("places dragged poster and room components near the drop center", () => {
    const poster = addPosterComponent(createDefaultSchedule("243", 3), "note", { x: 5000, y: 5000 });
    expect(poster.posterCanvas?.components.at(-1)?.rect).toMatchObject({
      x: 2820,
      y: 4800,
      w: 4360,
      h: 400,
    });

    const metric = addPosterComponent(createDefaultSchedule("243", 3), "metric", { x: 5000, y: 5000 });
    expect(metric.posterCanvas?.components.at(-1)?.rect).toMatchObject({
      x: 2820,
      y: 4680,
      w: 4360,
      h: 640,
    });

    const divider = addPosterComponent(createDefaultSchedule("243", 3), "divider", { x: 5000, y: 5000 });
    expect(divider.posterCanvas?.components.at(-1)?.rect).toMatchObject({
      x: 220,
      y: 4800,
      w: 9560,
      h: 400,
    });

    const document = createDefaultSchedule("243", 3);
    const emptyDocument = {
      ...document,
      canvas: {
        ...document.canvas,
        rooms: [],
      },
      queues: document.queues.map((queue) => ({
        ...queue,
        roomAssignments: [],
      })),
      posterCanvas: {
        schemaVersion: 2 as const,
        sourceTemplateId: "matrix" as const,
        components: [],
      },
    };

    const infrastructure = addInfrastructureComponent(emptyDocument, "TRADING", { x: 8000, y: 7000 });
    expect(infrastructure.posterCanvas?.components.at(-1)).toMatchObject({
      sectionId: "trade",
      rect: {
        x: expect.any(Number),
        y: expect.any(Number),
        w: expect.any(Number),
        h: expect.any(Number),
      },
    });
    expect(infrastructure.posterCanvas!.components.at(-1)!.rect.w).toBeGreaterThan(1800);
    expect(infrastructure.posterCanvas!.components.at(-1)!.rect.h).toBeGreaterThan(900);

    const room = addRoom(emptyDocument, "POWER", { x: 5.5, y: 3.5 });
    expect(room.canvas.rooms.at(-1)?.rect).toEqual({
      x: 5,
      y: 3,
      w: 1,
      h: 1,
    });
  });

  it("adds repeated infrastructure poster components as section blocks", () => {
    const base = {
      ...createDefaultSchedule("243", 3),
      posterCanvas: {
        schemaVersion: 2 as const,
        sourceTemplateId: "matrix" as const,
        components: [],
      },
    };
    const first = addInfrastructureComponent(base, "MANUFACTURE");
    const second = addInfrastructureComponent(first, "MANUFACTURE");
    const manualComponents = second.posterCanvas!.components.filter(
      (component) => component.type === "infrastructure",
    );

    expect(manualComponents).toHaveLength(2);
    expect(manualComponents.every((component) => component.sectionId)).toBe(true);
    expect(manualComponents.every((component) => component.roomNodeId === undefined)).toBe(true);
    expect(validateScheduleDocument(second)).toBe(true);
  });
});
