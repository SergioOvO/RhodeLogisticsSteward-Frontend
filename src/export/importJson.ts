import { validateScheduleDocument } from "../domain/scheduleDocument";
import type { Operator, ScheduleDocument } from "../domain/types";
import { maaCustomInfrastToScheduleDocument } from "./maaCustomInfrast";

export async function importScheduleJson(file: File, operators: Operator[] = []): Promise<ScheduleDocument> {
  const text = await file.text();
  const parsed = JSON.parse(text) as unknown;

  if (validateScheduleDocument(parsed)) {
    return parsed;
  }

  const maaDocument = maaCustomInfrastToScheduleDocument(parsed, operators);
  if (maaDocument) {
    return maaDocument;
  }

  throw new Error("导入文件既不是 ScheduleDocument v1，也不是 MAA custom_infrast 排班表。");
}
