import { describe, expect, it } from "vitest";
import { bentoLayoutIds } from "../../src/domain/bentoDefinitions";
import { createDefaultSchedule } from "../../src/domain/createDefaultSchedule";
import {
  buildDefaultPosterCanvas,
  clampPosterRect,
  normalizePosterCanvas,
} from "../../src/domain/posterCanvas";
import { queueCountOptions } from "../../src/domain/queueLimits";
import {
  regeneratePosterCanvas,
  updatePosterComponentContent,
  updatePosterComponentRect,
  validateScheduleDocument,
} from "../../src/domain/scheduleDocument";

describe("poster canvas", () => {
  it("generates editable components from the current poster template", () => {
    const document = createDefaultSchedule("153", 4);
    const canvas = buildDefaultPosterCanvas(document);

    expect(canvas.schemaVersion).toBe(2);
    expect(canvas.sourceTemplateId).toBe("matrix");
    expect(canvas.components.map((component) => component.type)).toEqual(
      expect.arrayContaining(["infrastructure", "laneLabel", "metric", "divider"]),
    );
    expect(canvas.components.map((component) => component.type)).not.toEqual(expect.arrayContaining(["note"]));
    expect(canvas.components.map((component) => component.type)).not.toEqual(
      expect.arrayContaining(["facility", "facilityGroup"]),
    );
    expect(canvas.components.some((component) => component.id.includes("trade"))).toBe(true);
  });

  it("generates header information as editable poster components with strict touching sections", () => {
    const document = createDefaultSchedule("243", 3);
    const canvas = buildDefaultPosterCanvas(document);

    expect(canvas.components.map((component) => component.id)).toEqual(
      expect.arrayContaining(["metric:title", "metric:production", "metric:drone"]),
    );
    expect(canvas.components.map((component) => component.id)).not.toEqual(expect.arrayContaining(["note:summary"]));
    expect(canvas.components.find((component) => component.id === "metric:title")?.title).toBe(document.title);
    expect(canvas.components.find((component) => component.id === "metric:production")?.rect.h).toBe(640);

    const facilityGroups = canvas.components
      .filter((component) => component.type === "infrastructure" && component.sectionId)
      .sort((first, second) => first.rect.x - second.rect.x);

    expect(canvas.components.filter((component) => component.type === "laneLabel")).toHaveLength(3);
    expect(facilityGroups.length).toBeGreaterThan(1);
    for (let index = 1; index < facilityGroups.length; index += 1) {
      const previous = facilityGroups[index - 1].rect;
      const current = facilityGroups[index].rect;
      expect(current.x).toBe(previous.x + previous.w);
    }

    for (let firstIndex = 0; firstIndex < canvas.components.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < canvas.components.length; secondIndex += 1) {
        const first = canvas.components[firstIndex];
        const second = canvas.components[secondIndex];
        const intersects =
          first.rect.x < second.rect.x + second.rect.w &&
          first.rect.x + first.rect.w > second.rect.x &&
          first.rect.y < second.rect.y + second.rect.h &&
          first.rect.y + first.rect.h > second.rect.y;

        expect(intersects, `${first.id} overlaps ${second.id}`).toBe(false);
      }
    }
  });

  it("uses strict touching facility sections for every layout and queue count", () => {
    for (const layoutId of bentoLayoutIds) {
      for (const queueCount of queueCountOptions) {
        const document = createDefaultSchedule(layoutId, queueCount);
        const canvas = buildDefaultPosterCanvas(document);
        const facilityGroups = canvas.components
          .filter((component) => component.type === "infrastructure" && component.sectionId)
          .sort((first, second) => first.rect.x - second.rect.x);

        expect(canvas.components.filter((component) => component.type === "laneLabel")).toHaveLength(queueCount);
        expect(facilityGroups.length, `${layoutId}/${queueCount}`).toBeGreaterThan(1);

        for (let index = 1; index < facilityGroups.length; index += 1) {
          const previous = facilityGroups[index - 1].rect;
          const currentComponent = facilityGroups[index];
          const current = currentComponent.rect;

          expect(current.x, `${layoutId}/${queueCount}/${currentComponent.id}`).toBe(previous.x + previous.w);
          expect(current.y, `${layoutId}/${queueCount}/${currentComponent.id}`).toBe(facilityGroups[0].rect.y);
          expect(current.h, `${layoutId}/${queueCount}/${currentComponent.id}`).toBe(facilityGroups[0].rect.h);
        }
      }
    }
  });

  it("clamps normalized component rectangles inside the 0 to 10000 canvas", () => {
    expect(clampPosterRect({ x: -50, y: 9800, w: 20, h: 20 })).toEqual({
      x: 0,
      y: 9600,
      w: 400,
      h: 400,
    });
  });

  it("preserves saved component layouts through document validation", () => {
    const document = regeneratePosterCanvas(createDefaultSchedule("243", 3));
    const first = document.posterCanvas!.components[0];
    const moved = updatePosterComponentRect(document, first.id, {
      x: 1234,
      y: 2345,
      w: 3456,
      h: 2000,
    });

    expect(moved.posterCanvas?.components[0].rect).toEqual({
      x: 1234,
      y: 2345,
      w: 3456,
      h: 2000,
    });
    expect(validateScheduleDocument(JSON.parse(JSON.stringify(moved)))).toBe(true);
  });

  it("updates editable poster component title and text", () => {
    const document = regeneratePosterCanvas(createDefaultSchedule("243", 3));
    const updated = updatePosterComponentContent(document, "metric:production", {
      title: "自定义产出",
      text: "订单 / 赤金 / 经验",
    });

    expect(updated.posterCanvas?.components.find((component) => component.id === "metric:production")).toMatchObject({
      title: "自定义产出",
      text: "订单 / 赤金 / 经验",
    });
    expect(validateScheduleDocument(JSON.parse(JSON.stringify(updated)))).toBe(true);
  });

  it("drops components that reference removed facilities", () => {
    const document = regeneratePosterCanvas(createDefaultSchedule("243", 3));
    const removedRoomId = document.canvas.rooms[0].roomNodeId;
    const normalized = normalizePosterCanvas(
      {
        ...document.posterCanvas!,
        components: [
          ...document.posterCanvas!.components,
          {
            id: "manual-missing-room",
            type: "facility" as const,
            title: "Missing",
            rect: { x: 0, y: 0, w: 1000, h: 1000 },
            zIndex: 99,
            roomNodeId: removedRoomId,
          },
        ],
      },
      {
        ...document,
        canvas: {
          ...document.canvas,
          rooms: document.canvas.rooms.filter((room) => room.roomNodeId !== removedRoomId),
        },
      },
    );

    expect(normalized.components.some((component) => component.id === "manual-missing-room")).toBe(false);
  });

  it("preserves manual infrastructure components that target a concrete room", () => {
    const document = createDefaultSchedule("243", 3);
    const manufacture = document.canvas.rooms.find((room) => room.roomType === "MANUFACTURE")!;
    const normalized = normalizePosterCanvas(
      {
        schemaVersion: 2,
        sourceTemplateId: "matrix",
        components: [
          {
            id: "manual-manufacture",
            type: "infrastructure",
            title: "制造站",
            rect: { x: 600, y: 760, w: 1400, h: 760 },
            zIndex: 99,
            roomNodeId: manufacture.roomNodeId,
          },
        ],
      },
      document,
    );

    expect(normalized.components[0]).toMatchObject({
      type: "infrastructure",
      roomType: "MANUFACTURE",
      roomNodeId: manufacture.roomNodeId,
    });
  });

  it("rejects legacy facility component types in strict validation", () => {
    const document = regeneratePosterCanvas(createDefaultSchedule("243", 3));
    const legacy = {
      ...document,
      posterCanvas: {
        schemaVersion: 1,
        sourceTemplateId: "matrix",
        components: [
          {
            id: "manual-legacy",
            type: "facility",
            title: "Legacy",
            rect: { x: 0, y: 0, w: 1000, h: 1000 },
            zIndex: 99,
            roomNodeId: document.canvas.rooms[0].roomNodeId,
          },
        ],
      },
    };

    expect(validateScheduleDocument(legacy)).toBe(false);
  });
});
