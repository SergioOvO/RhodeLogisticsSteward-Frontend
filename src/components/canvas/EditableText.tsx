import { useEffect, useRef, type ElementType, type FocusEvent, type KeyboardEvent } from "react";
import styles from "../../styles/canvas.module.css";

interface EditableTextProps {
  as?: ElementType;
  className?: string;
  value: string;
  ariaLabel: string;
  multiline?: boolean;
  onCommit: (value: string) => void;
}

function escapeHTML(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function linesToHTML(text: string): string {
  return text.split("\n").map(escapeHTML).join("<br>");
}

function restoreContent(el: HTMLElement, value: string, multiline: boolean) {
  if (multiline) {
    el.innerHTML = linesToHTML(value);
  } else {
    el.textContent = value;
  }
}

export function EditableText({
  as: Tag = "span",
  className,
  value,
  ariaLabel,
  multiline = false,
  onCommit,
}: EditableTextProps) {
  const ref = useRef<HTMLElement>(null);
  const committedRef = useRef(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    restoreContent(el, value, multiline);
  });

  function handleBlur(event: FocusEvent<HTMLElement>) {
    const raw = multiline ? event.currentTarget.innerText : event.currentTarget.textContent;
    const next = raw?.trim() ?? "";
    if (next !== committedRef.current) {
      committedRef.current = next;
      onCommit(next);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!multiline && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      restoreContent(event.currentTarget, value, multiline);
      committedRef.current = value;
      event.currentTarget.blur();
    }
  }

  return (
    <Tag
      ref={ref as React.Ref<HTMLSpanElement>}
      aria-label={ariaLabel}
      className={[className, styles.editableText].filter(Boolean).join(" ")}
      contentEditable
      role="textbox"
      suppressContentEditableWarning
      tabIndex={0}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      {...(multiline
        ? { dangerouslySetInnerHTML: { __html: linesToHTML(value) } }
        : { children: value })}
    />
  );
}
