import type { ScheduleDocument } from "../../domain/types";
import styles from "../../styles/canvas.module.css";
import { EditableText } from "./EditableText";

interface CanvasHeaderProps {
  document: ScheduleDocument;
  onMetadataChange: (patch: {
    title?: string;
    subtitle?: string;
    productionSummary?: Partial<ScheduleDocument["productionSummary"]>;
    droneSummary?: Partial<ScheduleDocument["droneSummary"]>;
  }) => void;
}

const productionIcons = [
  { alt: "龙门币", key: "orderText", label: "订单", src: "/items/lmd.png" },
  { alt: "赤金", key: "goldText", label: "赤金", src: "/items/gold.png" },
  { alt: "中级作战记录", key: "recordText", label: "经验", src: "/items/exp-mid.png" },
] as const;

function productionValue(text: string): string {
  const value = text.replace(/^(订单|赤金|经验)\s*/, "").trim();
  return value || "-";
}

function markManual() {
  return "手动编辑数值";
}

function productionLine(summary: ScheduleDocument["productionSummary"]) {
  return [summary.orderText, summary.goldText, summary.recordText].filter(Boolean).join(" · ");
}

export function CanvasHeader({ document, onMetadataChange }: CanvasHeaderProps) {
  const productionSummary = document.productionSummary;

  return (
    <header className={styles.header}>
      <div className={styles.titleBlock}>
        <EditableText
          ariaLabel="编辑标题"
          as="h1"
          className={styles.title}
          onCommit={(title) => onMetadataChange({ title })}
          value={document.title}
        />
        <EditableText
          ariaLabel="编辑副标题"
          as="p"
          className={styles.subtitle}
          onCommit={(subtitle) => onMetadataChange({ subtitle })}
          value={document.subtitle}
        />
      </div>
      <div className={styles.summary} aria-label="生产摘要">
        <div className={styles.productionLine}>
          <span className={styles.summaryLabel}>产出计算</span>
          <span
            aria-label="产出计算"
            className={[styles.summaryValue, styles.productionSummaryValue].join(" ")}
            contentEditable
            onBlur={(event) => {
              const next = event.currentTarget.textContent?.trim() ?? "";
              if (next && next !== productionLine(document.productionSummary)) {
                onMetadataChange({
                  productionSummary: {
                    orderText: next,
                    goldText: "",
                    recordText: "",
                    customLine: markManual(),
                  },
                });
              }
            }}
            role="textbox"
            suppressContentEditableWarning
            tabIndex={0}
          >
            {productionIcons.map((item, index) => (
              <span className={styles.productionMetric} key={item.key}>
                <img alt={item.alt} className={styles.productionIcon} src={item.src} />
                <span className={styles.productionLabelText}>{item.label}</span>
                <span>{productionValue(productionSummary[item.key])}</span>
                {index < productionIcons.length - 1 ? (
                  <span aria-hidden="true" className={styles.productionSeparator}>·</span>
                ) : null}
              </span>
            ))}
          </span>
        </div>
        {document.productionSummary.customLine ? (
          <div className={styles.summaryNote}>
            <span className={styles.summaryLabel}>NOTE</span>
            <EditableText
              ariaLabel="编辑生产备注"
              className={styles.summaryValue}
              onCommit={(customLine) => onMetadataChange({ productionSummary: { customLine } })}
              value={document.productionSummary.customLine}
            />
          </div>
        ) : null}
      </div>
      <div className={styles.droneBox}>
        <span className={styles.droneTitle}>
          DRONE /{" "}
          <EditableText
            ariaLabel="编辑无人机目标"
            onCommit={(targetRoomLabel) => onMetadataChange({ droneSummary: { targetRoomLabel } })}
            value={document.droneSummary.targetRoomLabel}
          />
        </span>
        <EditableText
          ariaLabel="编辑无人机摘要"
          className={styles.droneText}
          multiline
          onCommit={(summaryText) => onMetadataChange({ droneSummary: { summaryText } })}
          value={document.droneSummary.summaryText}
        />
      </div>
    </header>
  );
}
