/** @fileoverview JSON 导入——支持原生 .json 和 MAA custom_infrast 格式，自动迁移 V1→V2。 */

import { migrateScheduleDocument } from "../domain/migrateScheduleDocument";
import type { Operator, ScheduleDocument } from "../domain/types";
import { maaCustomInfrastToScheduleImport, type MaaImportReport } from "./maaCustomInfrast";

export interface ImportScheduleResult {
  document: ScheduleDocument;
  message?: string;
}

function maaImportMessage(report: MaaImportReport): string {
  const parts = [`已导入 ${report.importedPlanCount} 个 MAA 班次。`];

  if (report.skippedPlanCount > 0) {
    parts.push(`已跳过 ${report.skippedPlanCount} 个额外班次，画布最多支持 3 班。`);
  }
  if (report.unmatchedOperatorNames.length > 0) {
    parts.push(`${report.unmatchedOperatorNames.length} 名干员未匹配，已保留原名显示。`);
  }
  if (report.dronePlanCount > 1) {
    parts.push("无人机配置已按班次汇总。");
  }

  return parts.join(" ");
}

export async function importScheduleJson(
  file: File,
  operators: Operator[] = [],
): Promise<ImportScheduleResult> {
  const text = await file.text();
  const parsed = JSON.parse(text) as unknown;

  const migrated = migrateScheduleDocument(parsed);
  if (migrated) {
    return { document: migrated };
  }

  const maaReport = maaCustomInfrastToScheduleImport(parsed, operators);
  if (maaReport) {
    return {
      document: maaReport.document,
      message: maaImportMessage(maaReport),
    };
  }

  throw new Error("导入文件既不是 ScheduleDocument v2/v1，也不是 MAA custom_infrast 排班表。");
}
