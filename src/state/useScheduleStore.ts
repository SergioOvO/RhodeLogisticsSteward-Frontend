/** @fileoverview 全局状态管理——封装 scheduleDocument 变更、localStorage 持久化、海报画布撤销/重做。 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { createDefaultSchedule } from "../domain/createDefaultSchedule";
import { buildDefaultPosterCanvas, normalizePosterCanvas } from "../domain/posterCanvas";
import {
  assignOperator,
  clearSlot,
  addInfrastructureComponent,
  addRoom,
  addPosterComponent,
  clearPosterCanvas,
  deletePosterComponent,
  duplicatePosterComponent,
  movePosterComponentLayer,
  moveRoom,
  regeneratePosterCanvas,
  removeRoom,
  resizeRoom,
  setActiveQueue,
  setSlotElitePhase,
  setLayout,
  setQueueCount,
  setRoomProduct,
  swapSlots,
  updateMetadata,
  updatePosterComponentContent,
  updatePosterComponentRect,
  updatePosterSettings,
  updateQueueLabels,
  updateRoomEfficiencyLabels,
  validateScheduleDocument,
  type ScheduleMetadataPatch,
  type PosterComponentAddKind,
  type PosterComponentContentPatch,
  type PosterSettingsPatch,
} from "../domain/scheduleDocument";
import type {
  BentoRoomTypeId,
  ElitePhase,
  GridRect,
  PosterCanvasState,
  PosterRect,
  ProductKind,
  ScheduleDocument,
  SlotAddress,
} from "../domain/types";
import { clearLocalDraft, loadLocalDraft, saveLocalDraft } from "./useLocalDraft";

interface PosterCanvasHistory {
  past: PosterCanvasState[];
  future: PosterCanvasState[];
}

export function useScheduleStore(initialDocument?: ScheduleDocument) {
  const [document, setDocument] = useState<ScheduleDocument>(() => {
    if (initialDocument) {
      return initialDocument;
    }

    return loadLocalDraft() ?? createDefaultSchedule();
  });
  const [posterCanvasHistory, setPosterCanvasHistory] = useState<PosterCanvasHistory>({
    past: [],
    future: [],
  });

  useEffect(() => {
    saveLocalDraft(document);
  }, [document]);

  const assignedOperatorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const queue of document.queues) {
      for (const assignment of queue.roomAssignments) {
        for (const slot of assignment.operators) {
          if (slot.operatorId) {
            ids.add(slot.operatorId);
          }
        }
      }
    }
    return ids;
  }, [document]);

  const replaceDocument = useCallback((next: unknown): boolean => {
    if (!validateScheduleDocument(next)) {
      return false;
    }

    setDocument(next);
    setPosterCanvasHistory({ past: [], future: [] });
    return true;
  }, []);

  const currentPosterCanvas = useCallback(
    (source: ScheduleDocument) =>
      normalizePosterCanvas(source.posterCanvas ?? buildDefaultPosterCanvas(source), source),
    [],
  );

  const commitPosterCanvasChange = useCallback(
    (updater: (current: ScheduleDocument) => ScheduleDocument) => {
      setDocument((current) => {
        const previousPosterCanvas = currentPosterCanvas(current);
        const next = updater(current);
        const nextPosterCanvas = currentPosterCanvas(next);

        setPosterCanvasHistory((history) => ({
          past: [...history.past, previousPosterCanvas],
          future: [],
        }));

        return {
          ...next,
          posterCanvas: nextPosterCanvas,
        };
      });
    },
    [currentPosterCanvas],
  );

  return {
    document,
    assignedOperatorIds,
    setLayout: useCallback((layoutId: string) => {
      setDocument((current) => setLayout(current, layoutId));
      setPosterCanvasHistory({ past: [], future: [] });
    }, []),
    setQueueCount: useCallback((count: number) => {
      setDocument((current) => setQueueCount(current, count));
      setPosterCanvasHistory({ past: [], future: [] });
    }, []),
    setActiveQueue: useCallback((queueId: string) => {
      setDocument((current) => setActiveQueue(current, queueId));
    }, []),
    moveRoom: useCallback((roomNodeId: string, rect: GridRect) => {
      setDocument((current) => moveRoom(current, roomNodeId, rect));
    }, []),
    resizeRoom: useCallback((roomNodeId: string, rect: GridRect) => {
      setDocument((current) => resizeRoom(current, roomNodeId, rect));
    }, []),
    addRoom: useCallback((roomType: BentoRoomTypeId, center?: Pick<GridRect, "x" | "y">) => {
      setDocument((current) => addRoom(current, roomType, center));
    }, []),
    removeRoom: useCallback((roomNodeId: string) => {
      setDocument((current) => removeRoom(current, roomNodeId));
    }, []),
    setRoomProduct: useCallback((roomNodeId: string, product?: ProductKind) => {
      setDocument((current) => setRoomProduct(current, roomNodeId, product));
    }, []),
    assignOperator: useCallback(
      (queueId: string, assignmentId: string, slotIndex: number, operatorId: string) => {
        setDocument((current) => assignOperator(current, queueId, assignmentId, slotIndex, operatorId));
      },
      [],
    ),
    clearSlot: useCallback((queueId: string, assignmentId: string, slotIndex: number) => {
      setDocument((current) => clearSlot(current, queueId, assignmentId, slotIndex));
    }, []),
    setSlotElitePhase: useCallback(
      (queueId: string, assignmentId: string, slotIndex: number, elitePhase?: ElitePhase) => {
        setDocument((current) =>
          setSlotElitePhase(current, queueId, assignmentId, slotIndex, elitePhase),
        );
      },
      [],
    ),
    swapSlots: useCallback((source: SlotAddress, target: SlotAddress) => {
      setDocument((current) => swapSlots(current, source, target));
    }, []),
    updateMetadata: useCallback((patch: ScheduleMetadataPatch) => {
      setDocument((current) => updateMetadata(current, patch));
    }, []),
    updatePosterSettings: useCallback((patch: PosterSettingsPatch) => {
      setDocument((current) => updatePosterSettings(current, patch));
      setPosterCanvasHistory({ past: [], future: [] });
    }, []),
    regeneratePosterCanvas: useCallback(() => {
      commitPosterCanvasChange((current) => regeneratePosterCanvas(current));
    }, [commitPosterCanvasChange]),
    clearPosterCanvas: useCallback(() => {
      commitPosterCanvasChange((current) => clearPosterCanvas(current));
    }, [commitPosterCanvasChange]),
    updatePosterComponentRect: useCallback((componentId: string, rect: PosterRect) => {
      commitPosterCanvasChange((current) => updatePosterComponentRect(current, componentId, rect));
    }, [commitPosterCanvasChange]),
    updatePosterComponentContent: useCallback((componentId: string, patch: PosterComponentContentPatch) => {
      commitPosterCanvasChange((current) => updatePosterComponentContent(current, componentId, patch));
    }, [commitPosterCanvasChange]),
    addPosterComponent: useCallback((kind: PosterComponentAddKind, center?: Pick<PosterRect, "x" | "y">) => {
      commitPosterCanvasChange((current) => addPosterComponent(current, kind, center));
    }, [commitPosterCanvasChange]),
    addInfrastructureComponent: useCallback((roomType: BentoRoomTypeId, center?: Pick<PosterRect, "x" | "y">) => {
      commitPosterCanvasChange((current) => addInfrastructureComponent(current, roomType, center));
    }, [commitPosterCanvasChange]),
    duplicatePosterComponent: useCallback((componentId: string) => {
      commitPosterCanvasChange((current) => duplicatePosterComponent(current, componentId));
    }, [commitPosterCanvasChange]),
    deletePosterComponent: useCallback((componentId: string) => {
      commitPosterCanvasChange((current) => deletePosterComponent(current, componentId));
    }, [commitPosterCanvasChange]),
    movePosterComponentLayer: useCallback((componentId: string, direction: "up" | "down") => {
      commitPosterCanvasChange((current) => movePosterComponentLayer(current, componentId, direction));
    }, [commitPosterCanvasChange]),
    undoPosterCanvas: useCallback(() => {
      const previous = posterCanvasHistory.past.at(-1);
      if (!previous) {
        return;
      }

      const currentCanvas = currentPosterCanvas(document);
      setDocument((current) => ({ ...current, posterCanvas: previous }));
      setPosterCanvasHistory((history) => {
        if (history.past.length === 0) {
          return history;
        }

        return {
          past: history.past.slice(0, -1),
          future: [currentCanvas, ...history.future],
        };
      });
    }, [currentPosterCanvas, document, posterCanvasHistory.past]),
    redoPosterCanvas: useCallback(() => {
      const nextCanvas = posterCanvasHistory.future[0];
      if (!nextCanvas) {
        return;
      }

      const currentCanvas = currentPosterCanvas(document);
      setDocument((current) => ({ ...current, posterCanvas: nextCanvas }));
      setPosterCanvasHistory((history) => {
        if (history.future.length === 0) {
          return history;
        }

        return {
          past: [...history.past, currentCanvas],
          future: history.future.slice(1),
        };
      });
    }, [currentPosterCanvas, document, posterCanvasHistory.future]),
    canUndoPosterCanvas: posterCanvasHistory.past.length > 0,
    canRedoPosterCanvas: posterCanvasHistory.future.length > 0,
    updateQueueLabels: useCallback(
      (queueId: string, patch: { label?: string; durationLabel?: string }) => {
        setDocument((current) => updateQueueLabels(current, queueId, patch));
      },
      [],
    ),
    updateRoomEfficiencyLabels: useCallback(
      (
        queueId: string,
        assignmentId: string,
        labels: { paperEfficiencyLabel?: string; effectiveEfficiencyLabel?: string; notes?: string[] },
      ) => {
        setDocument((current) => updateRoomEfficiencyLabels(current, queueId, assignmentId, labels));
      },
      [],
    ),
    replaceDocument,
    resetDraft: useCallback(() => {
      clearLocalDraft();
      setDocument(createDefaultSchedule());
      setPosterCanvasHistory({ past: [], future: [] });
    }, []),
  };
}
