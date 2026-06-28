/** @fileoverview PNG 导出——html-to-image 2x 像素比，过滤拖拽手柄和导出隐藏元素。 */

import { toPng } from "html-to-image";
import type { ScheduleDocument } from "../domain/types";

function safeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "schedule";
}

export async function exportSchedulePng(element: HTMLElement, document: ScheduleDocument): Promise<void> {
  const hadExportingAttribute = element.hasAttribute("data-exporting");
  const previousExportingAttribute = element.getAttribute("data-exporting");

  element.setAttribute("data-exporting", "true");

  try {
    const dataUrl = await toPng(element, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#fffdf4",
      filter: (node) =>
        node instanceof HTMLElement
          ? !node.matches("[data-resize-handle], [data-export-hidden]")
          : true,
    });
    const anchor = globalThis.document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);

    anchor.href = dataUrl;
    anchor.download = `${safeFileName(document.title)}-${date}.png`;
    anchor.click();
  } finally {
    if (hadExportingAttribute && previousExportingAttribute !== null) {
      element.setAttribute("data-exporting", previousExportingAttribute);
    } else {
      element.removeAttribute("data-exporting");
    }
  }
}
