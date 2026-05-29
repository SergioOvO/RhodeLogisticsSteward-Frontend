import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { BuildingReference, OperatorManifest } from "../../src/domain/types";

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function isNonEmptyString(value: string | undefined): value is string {
  return Boolean(value);
}

function listFiles(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(path, entry.name);

    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });
}

describe("generated data", () => {
  it("keeps operator manifest shape stable", () => {
    const manifest = readJson<OperatorManifest>(join(process.cwd(), "public/operators/manifest.json"));
    const publicOperatorFiles = listFiles(join(process.cwd(), "public/operators"));
    const publicOperatorImages = publicOperatorFiles.filter((file) => /\.(png|webp)$/i.test(file));
    const manifestImagePaths = manifest.operators.flatMap((operator) =>
      [operator.portraitPath, operator.professionIconPath, operator.rarityIconPath].filter(isNonEmptyString),
    );

    expect(manifest.operators).toHaveLength(415);
    expect(manifest.source.portraitFiles).toBe(417);
    expect(manifest.source.professionIconFiles).toBe(8);
    expect(manifest.source.rarityIconFiles).toBe(6);
    expect(manifest.source.eliteIconFiles).toBe(2);
    expect(manifest.operators[0]).toHaveProperty("portraitPath");
    expect(new Set(manifest.operators.map((operator) => operator.id)).size).toBe(415);
    expect(manifest.operators.filter((operator) => operator.aliases.includes("Amiya"))).toHaveLength(1);
    expect(publicOperatorImages.filter((file) => file.toLowerCase().endsWith(".png"))).toHaveLength(0);
    expect(publicOperatorImages.filter((file) => file.toLowerCase().endsWith(".webp"))).toHaveLength(433);
    expect(manifestImagePaths.every((assetPath) => assetPath.endsWith(".webp"))).toBe(true);
    expect(
      manifestImagePaths.every((assetPath) =>
        existsSync(join(process.cwd(), "public", assetPath.replace(/^\//, ""))),
      ),
    ).toBe(true);
  });

  it("keeps building reference counts and filter options", () => {
    const reference = readJson<BuildingReference>(
      join(process.cwd(), "public/data/building-reference.json"),
    );

    expect(reference.operatorSkills).toHaveLength(892);
    expect(Object.keys(reference.skillsById)).toHaveLength(727);
    expect(reference.roomTypes.map((roomType) => roomType.id)).toEqual(
      expect.arrayContaining([
        "CONTROL",
        "POWER",
        "MANUFACTURE",
        "TRADING",
        "DORMITORY",
        "HIRE",
        "MEETING",
        "TRAINING",
        "WORKSHOP",
      ]),
    );
    expect(reference.productionFormulaTypes.map((formulaType) => formulaType.id)).toEqual(
      expect.arrayContaining(["F_EXP", "F_GOLD", "F_ASC", "F_DIAMOND", "F_BUILDING", "F_EVOLVE", "F_SKILL"]),
    );
  });
});
