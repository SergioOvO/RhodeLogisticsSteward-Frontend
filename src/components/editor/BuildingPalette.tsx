import { useDraggable } from "@dnd-kit/core";
import { BuildingsIcon, SidebarSimpleIcon } from "@phosphor-icons/react";
import {
  bentoLayoutIds,
  bentoRoomDefinitions,
  getRequiredRoomCount,
} from "../../domain/bentoDefinitions";
import type { PosterComponentAddKind } from "../../domain/scheduleDocument";
import type { BentoRoomTypeId, ScheduleDocument } from "../../domain/types";
import shared from "../../styles/shared.module.css";
import styles from "../../styles/BuildingPalette.module.css";
import { ContourButton } from "../ui/ContourButton";

interface BuildingPaletteProps {
  document: ScheduleDocument;
  onAddRoom: (roomType: BentoRoomTypeId) => void;
  onPosterComponentAdd?: (kind: PosterComponentAddKind) => void;
  onCollapse?: () => void;
  onLayoutChange: (layoutId: string) => void;
}

const roomOrder: BentoRoomTypeId[] = [
  "CONTROL",
  "TRADING",
  "MANUFACTURE",
  "POWER",
  "MEETING",
  "HIRE",
];

const posterComponentTemplates: Array<{ kind: PosterComponentAddKind; label: string; meta: string }> = [
  { kind: "note", label: "文本备注", meta: "可编辑标题与正文" },
  { kind: "metric", label: "产出摘要", meta: "汇总订单、赤金与经验" },
  { kind: "divider", label: "分隔线", meta: "用于切分海报区域" },
];

function FacilityTemplate({
  roomType,
  placed,
  required,
  onAddRoom,
}: {
  roomType: BentoRoomTypeId;
  placed: number;
  required: number;
  onAddRoom: (roomType: BentoRoomTypeId) => void;
}) {
  const complete = placed >= required;
  const definition = bentoRoomDefinitions[roomType];
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `infrastructure-template:${roomType}`,
    data: { type: "infrastructure-template", roomType },
  });

  return (
    <button
      {...attributes}
      {...listeners}
      aria-disabled={false}
      className={styles.facilityTemplate}
      data-color-role={definition.colorRole}
      data-disabled={complete}
      data-facility-template
      onClick={() => onAddRoom(roomType)}
      ref={setNodeRef}
      type="button"
    >
      <span className={styles.facilityTemplateIcon}>
        <BuildingsIcon size={18} />
      </span>
      <span className={styles.facilityTemplateText}>
        <span className={styles.facilityTemplateTitle}>{definition.label}</span>
        <span className={styles.facilityTemplateMeta}>
          {placed} / {required} · {definition.slotCount} 人
        </span>
      </span>
    </button>
  );
}

function PosterComponentTemplate({
  kind,
  label,
  meta,
  onAdd,
}: {
  kind: PosterComponentAddKind;
  label: string;
  meta: string;
  onAdd: (kind: PosterComponentAddKind) => void;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `poster-component-template:${kind}`,
    data: { type: "poster-component-template", kind },
  });

  return (
    <button
      {...attributes}
      {...listeners}
      className={styles.posterComponentTemplate}
      data-poster-add-kind={kind}
      data-poster-component-template
      onClick={() => onAdd(kind)}
      ref={setNodeRef}
      type="button"
    >
      <span className={styles.facilityTemplateIcon}>
        <BuildingsIcon size={18} />
      </span>
      <span className={styles.facilityTemplateText}>
        <span className={styles.facilityTemplateTitle}>{label}</span>
        <span className={styles.facilityTemplateMeta}>{meta}</span>
      </span>
    </button>
  );
}

export function BuildingPalette({
  document,
  onAddRoom,
  onPosterComponentAdd,
  onCollapse,
  onLayoutChange,
}: BuildingPaletteProps) {
  return (
    <aside className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelHeaderActions}>
          {onCollapse ? (
            <ContourButton
              aria-label="隐藏侧栏"
              icon={<SidebarSimpleIcon />}
              iconOnly
              onClick={onCollapse}
              size="sm"
              variant="white"
            />
          ) : null}
        </span>
      </div>
      <div className={styles.paletteBody}>
        <label className={styles.paletteField}>
          <span className={shared.fieldLabel}>布局</span>
          <select
            aria-label="布局"
            className={shared.textInput}
            onChange={(event) => onLayoutChange(event.target.value)}
            value={document.layoutId}
          >
            {bentoLayoutIds.map((layoutId) => (
              <option key={layoutId} value={layoutId}>
                {layoutId}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.facilityTemplateList}>
          <section className={styles.posterComponentPalette}>
            <h3 className={styles.paletteSectionTitle}>基础设施</h3>
            {roomOrder.map((roomType) => {
              const placed = document.canvas.rooms.filter((room) => room.roomType === roomType).length;
              const required = getRequiredRoomCount(document.layoutId, roomType);

              return (
                <FacilityTemplate
                  key={roomType}
                  onAddRoom={onAddRoom}
                  placed={placed}
                  required={required}
                  roomType={roomType}
                />
              );
            })}
          </section>
          {onPosterComponentAdd ? (
            <section className={styles.posterComponentPalette} data-poster-component-palette>
              <h3 className={styles.paletteSectionTitle}>文本备注、产出摘要和分隔线</h3>
              <div className={styles.posterComponentTemplateList}>
                {posterComponentTemplates.map((template) => (
                  <PosterComponentTemplate
                    kind={template.kind}
                    key={template.kind}
                    label={template.label}
                    meta={template.meta}
                    onAdd={onPosterComponentAdd}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
