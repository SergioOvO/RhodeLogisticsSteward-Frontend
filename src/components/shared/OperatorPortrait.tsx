import styles from "../../styles/operatorPortrait.module.css";

interface OperatorPortraitProps {
  portraitPath?: string;
  professionIconPath?: string;
  rarityIconPath?: string;
  eliteIconPath?: string;
  fallbackText?: string;
  className?: string;
}

export function OperatorPortrait({
  portraitPath,
  professionIconPath,
  rarityIconPath,
  eliteIconPath,
  fallbackText,
  className,
}: OperatorPortraitProps) {
  return (
    <span className={`${styles.frame} ${className ?? ""}`}>
      {portraitPath ? (
        <img alt="" className={styles.portrait} src={portraitPath} />
      ) : (
        <span className={styles.fallback}>{fallbackText ?? ""}</span>
      )}
      {professionIconPath ? (
        <img alt="" className={styles.professionIcon} src={professionIconPath} />
      ) : null}
      {rarityIconPath ? (
        <img alt="" className={styles.rarityIcon} src={rarityIconPath} />
      ) : null}
      {eliteIconPath ? (
        <img alt="" className={styles.eliteIcon} src={eliteIconPath} />
      ) : null}
    </span>
  );
}
