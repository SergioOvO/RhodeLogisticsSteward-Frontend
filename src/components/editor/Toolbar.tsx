import { Select } from "@base-ui/react/select";
import {
  ArrowCounterClockwiseIcon,
  CaretDownIcon,
  DownloadSimpleIcon,
  FileArrowDownIcon,
  FileArrowUpIcon,
} from "@phosphor-icons/react";
import { bentoLayoutIds } from "../../domain/bentoDefinitions";
import {
  normalizePosterMode,
  normalizePosterTemplateId,
  posterModeIds,
  posterModeLabels,
  posterTemplateIds,
  posterTemplateLabels,
} from "../../domain/posterDefinitions";
import { queueCountOptions } from "../../domain/queueLimits";
import type { PosterMode, PosterTemplateId, ScheduleDocument } from "../../domain/types";
import shared from "../../styles/shared.module.css";
import styles from "../../styles/Toolbar.module.css";
import { ContourButton } from "../ui/ContourButton";

interface ToolbarProps {
  document: ScheduleDocument;
  onLayoutChange: (layoutId: string) => void;
  onQueueCountChange: (count: number) => void;
  onPosterTemplateChange: (templateId: PosterTemplateId) => void;
  onPosterModeChange: (mode: PosterMode) => void;
  onImportClick: () => void;
  onExportJson: () => void;
  onExportPng: () => void;
  onReset: () => void;
}

interface SelectOption {
  label: string;
  value: string;
}

function BaseSelect({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: string;
  items: readonly SelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <label className={shared.field}>
      <span className={shared.fieldLabel}>{label}</span>
      <Select.Root items={items} onValueChange={(next) => onChange(String(next))} value={value}>
        <Select.Trigger className={shared.selectTrigger}>
          <Select.Value />
          <Select.Icon className={styles.selectIcon}>
            <CaretDownIcon size={14} />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner
            align="start"
            alignItemWithTrigger={false}
            className={styles.selectPositioner}
            collisionPadding={8}
            sideOffset={5}
          >
            <Select.Popup className={styles.selectPopup}>
              <Select.List className={styles.selectList}>
                {items.map((item) => (
                  <Select.Item className={styles.selectItem} key={item.value} value={item.value}>
                    <Select.ItemText>{item.label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </label>
  );
}

const queueItems = queueCountOptions.map((count) => ({
  label: `${count} 队列`,
  value: String(count),
}));

const templateItems = posterTemplateIds.map((id) => ({
  label: posterTemplateLabels[id],
  value: id,
}));

const modeItems = posterModeIds.map((id) => ({
  label: posterModeLabels[id],
  value: id,
}));

export function Toolbar({
  document,
  onLayoutChange,
  onQueueCountChange,
  onPosterTemplateChange,
  onPosterModeChange,
  onImportClick,
  onExportJson,
  onExportPng,
  onReset,
}: ToolbarProps) {
  const layoutItems = bentoLayoutIds.map((id) => ({ label: id, value: id }));

  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarLeading}>
        <BaseSelect
          label="布局"
          items={layoutItems}
          onChange={onLayoutChange}
          value={document.layoutId}
        />
        <BaseSelect
          label="队列"
          items={queueItems}
          onChange={(value) => onQueueCountChange(Number(value))}
          value={String(document.queueCount)}
        />
        <BaseSelect
          label="导出模板"
          items={templateItems}
          onChange={(value) => onPosterTemplateChange(value as PosterTemplateId)}
          value={normalizePosterTemplateId(document.posterTemplateId)}
        />
        <BaseSelect
          label="排班模式"
          items={modeItems}
          onChange={(value) => onPosterModeChange(value as PosterMode)}
          value={normalizePosterMode(document.posterMode)}
        />
      </div>
      <div className={styles.toolbarActions}>
        <ContourButton
          icon={<FileArrowUpIcon />}
          onClick={onImportClick}
          size="sm"
          variant="white"
        >
          导入
        </ContourButton>
        <ContourButton
          icon={<FileArrowDownIcon />}
          onClick={onExportJson}
          size="sm"
          variant="white"
        >
          JSON
        </ContourButton>
        <ContourButton
          icon={<ArrowCounterClockwiseIcon />}
          onClick={onReset}
          size="sm"
          variant="red"
        >
          重置
        </ContourButton>
        <ContourButton
          icon={<DownloadSimpleIcon />}
          onClick={onExportPng}
          size="sm"
          variant="yellow"
        >
          导出图片
        </ContourButton>
      </div>
    </div>
  );
}
