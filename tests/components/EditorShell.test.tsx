import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorShell } from "../../src/components/editor/EditorShell";
import { createDefaultSchedule } from "../../src/domain/createDefaultSchedule";

const emptyReference = {
  source: {
    localSourcePath: "",
    upstreamRepository: "",
    upstreamCommit: "",
    generatedAt: "",
    rowCounts: {},
  },
  roomTypes: [],
  productionFormulaTypes: [],
  operatorSkills: [],
  skillsById: {},
};

const operatorManifest = {
  source: {
    localSourcePath: "",
    metadataRows: 1,
    portraitFiles: 1,
    professionIconFiles: 0,
    rarityIconFiles: 0,
    eliteIconFiles: 0,
    warnings: [],
  },
  operators: [
    {
      id: "op-amiya",
      name: "Amiya",
      portraitPath: "",
      aliases: ["阿米娅"],
      tags: [],
      source: "mock",
    },
  ],
};

const buildingReference = {
  source: {
    localSourcePath: "",
    upstreamRepository: "",
    upstreamCommit: "",
    generatedAt: "",
    rowCounts: {},
  },
  roomTypes: [
    {
      id: "MANUFACTURE",
      label: "Manufacture",
      operatorCount: 1,
      skillRowCount: 1,
    },
  ],
  productionFormulaTypes: [
    {
      id: "F_EXP",
      label: "Battle Record",
      sources: ["manufacturing"],
      buffTypeIds: ["skill-a"],
      itemNames: ["Battle Record"],
      skillTargetCount: 1,
    },
  ],
  operatorSkills: [
    {
      operatorId: "op-amiya",
      operatorName: "Amiya",
      roomType: "MANUFACTURE",
      buffId: "skill-a",
      buffName: "Manufacture",
      descriptionText: "",
      targetFormulaTypes: ["F_EXP"],
      conditionPhase: "PHASE_0",
      conditionLevel: 1,
    },
  ],
  skillsById: {
    "skill-a": {
      buffId: "skill-a",
      buffName: "Manufacture",
      roomType: "MANUFACTURE",
      descriptionText: "",
      efficiency: 0,
      targetFormulaTypes: ["F_EXP"],
    },
  },
};

function mockStaticData() {
  vi.stubGlobal(
    "fetch",
    vi.fn((path: string) =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(path.includes("operators") ? operatorManifest : buildingReference),
      }),
    ),
  );
}

describe("EditorShell layout space controls", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockStaticData();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("collapses and expands the facility sidebar", async () => {
    const { container } = render(<EditorShell initialDocument={createDefaultSchedule("243", 3)} />);

    await waitFor(() => expect(container.querySelector("button[aria-label='隐藏侧栏']")).toBeInTheDocument());
    expect(screen.queryByText("罗德岛排班表生成器")).not.toBeInTheDocument();
    expect(screen.queryByText("设施")).not.toBeInTheDocument();
    expect(screen.queryByText("重置当前布局")).not.toBeInTheDocument();
    expect(
      Array.from(container.querySelectorAll("button")).filter((button) => button.textContent?.includes("重置")),
    ).toHaveLength(1);
    expect(container.querySelector("button[aria-label='隐藏侧栏']")).toHaveAttribute("data-icon-only", "true");
    expect(container.querySelector("[data-sidebar-collapsed='false']")).toBeInTheDocument();

    fireEvent.click(container.querySelector("button[aria-label='隐藏侧栏']")!);

    expect(container.querySelector("button[aria-label='展开侧栏']")).toHaveAttribute("data-icon-only", "true");
    expect(container.querySelector("[data-sidebar-collapsed='true']")).toBeInTheDocument();

    fireEvent.click(container.querySelector("button[aria-label='展开侧栏']")!);

    expect(screen.queryByText("设施")).not.toBeInTheDocument();
    expect(container.querySelector("[data-sidebar-collapsed='false']")).toBeInTheDocument();
  });

  it("enters focus mode with only critical editing controls visible", async () => {
    const { container } = render(<EditorShell initialDocument={createDefaultSchedule("243", 3)} />);

    await waitFor(() => expect(screen.getByText("专注编辑")).toBeInTheDocument());
    fireEvent.click(screen.getByText("专注编辑"));

    expect(container.querySelector("[data-focus-mode='true']")).toBeInTheDocument();
    expect(screen.queryByText("导入")).not.toBeInTheDocument();
    expect(screen.getByText("导出图片")).toBeInTheDocument();
    expect(screen.getByText("退出专注")).toBeInTheDocument();
    expect(container.querySelector("select[aria-label='布局']")).toBeInTheDocument();
    expect(container.querySelector("select[aria-label='队列']")).toBeInTheDocument();

    fireEvent.click(screen.getByText("退出专注"));

    expect(container.querySelector("[data-focus-mode='false']")).toBeInTheDocument();
    expect(screen.getByText("导入")).toBeInTheDocument();
  });

  it("keeps poster editing actions outside the export canvas", async () => {
    const { container } = render(<EditorShell initialDocument={createDefaultSchedule("243", 3)} />);

    await waitFor(() => expect(container.querySelector("[data-poster-editor-toolbar]")).toBeInTheDocument());

    expect(container.querySelector("[data-poster-clear-chip]")).toBeNull();
    expect(container.querySelector("[data-clear-drop-zone]")).toBeNull();
    expect(container.querySelector("[data-canvas-root] [data-poster-editor-toolbar]")).toBeNull();

    const component = container.querySelector("[data-poster-component]") as HTMLElement;
    fireEvent.click(component);

    const toolbar = container.querySelector("[data-poster-editor-toolbar]") as HTMLElement;
    for (const label of ["重排海报", "撤销", "重做", "清空", "隐藏参考线"]) {
      expect(within(toolbar).getByRole("button", { name: label })).toHaveAttribute("data-size", "sm");
    }
    expect(toolbar).not.toHaveTextContent("已选中");
    expect(toolbar.querySelector("[data-poster-component-add-control]")).toBeNull();
    expect(container.querySelector("[data-canvas-root] [data-poster-component-actions]")).toBeNull();
  });

  it("clears all poster canvas components from the editor toolbar", async () => {
    const { container } = render(<EditorShell initialDocument={createDefaultSchedule("243", 3)} />);

    await waitFor(() => expect(container.querySelector("[data-poster-component]")).toBeInTheDocument());
    expect(container.querySelectorAll("[data-poster-component]").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "重做" })).toBeDisabled();

    const clearButton = screen.getByRole("button", { name: "清空" });
    expect(clearButton).toHaveAttribute("data-poster-clear-canvas", "true");
    fireEvent.click(clearButton);

    await waitFor(() => expect(container.querySelectorAll("[data-poster-component]")).toHaveLength(0));
  });

  it("keeps poster component add controls in the sidebar", async () => {
    const { container } = render(<EditorShell initialDocument={createDefaultSchedule("243", 3)} />);

    await waitFor(() => expect(container.querySelector("[data-poster-component-template]")).toBeInTheDocument());

    expect(container.querySelectorAll("[data-poster-component-template]")).toHaveLength(3);
    expect(container.querySelector("[data-poster-editor-toolbar] [data-poster-component-template]")).toBeNull();
    expect(container.querySelector("[data-poster-editor-toolbar] [data-poster-component-add-control]")).toBeNull();
  });

  it("controls poster snap with a switch state", async () => {
    const { container } = render(<EditorShell initialDocument={createDefaultSchedule("243", 3)} />);

    await waitFor(() => expect(container.querySelector("[data-poster-snap-toggle]")).toBeInTheDocument());

    const snapToggle = container.querySelector("[data-poster-snap-toggle]") as HTMLElement;
    expect(snapToggle).toHaveAttribute("data-checked");

    fireEvent.click(snapToggle);

    expect(snapToggle).toHaveAttribute("data-unchecked");
  });

  it("shows a fatal load error instead of rendering the editor with empty backend data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((path: string) =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve(
              path.includes("operators")
                ? {
                    source: {
                      localSourcePath: "",
                      metadataRows: 0,
                      portraitFiles: 0,
                      professionIconFiles: 0,
                      rarityIconFiles: 0,
                      eliteIconFiles: 0,
                      warnings: [],
                    },
                    operators: [],
                  }
                : emptyReference,
            ),
        }),
      ),
    );

    const { container } = render(<EditorShell initialDocument={createDefaultSchedule("243", 3)} />);

    await waitFor(() => expect(screen.getByText(/operator manifest/i)).toBeInTheDocument());
    expect(container.querySelector("[data-canvas-root]")).not.toBeInTheDocument();
  });
});
