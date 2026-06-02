import { expect, test, type Locator, type Page } from "@playwright/test";
import { createDefaultSchedule } from "../../src/domain/createDefaultSchedule";

async function dragBy(page: Page, locator: Locator, dx: number, dy: number) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + dx, box!.y + box!.height / 2 + dy, {
    steps: 12,
  });
  await page.mouse.up();
}

async function dragTo(page: Page, source: Locator, target: Locator) {
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();

  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2, {
    steps: 16,
  });
  await page.mouse.up();
}

async function expectStrictTouchingSections(page: Page) {
  const rects = await page
    .locator("[data-poster-component-type='infrastructure'][data-poster-infrastructure-source='section']")
    .evaluateAll((nodes) =>
      nodes
        .map((node) => {
          const element = node as HTMLElement;
          return {
            id: element.dataset.posterComponentId,
            left: Number.parseFloat(element.style.left),
            top: Number.parseFloat(element.style.top),
            width: Number.parseFloat(element.style.width),
            height: Number.parseFloat(element.style.height),
          };
        })
        .sort((first, second) => first.left - second.left),
    );

  expect(rects.length).toBeGreaterThan(1);
  for (let index = 1; index < rects.length; index += 1) {
    const previous = rects[index - 1];
    const current = rects[index];

    expect(current.left, current.id).toBeCloseTo(previous.left + previous.width, 2);
    expect(current.top, current.id).toBeCloseTo(rects[0].top, 2);
    expect(current.height, current.id).toBeCloseTo(rects[0].height, 2);
  }
}

function emptyDraft() {
  const document = createDefaultSchedule("243", 3);

  return {
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
      schemaVersion: 2,
      sourceTemplateId: "matrix",
      components: [],
    },
  };
}

test("sample 153 renders the smart matrix poster with four queues visible", async ({ page }) => {
  await page.goto("/sample/153?queues=4");

  await expect(page.locator("[data-poster-canvas]")).toBeVisible();
  await expect(page.locator("[data-poster-canvas]")).toHaveAttribute("data-poster-template", "matrix");
  await expect.poll(async () => page.locator("[data-poster-component]").count()).toBeGreaterThan(10);
  await expect(page.locator("[data-poster-lane]")).toHaveCount(4);
  await expect(page.locator("[data-poster-slot]")).toHaveCount(116);
  await expect(page.locator("[data-poster-slot][data-filled='true']")).toHaveCount(0);
  await expect(page.locator("[data-portrait-frame]")).toHaveCount(0);
  await expectStrictTouchingSections(page);
  await expect(page.getByRole("navigation", { name: /queue|队列/i })).toHaveCount(0);
  await expect(page.locator("[data-facility-template]")).toHaveCount(6);
  await expect(page.locator("[data-operator-pool-card]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "导出图片" })).toHaveCount(1);
  await expect(page.locator("[data-canvas-root]").getByText("导出图片")).toHaveCount(0);
});

test("sample 153 renders strict touching sections with two queues", async ({ page }) => {
  await page.goto("/sample/153?queues=2");

  await expect(page.locator("[data-poster-canvas]")).toHaveAttribute("data-poster-template", "splitPanel");
  await expect(page.locator("[data-poster-lane]")).toHaveCount(2);
  await expect(page.locator("[data-poster-slot]")).toHaveCount(58);
  await expectStrictTouchingSections(page);
});

test("poster editing controls stay outside the export canvas", async ({ page }) => {
  await page.goto("/sample/243");

  await expect(page.locator("[data-canvas-root] > header")).toHaveCount(0);
  await expect(page.locator("[data-poster-editor-toolbar]")).toBeVisible();
  await expect(page.locator("[data-poster-clear-chip]")).toHaveCount(0);
  await expect(page.locator("[data-clear-drop-zone]")).toHaveCount(0);
  await expect(page.locator("[data-canvas-root] [data-poster-editor-toolbar]")).toHaveCount(0);
  await expect(page.locator("[data-canvas-root] [data-poster-component-actions]")).toHaveCount(0);

  await page.locator("[data-poster-component]").first().click();
  await expect(page.locator("[data-poster-editor-toolbar]")).not.toContainText("已选中");
  await expect(page.locator("[data-poster-editor-toolbar] [data-poster-component-template]")).toHaveCount(0);
  await expect(page.locator("[data-canvas-root] [data-poster-component-actions]")).toHaveCount(0);

  await page.locator("[data-poster-component]").first().click({ button: "right" });
  await expect(page.locator("[data-poster-component-menu-item='duplicate']")).toBeVisible();
  await expect(page.locator("[data-poster-component-menu-item='delete']")).toBeVisible();
});

test("collapsing the sidebar and focus mode expand the editing canvas", async ({ page }) => {
  await page.goto("/sample/153?queues=4");

  const scroller = page.locator("[data-canvas-scroller]");
  const before = await scroller.boundingBox();
  expect(before).not.toBeNull();

  await page.getByRole("button", { name: "隐藏侧栏" }).click();
  await expect(page.locator("[data-sidebar-collapsed='true']").first()).toBeVisible();

  const afterCollapse = await scroller.boundingBox();
  expect(afterCollapse).not.toBeNull();
  expect(afterCollapse!.width).toBeGreaterThan(before!.width + 80);

  await page.getByRole("button", { name: "专注编辑" }).click();
  await expect(page.locator("[data-focus-mode='true']")).toHaveCount(1);
  await expect(page.getByText("导入")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "导出图片" })).toBeVisible();
  await expect(page.getByRole("button", { name: "退出专注" })).toBeVisible();
  await expect(page.locator("select[aria-label='布局']")).toBeVisible();
  await expect(page.locator("select[aria-label='队列']")).toBeVisible();
});

test("free poster components can be dragged, undone, cleared, and regenerated", async ({ page }) => {
  await page.goto("/sample/153?queues=4");

  const component = page.locator("[data-poster-component]").first();
  const before = await component.evaluate((node) => ({
    left: Number.parseFloat((node as HTMLElement).style.left),
    top: Number.parseFloat((node as HTMLElement).style.top),
  }));

  await dragBy(page, component.locator("[data-poster-component-handle]"), 90, 60);
  await expect
    .poll(async () => Number.parseFloat(await component.evaluate((node) => (node as HTMLElement).style.left)))
    .toBeGreaterThan(before.left);

  await page.getByRole("button", { name: "撤销" }).click();
  await expect
    .poll(async () => Number.parseFloat(await component.evaluate((node) => (node as HTMLElement).style.left)))
    .toBe(before.left);

  await page.getByRole("button", { name: "重做" }).click();
  await expect
    .poll(async () => Number.parseFloat(await component.evaluate((node) => (node as HTMLElement).style.left)))
    .toBeGreaterThan(before.left);

  await page.getByRole("button", { name: "清空" }).click();
  await expect(page.locator("[data-poster-component]")).toHaveCount(0);

  await page.getByRole("button", { name: "重排海报" }).click();
  await expect.poll(async () => page.locator("[data-poster-component]").count()).toBeGreaterThan(10);
});

test("free poster components resize from selected edge handles", async ({ page }) => {
  await page.goto("/sample/153?queues=4");

  const component = page.locator("[data-poster-component]").first();
  await component.click();

  const before = await component.evaluate((node) => ({
    width: Number.parseFloat((node as HTMLElement).style.width),
  }));

  await dragBy(page, component.locator('[data-poster-resize-handle="right"]'), 80, 0);

  await expect
    .poll(async () => Number.parseFloat(await component.evaluate((node) => (node as HTMLElement).style.width)))
    .toBeGreaterThan(before.width);
});

test("empty poster canvas accepts dragged infrastructure templates", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((draft) => {
    window.localStorage.setItem("rhode-logistics-schedule-draft-v2", JSON.stringify(draft));
  }, emptyDraft());
  await page.reload();

  await expect(page.locator("[data-poster-component]")).toHaveCount(0);
  await dragTo(page, page.getByRole("button", { name: /贸易站/ }), page.locator("[data-poster-canvas]"));

  const component = page.locator("[data-poster-component-type='infrastructure']");
  await expect(component).toHaveCount(1);
  const placed = await component.evaluate((node) => ({
    left: Number.parseFloat((node as HTMLElement).style.left),
    top: Number.parseFloat((node as HTMLElement).style.top),
    width: Number.parseFloat((node as HTMLElement).style.width),
    height: Number.parseFloat((node as HTMLElement).style.height),
  }));
  expect(placed.width).toBeGreaterThan(18);
  expect(placed.height).toBeGreaterThan(40);
  await expect(component).toHaveAttribute("data-poster-infrastructure-source", "section");
  await expect(component.locator("[data-poster-compact-infrastructure]")).toHaveCount(0);
  await expect(component.locator("[data-room-node-id='trading-1']")).toHaveCount(3);
  await expect(component.locator("[data-poster-slot]").first()).toBeVisible();
  await expect(component.locator("[data-portrait-frame]")).toHaveCount(0);

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const draft = JSON.parse(window.localStorage.getItem("rhode-logistics-schedule-draft-v2") ?? "{}");
        return {
          componentSectionId: draft.posterCanvas?.components?.[0]?.sectionId,
          componentRoomNodeId: draft.posterCanvas?.components?.[0]?.roomNodeId,
          roomType: draft.canvas?.rooms?.[0]?.roomType,
        };
      }),
    )
    .toEqual({ componentSectionId: "trade", componentRoomNodeId: undefined, roomType: "TRADING" });
});

test("empty poster canvas places dragged text components at the drop point", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((draft) => {
    window.localStorage.setItem("rhode-logistics-schedule-draft-v2", JSON.stringify(draft));
  }, emptyDraft());
  await page.reload();

  await dragTo(page, page.getByRole("button", { name: /文本备注/ }), page.locator("[data-poster-canvas]"));

  const component = page.locator("[data-poster-component-type='note']");
  await expect(component).toHaveCount(1);
  const placed = await component.evaluate((node) => ({
    left: Number.parseFloat((node as HTMLElement).style.left),
    top: Number.parseFloat((node as HTMLElement).style.top),
  }));
  expect(placed.left).toBeCloseTo(28.2, 1);
  expect(placed.top).toBeCloseTo(48, 1);

  const editable = component.getByRole("textbox").first();
  await editable.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.type("editable note");
  await expect(editable).toHaveText("editable note");
  await expect
    .poll(async () =>
      editable.evaluate((node) => {
        const style = getComputedStyle(node as HTMLElement);
        return {
          boxShadow: style.boxShadow,
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
        };
      }),
    )
    .toEqual({
      boxShadow: "none",
      outlineStyle: "none",
      outlineWidth: "0px",
    });
});

test("dropped manufacturing poster section stays editable and slot-clickable", async ({ page }) => {
  await page.goto("/sample/243");

  await dragTo(
    page,
    page.locator("[data-facility-template][data-color-role='manufacture']").first(),
    page.locator("[data-poster-canvas]"),
  );

  const component = page.locator("[data-poster-infrastructure-source='section']").last();
  await expect(component).toBeVisible();
  await expect(component.locator("[data-poster-compact-infrastructure]")).toHaveCount(0);
  await expect(component.locator("[data-poster-slot]").first()).toBeVisible();

  const title = component.getByRole("textbox", { name: /编辑.*标题/ }).first();
  await title.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.type("手动制造区");
  await page.locator("[data-poster-canvas]").click({ position: { x: 5, y: 5 } });
  await expect(title).toHaveText("手动制造区");

  await component.locator("[data-poster-slot]").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const draft = JSON.parse(window.localStorage.getItem("rhode-logistics-schedule-draft-v2") ?? "{}");
        const component = draft.posterCanvas?.components?.find(
          (item: { sectionId?: string; title?: string }) => item.title === "手动制造区" && item.sectionId,
        );
        return { sectionId: component?.sectionId, roomNodeId: component?.roomNodeId, title: component?.title };
      }),
    )
    .toEqual({ sectionId: "gold", roomNodeId: undefined, title: "手动制造区" });
});

test("guide toggle hides the card template guide grid", async ({ page }) => {
  await page.goto("/sample/243?template=card");

  const bentoCanvas = page.locator("[data-bento-canvas]");
  await expect(bentoCanvas).toHaveAttribute("data-guides-visible", "true");
  await page.locator("[data-poster-guides-toggle]").click();
  await expect(bentoCanvas).toHaveAttribute("data-guides-visible", "false");

  await expect
    .poll(async () => bentoCanvas.evaluate((node) => getComputedStyle(node as HTMLElement).backgroundImage))
    .toBe("none");
});

test("guide toggle hides poster canvas guide backgrounds", async ({ page }) => {
  await page.goto("/sample/243");

  const canvasRoot = page.locator("[data-canvas-root]");
  const posterCanvas = page.locator("[data-poster-canvas]");
  await expect(canvasRoot).toHaveAttribute("data-guides-visible", "true");
  await expect(posterCanvas).toHaveAttribute("data-guides-visible", "true");
  await expect(page.locator("[data-poster-guide-layer]")).toHaveCount(1);
  await expect
    .poll(async () => canvasRoot.evaluate((node) => getComputedStyle(node as HTMLElement).backgroundImage))
    .not.toBe("none");

  await page.locator("[data-poster-guides-toggle]").click();

  await expect(canvasRoot).toHaveAttribute("data-guides-visible", "false");
  await expect(posterCanvas).toHaveAttribute("data-guides-visible", "false");
  await expect(page.locator("[data-poster-guide-layer]")).toHaveCount(0);
  await expect
    .poll(async () => canvasRoot.evaluate((node) => getComputedStyle(node as HTMLElement).backgroundImage))
    .toBe("none");
  await expect
    .poll(async () => posterCanvas.evaluate((node) => getComputedStyle(node as HTMLElement).backgroundImage))
    .toBe("none");
});

test("export mode strips canvas padding and guide backgrounds", async ({ page }) => {
  await page.goto("/sample/243?template=card");

  const canvasRoot = page.locator("[data-canvas-root]");
  const bentoCanvas = page.locator("[data-bento-canvas]");
  await expect(bentoCanvas).toHaveAttribute("data-guides-visible", "true");

  await canvasRoot.evaluate((node) => (node as HTMLElement).setAttribute("data-exporting", "true"));

  await expect
    .poll(async () => canvasRoot.evaluate((node) => getComputedStyle(node as HTMLElement).backgroundImage))
    .toBe("none");
  await expect
    .poll(async () =>
      canvasRoot.evaluate((node) => getComputedStyle((node as HTMLElement).firstElementChild as HTMLElement).paddingTop),
    )
    .toBe("0px");
  await expect
    .poll(async () => bentoCanvas.evaluate((node) => getComputedStyle(node as HTMLElement).backgroundImage))
    .toBe("none");
});

test("poster component drag snaps to the dense guide grid", async ({ page }) => {
  await page.goto("/sample/153?queues=4");

  const component = page.locator("[data-poster-component]").first();
  const canvasBox = await page.locator("[data-poster-canvas]").boundingBox();
  expect(canvasBox).not.toBeNull();

  const beforeLeft = await component.evaluate((node) => Number.parseFloat((node as HTMLElement).style.left));
  const guideStepPercent = 100 / 24;
  const targetGuide = guideStepPercent * 2;
  const dragDx = canvasBox!.width * ((targetGuide - beforeLeft - 0.25) / 100);

  await dragBy(page, component.locator("[data-poster-component-handle]"), dragDx, 0);

  await expect
    .poll(async () => Number.parseFloat(await component.evaluate((node) => (node as HTMLElement).style.left)))
    .toBeCloseTo(targetGuide, 2);
});

test("combo and jade poster routes render their dedicated sections", async ({ page }) => {
  await page.goto("/sample/252?mode=combo");

  await expect(page.locator("[data-poster-canvas]")).toHaveAttribute("data-poster-template", "combo");
  await expect(page.locator("[data-poster-lane]")).toHaveCount(6);
  await expectStrictTouchingSections(page);

  await page.goto("/sample/342?strategy=origin-stone");
  await expect(page.locator("[data-poster-canvas]")).toHaveAttribute("data-poster-template", "matrix");
  await expect(page.getByText("搓玉制造")).toBeVisible();
  await expect(page.getByText("玉贸易")).toBeVisible();
});

test("clicking a room slot opens the operator picker and search filters by name", async ({ page }) => {
  await page.goto("/");

  const manufactureSlot = page.locator('[data-room-node-id="manufacture-1"] [data-poster-slot]').first();
  await manufactureSlot.click();

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("房间技能")).toBeVisible();
  await expect(page.getByText("产物公式")).toBeVisible();
  await expect(page.getByLabel("仅显示已上板干员")).toBeVisible();

  const search = page.getByPlaceholder("名称 / alias");
  await search.fill("清流");
  await expect(page.getByRole("button", { name: /清流/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /斯卡蒂/ })).toHaveCount(0);
});

test("room movement and edge resize snap to the 6 by 4 grid", async ({ page }) => {
  await page.goto("/sample/243?template=card");

  const canvasBox = await page.locator("[data-bento-canvas]").boundingBox();
  expect(canvasBox).not.toBeNull();
  const cellWidth = canvasBox!.width / 6;
  const cellHeight = canvasBox!.height / 4;

  const room = page.locator('[data-room-node-id="manufacture-1"]');
  const header = room.locator("header");
  const before = await room.evaluate((node) => ({
    left: Number.parseFloat((node as HTMLElement).style.left),
    top: Number.parseFloat((node as HTMLElement).style.top),
    width: Number.parseFloat((node as HTMLElement).style.width),
    height: Number.parseFloat((node as HTMLElement).style.height),
  }));

  await dragBy(page, header, 0, cellHeight * 2);
  await expect
    .poll(async () => Number.parseFloat(await room.evaluate((node) => (node as HTMLElement).style.top)))
    .toBeGreaterThan(before.top);

  const afterMove = await room.evaluate((node) => ({
    left: Number.parseFloat((node as HTMLElement).style.left),
    top: Number.parseFloat((node as HTMLElement).style.top),
  }));
  expect(Math.round((afterMove.left - before.left) / (100 / 6))).toBe(0);
  expect(Math.round((afterMove.top - before.top) / (100 / 4))).toBe(2);

  await dragBy(page, room.locator('[data-resize-handle="right"]'), cellWidth, 0);
  await expect
    .poll(async () => Number.parseFloat(await room.evaluate((node) => (node as HTMLElement).style.width)))
    .toBeGreaterThan(before.width);

  await dragBy(page, room.locator('[data-resize-handle="bottom"]'), 0, cellHeight);
  await expect
    .poll(async () => Number.parseFloat(await room.evaluate((node) => (node as HTMLElement).style.height)))
    .toBeGreaterThan(before.height);
});

test("operator portraits stay square and use one consistent size", async ({ page }) => {
  await page.goto("/sample/342?strategy=origin-stone");

  const targetSlot = page.locator('[data-poster-slot][data-filled="false"]').first();
  await expect(targetSlot.locator("[data-empty-slot-add]")).toHaveText("+");
  await expect(targetSlot.locator("[data-portrait-frame]")).toHaveCount(0);
  const frameCountBefore = await page.locator("[data-portrait-frame]").count();

  await targetSlot.click();
  await page.getByRole("dialog").locator("[data-operator-picker-card]").first().click();
  await expect.poll(async () => page.locator("[data-portrait-frame]").count()).toBeGreaterThan(frameCountBefore);

  const frames = await page.locator("[data-portrait-frame]").evaluateAll((nodes) =>
    nodes.slice(0, 12).map((node) => {
      const rect = (node as HTMLElement).getBoundingClientRect();
      return { width: Math.round(rect.width), height: Math.round(rect.height) };
    }),
  );

  expect(frames.length).toBeGreaterThan(0);
  for (const frame of frames) {
    expect(frame.width).toBe(frame.height);
    expect(frame.width).toBe(frames[0].width);
    expect(frame.width).toBeGreaterThanOrEqual(28);
  }
});
