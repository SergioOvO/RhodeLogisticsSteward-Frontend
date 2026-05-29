import { describe, expect, it } from "vitest";
import {
  maaCustomInfrastToScheduleDocument,
  maaCustomInfrastToScheduleImport,
} from "../../src/export/maaCustomInfrast";
import type { Operator } from "../../src/domain/types";

const operators: Operator[] = [
  {
    id: "op-blacknight",
    name: "Blacknight",
    portraitPath: "/operators/portraits/Blacknight.png",
    aliases: ["Hei"],
    tags: [],
    source: "mock",
  },
  {
    id: "op-jixing",
    name: "Jixing",
    portraitPath: "/operators/portraits/Jixing.png",
    aliases: ["Ji Xing"],
    tags: [],
    source: "mock",
  },
  {
    id: "op-amiya",
    name: "Amiya",
    portraitPath: "/operators/portraits/Amiya.png",
    aliases: ["CEO"],
    tags: [],
    source: "mock",
  },
];

describe("maaCustomInfrastToScheduleDocument", () => {
  it("converts MAA 243 custom_infrast plans into schedule queues", () => {
    const document = maaCustomInfrastToScheduleDocument(
      {
        title: "243 high efficiency",
        author: "tester",
        plans: [
          {
            name: "12H first shift",
            description: "next shift after 12h",
            drones: { room: "manufacture", index: 1, enable: true, order: "pre" },
            rooms: {
              control: [{ operators: ["Amiya"] }],
              trading: [
                { product: "LMD", operators: ["Blacknight", "Ji Xing", "Closure"] },
                { product: "LMD", operators: ["Bibeak", "Proviso", "Tequila"] },
              ],
              manufacture: [
                { product: "Battle Record", operators: ["Wild Mane", "Fang", "Grey"] },
                { product: "Battle Record", operators: ["Vermeil", "Scene", "Pallas"] },
                { product: "Pure Gold", operators: ["Purestream", "Weedy", "Eunectes"] },
                { product: "Pure Gold", operators: ["Arene", "Gravel", "Mizuki"] },
              ],
              power: [{ operators: ["Lancet-2"] }, { operators: ["Greyy"] }, { operators: ["Glaucus"] }],
            },
          },
          { name: "12H second shift", rooms: {} },
          { name: "12H third shift", rooms: {} },
        ],
      },
      operators,
    );

    expect(document?.layoutId).toBe("243");
    expect(document?.queueCount).toBe(3);
    expect(document?.queues[0].label).toBe("12H first shift");
    expect(document?.authorText).toBe("tester");
    expect(document?.droneSummary.targetRoomLabel).toBe("制造站 1，pre");

    const trade = document?.queues[0].roomAssignments.find(
      (assignment) => assignment.roomType === "TRADING" && assignment.roomIndex === 1,
    );
    expect(trade?.operators[0].operatorId).toBe("op-blacknight");
    expect(trade?.operators[1].operatorId).toBe("op-jixing");
    expect(trade?.operators[2].overrideName).toBe("Closure");

    const powerAssignments =
      document?.queues[0].roomAssignments.filter((assignment) => assignment.roomType === "POWER") ?? [];
    expect(powerAssignments).toHaveLength(3);
    expect(powerAssignments.map((assignment) => assignment.operators[0].overrideName)).toEqual([
      "Lancet-2",
      "Greyy",
      "Glaucus",
    ]);
  });

  it("infers 153 layout from the max room counts across all plans", () => {
    const report = maaCustomInfrastToScheduleImport(
      {
        title: "153 max layout",
        plans: [
          {
            name: "partial shift",
            rooms: {
              trading: [{ skip: true, product: "LMD", operators: ["Blacknight"] }],
              manufacture: [{ product: "Pure Gold", operators: ["Arene", "Gravel", "Mizuki"] }],
              power: [{ operators: ["Lancet-2"] }],
            },
          },
          {
            name: "full shift",
            rooms: {
              trading: [{ product: "LMD", operators: ["Tequila", "Blacknight", "Bibeak"] }],
              manufacture: [
                { product: "Pure Gold", operators: ["Arene", "Gravel", "Mizuki"] },
                { product: "Battle Record", operators: ["Vermeil", "Scene", "Pallas"] },
                { product: "Battle Record", operators: ["Wild Mane", "Fang", "Grey"] },
                { product: "Battle Record", operators: ["Mayer", "Kafka", "Mizuki"] },
                { product: "Battle Record", operators: ["Weedy", "Passenger", "Windflit"] },
              ],
              power: [{ operators: ["Lancet-2"] }, { operators: ["Greyy"] }, { operators: ["Glaucus"] }],
            },
          },
        ],
      },
      operators,
    );

    expect(report?.document.layoutId).toBe("153");

    const assignments = report?.document.queues[1].roomAssignments ?? [];
    expect(assignments.filter((assignment) => assignment.roomType === "MANUFACTURE")).toHaveLength(5);
    expect(assignments.filter((assignment) => assignment.roomType === "POWER")).toHaveLength(3);

    const fourthRecord = assignments.find(
      (assignment) =>
        assignment.roomType === "MANUFACTURE" &&
        assignment.product === "CombatRecord" &&
        assignment.roomIndex === 4,
    );
    expect(fourthRecord?.operators[2].overrideName).toBe("Windflit");
  });

  it("reports unmatched operators, skipped plans and per-shift drone settings", () => {
    const report = maaCustomInfrastToScheduleImport(
      {
        title: "four plans",
        plans: [
          {
            name: "A",
            drones: { room: "manufacture", index: 1, enable: true, order: "pre" },
            rooms: { trading: [{ product: "LMD", operators: ["Unknown A"] }] },
          },
          {
            name: "B",
            drones: { room: "trading", index: 1, enable: true, order: "post" },
            rooms: { trading: [{ product: "LMD", operators: ["Unknown B"] }] },
          },
          { name: "C", rooms: { trading: [{ product: "LMD", operators: ["Blacknight"] }] } },
          { name: "D", rooms: { trading: [{ product: "LMD", operators: ["Jixing"] }] } },
        ],
      },
      operators,
    );

    expect(report?.importedPlanCount).toBe(3);
    expect(report?.skippedPlanCount).toBe(1);
    expect(report?.dronePlanCount).toBe(2);
    expect(report?.unmatchedOperatorNames).toEqual(["Unknown A", "Unknown B"]);
    expect(report?.document.droneSummary.targetRoomLabel).toBe("按班次配置");
  });
});
