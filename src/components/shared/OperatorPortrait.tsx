import type { ImgHTMLAttributes } from "react";
import styles from "../../styles/operatorPortrait.module.css";

type ImageLoading = ImgHTMLAttributes<HTMLImageElement>["loading"];
type OperatorPortraitVariant = "card" | "tile" | "drag";

const rarityIconSizes: Record<number, { width: number; height: number }> = {
  0: { width: 24, height: 25 },
  1: { width: 37, height: 25 },
  2: { width: 50, height: 25 },
  3: { width: 63, height: 25 },
  4: { width: 76, height: 25 },
  5: { width: 89, height: 25 },
};

function getRarityIconSize(path: string | undefined): { width: number; height: number } {
  const match = path?.match(/_(\d+)\.(?:png|webp)$/i);
  const rarity = match ? Number(match[1]) : Number.NaN;

  return rarityIconSizes[rarity] ?? rarityIconSizes[5];
}

function getEliteIconSize(path: string | undefined): { width: number; height: number } {
  return path?.match(/2\.(?:png|webp)$/i) ? { width: 28, height: 22 } : { width: 30, height: 20 };
}

interface OperatorPortraitProps {
  portraitPath?: string;
  professionIconPath?: string;
  rarityIconPath?: string;
  eliteIconPath?: string;
  fallbackText?: string;
  className?: string;
  eliteAlt?: string;
  professionAlt?: string;
  loading?: ImageLoading;
  variant?: OperatorPortraitVariant;
}

export function OperatorPortrait({
  portraitPath,
  professionIconPath,
  rarityIconPath,
  eliteIconPath,
  fallbackText,
  className,
  eliteAlt = "",
  professionAlt = "",
  loading,
  variant = "card",
}: OperatorPortraitProps) {
  const rarityIconSize = getRarityIconSize(rarityIconPath);
  const eliteIconSize = getEliteIconSize(eliteIconPath);

  return (
    <span className={[styles.frame, className].filter(Boolean).join(" ")} data-variant={variant}>
      {portraitPath ? (
        <img
          alt=""
          className={styles.portrait}
          decoding="async"
          height={180}
          loading={loading}
          src={portraitPath}
          width={180}
        />
      ) : (
        <span className={styles.fallback}>{fallbackText ?? ""}</span>
      )}
      {professionIconPath ? (
        <img
          alt={professionAlt}
          className={styles.professionIcon}
          data-profession-icon
          decoding="async"
          height={26}
          loading={loading}
          src={professionIconPath}
          width={26}
        />
      ) : null}
      {rarityIconPath ? (
        <img
          alt=""
          className={styles.rarityIcon}
          data-rarity-icon
          decoding="async"
          height={rarityIconSize.height}
          loading={loading}
          src={rarityIconPath}
          width={rarityIconSize.width}
        />
      ) : null}
      {eliteIconPath ? (
        <img
          alt={eliteAlt}
          className={styles.eliteIcon}
          data-elite-icon
          decoding="async"
          height={eliteIconSize.height}
          loading={loading}
          src={eliteIconPath}
          width={eliteIconSize.width}
        />
      ) : null}
    </span>
  );
}
