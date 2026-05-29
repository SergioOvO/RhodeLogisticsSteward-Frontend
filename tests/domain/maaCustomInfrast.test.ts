import { describe, expect, it } from "vitest";
import { maaCustomInfrastToScheduleDocument } from "../../src/export/maaCustomInfrast";
import type { Operator } from "../../src/domain/types";

const operators: Operator[] = [
  {
    id: "op-blacknight",
    name: "黑键",
    portraitPath: "/operators/portraits/黑键.png",
    aliases: ["黑键"],
    tags: [],
    source: "mock",
  },
  {
    id: "op-jixing",
    name: "吉星",
    portraitPath: "/operators/portraits/吉星.png",
    aliases: ["吉星"],
    tags: [],
    source: "mock",
  },
  {
    id: "op-amiya",
    name: "阿米娅",
    portraitPath: "/operators/portraits/阿米娅.png",
    aliases: ["Amiya"],
    tags: [],
    source: "mock",
  },
];

describe("maaCustomInfrastToScheduleDocument", () => {
  it("converts MAA 243 custom_infrast plans into schedule queues", () => {
    const document = maaCustomInfrastToScheduleDocument(
      {
        title: "243-高配3队简化率",
        author: "一只摆烂的42",
        plans: [
          {
            name: "12H第一班",
            description: "下次在12小时后换班",
            drones: { room: "manufacture", index: 1, enable: true, order: "pre" },
            rooms: {
              control: [{ operators: ["阿米娅"] }],
              trading: [
                { product: "LMD", operators: ["黑键", "吉星", "可露希尔"] },
                { product: "LMD", operators: ["但书", "贝洛内", "伺夜"] },
              ],
              manufacture: [
                { product: "Battle Record", operators: ["野鬃", "远牙", "灰毫"] },
                { product: "Battle Record", operators: ["至简", "槐琥", "断罪者"] },
                { product: "Pure Gold", operators: ["清流", "温蒂", "森蚺"] },
                { product: "Pure Gold", operators: ["阿罗玛", "砾", "迷迭香"] },
              ],
              power: [{ operators: ["承曦格雷伊"] }, { operators: ["烛煌"] }, { operators: ["格雷伊"] }],
            },
          },
          { name: "12H第二班", rooms: {} },
          { name: "12H第三班", rooms: {} },
        ],
      },
      operators,
    );

    expect(document?.layoutId).toBe("243");
    expect(document?.queueCount).toBe(3);
    expect(document?.queues[0].label).toBe("12H第一班");
    expect(document?.authorText).toBe("一只摆烂的42");
    expect(document?.droneSummary.targetRoomLabel).toBe("制造站 1");

    const trade = document?.queues[0].roomAssignments.find(
      (assignment) => assignment.roomType === "TRADING" && assignment.roomIndex === 1,
    );
    expect(trade?.operators[0].operatorId).toBe("op-blacknight");
    expect(trade?.operators[1].operatorId).toBe("op-jixing");
    expect(trade?.operators[2].overrideName).toBe("可露希尔");
  });

  it("infers 153 layout from one trade, five manufacturing and three power rooms", () => {
    const document = maaCustomInfrastToScheduleDocument(
      {
        title: "153 极限效率",
        plans: [
          {
            name: "A+B 16H",
            rooms: {
              trading: [{ product: "LMD", operators: ["伺夜", "黑键", "但书"] }],
              manufacture: [
                { product: "Pure Gold", operators: ["苍苔", "砾", "斑点"] },
                { product: "Battle Record", operators: ["至简", "槐琥", "断罪者"] },
                { product: "Battle Record", operators: ["野鬃", "远牙", "灰毫"] },
                { product: "Battle Record", operators: ["淬羽赫默", "多萝西", "迷迭香"] },
                { product: "Battle Record", operators: ["温蒂", "异客", "掠风"] },
              ],
              power: [{ operators: ["承曦格雷伊"] }, { operators: ["Lancet-2"] }, { operators: ["格雷伊"] }],
            },
          },
        ],
      },
      operators,
    );

    expect(document?.layoutId).toBe("153");

    const assignments = document?.queues[0].roomAssignments ?? [];
    expect(assignments.filter((assignment) => assignment.roomType === "MANUFACTURE")).toHaveLength(5);
    expect(assignments.filter((assignment) => assignment.roomType === "POWER")).toHaveLength(3);

    const fourthRecord = assignments.find(
      (assignment) =>
        assignment.roomType === "MANUFACTURE" &&
        assignment.product === "CombatRecord" &&
        assignment.roomIndex === 4,
    );
    expect(fourthRecord?.operators[2].overrideName).toBe("掠风");
  });
});
