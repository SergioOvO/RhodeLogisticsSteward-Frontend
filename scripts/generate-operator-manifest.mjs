import { access, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const defaultSourceRoot = path.join(process.cwd(), "assets", "operator-source");
const sourceRoot = process.env.RLS_AVATARS_DIR
  ? path.resolve(process.env.RLS_AVATARS_DIR)
  : defaultSourceRoot;
const metadataPath = path.join(sourceRoot, "operators.json");
const portraitsPath = await firstExistingPath([
  path.join(sourceRoot, "portraits"),
  path.join(sourceRoot, "avatars"),
]);
const professionIconsPath = path.join(sourceRoot, "profession");
const rarityIconsPath = path.join(sourceRoot, "rarity");
const eliteIconsPath = await firstExistingPath([
  path.join(sourceRoot, "elite"),
  path.join(defaultSourceRoot, "elite"),
]);
const outPortraitsPath = path.join(process.cwd(), "public", "operators", "portraits");
const outProfessionIconsPath = path.join(process.cwd(), "public", "operators", "profession");
const outRarityIconsPath = path.join(process.cwd(), "public", "operators", "rarity");
const outEliteIconsPath = path.join(process.cwd(), "public", "operators", "elite");
const outManifestPath = path.join(process.cwd(), "public", "operators", "manifest.json");
const portraitWebpOptions = {
  quality: 82,
  effort: 6,
  alphaQuality: 100,
  smartSubsample: true,
};
const iconWebpOptions = {
  lossless: true,
  effort: 6,
};
const requestedConversionConcurrency = Number(process.env.RLS_IMAGE_CONCURRENCY ?? 8);
const conversionConcurrency = Number.isFinite(requestedConversionConcurrency)
  ? requestedConversionConcurrency
  : 8;

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function firstExistingPath(paths) {
  for (const candidate of paths) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return paths[0];
}

function normalize(value) {
  return String(value ?? "")
    .trim()
    .replace(/\.[^.]+$/, "")
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function webpFileName(file) {
  return file.replace(/\.[^.]+$/i, ".webp");
}

async function cleanImageOutputDir(directory) {
  await mkdir(directory, { recursive: true });
  const entries = await readdir(directory, { withFileTypes: true });

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && /\.(png|webp)$/i.test(entry.name))
      .map((entry) => rm(path.join(directory, entry.name), { force: true })),
  );
}

async function convertToWebp(inputPath, outputPath, options) {
  await sharp(inputPath).webp(options).toFile(outputPath);
}

async function runWithConcurrency(items, limit, handler) {
  const queue = [...items];
  const safeLimit = Math.trunc(limit);
  const workerCount = Math.min(Math.max(1, safeLimit), queue.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (queue.length > 0) {
        const item = queue.shift();

        if (item) {
          await handler(item);
        }
      }
    }),
  );
}

const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
const files = (await readdir(portraitsPath)).filter((file) => file.toLowerCase().endsWith(".png"));
const professionIconFiles = (await readdir(professionIconsPath)).filter((file) =>
  file.toLowerCase().endsWith(".png"),
);
const rarityIconFiles = (await readdir(rarityIconsPath)).filter((file) =>
  file.toLowerCase().endsWith(".png"),
);
const eliteIconFiles = (await readdir(eliteIconsPath)).filter((file) => file.toLowerCase().endsWith(".png"));
const warnings = [];
const filesByCode = new Map();
const filesByName = new Map();
const professionIconByName = new Map();
const rarityIconByValue = new Map();

for (const file of files) {
  const stem = file.replace(/\.png$/i, "");
  const separator = stem.indexOf("_");
  const code = separator >= 0 ? stem.slice(0, separator) : stem;
  const name = separator >= 0 ? stem.slice(separator + 1) : stem;

  filesByCode.set(code, file);
  filesByName.set(name, file);
}

for (const file of professionIconFiles) {
  const stem = file.replace(/\.png$/i, "");
  const professionName = stem.slice(stem.lastIndexOf("_") + 1);
  professionIconByName.set(professionName, file);
}

for (const file of rarityIconFiles) {
  const match = file.match(/_(\d+)\.png$/i);
  if (match) {
    rarityIconByValue.set(Number(match[1]), file);
  }
}

const seenIds = new Set();
const operators = metadata
  .map((row) => {
    const portraitFile = filesByCode.get(row.id) ?? filesByName.get(row.zh);
    const professionIconFile = professionIconByName.get(row.profession);
    const rarityIconFile = rarityIconByValue.get(row.rarity);
    const fallbackStem = normalize(row.zh ?? row.en ?? row.id);
    const baseId = normalize(row.id ?? fallbackStem);
    const id = baseId;

    if (seenIds.has(baseId)) {
      warnings.push(`Duplicate operator id: ${baseId}; skipped metadata row ${row.zh ?? fallbackStem}`);
      return null;
    }
    seenIds.add(id);

    if (!portraitFile) {
      warnings.push(`Missing portrait for metadata row: ${row.zh ?? id}`);
    }

    if (row.profession && !professionIconFile) {
      warnings.push(`Missing profession icon for ${row.zh ?? id}: ${row.profession}`);
    }

    if (typeof row.rarity === "number" && !rarityIconFile) {
      warnings.push(`Missing rarity icon for ${row.zh ?? id}: ${row.rarity}`);
    }

    const stem = portraitFile?.replace(/\.png$/i, "") ?? fallbackStem;

    return {
      id,
      name: row.zh ?? row.en ?? id,
      portraitPath: portraitFile ? `/operators/portraits/${webpFileName(portraitFile)}` : "",
      professionIconPath: professionIconFile ? `/operators/profession/${webpFileName(professionIconFile)}` : "",
      rarityIconPath: rarityIconFile ? `/operators/rarity/${webpFileName(rarityIconFile)}` : "",
      aliases: unique([row.zh, row.en, row.ja, row.id, stem]),
      tags: unique([...(Array.isArray(row.tags) ? row.tags : []), row.position, row.profession]),
      profession: row.profession,
      subProfession: row.sub_profession,
      rarity: row.rarity,
      source: "avatars",
      sortKey: portraitFile ?? row.zh ?? id,
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.sortKey.localeCompare(b.sortKey, "zh-Hans-CN"))
  .map(({ sortKey: _sortKey, ...operator }) => operator);

const operatorNames = new Set(metadata.map((row) => row.zh));
for (const file of files) {
  const stem = file.replace(/\.png$/i, "");
  const name = stem.includes("_") ? stem.slice(stem.indexOf("_") + 1) : stem;
  if (!operatorNames.has(name)) {
    warnings.push(`Portrait without metadata: ${file}`);
  }
}

await cleanImageOutputDir(outPortraitsPath);
await cleanImageOutputDir(outProfessionIconsPath);
await cleanImageOutputDir(outRarityIconsPath);
await cleanImageOutputDir(outEliteIconsPath);
await mkdir(path.dirname(outManifestPath), { recursive: true });

await runWithConcurrency(files, conversionConcurrency, (file) =>
  convertToWebp(
    path.join(portraitsPath, file),
    path.join(outPortraitsPath, webpFileName(file)),
    portraitWebpOptions,
  ),
);

await runWithConcurrency(professionIconFiles, conversionConcurrency, (file) =>
  convertToWebp(
    path.join(professionIconsPath, file),
    path.join(outProfessionIconsPath, webpFileName(file)),
    iconWebpOptions,
  ),
);

await runWithConcurrency(rarityIconFiles, conversionConcurrency, (file) =>
  convertToWebp(
    path.join(rarityIconsPath, file),
    path.join(outRarityIconsPath, webpFileName(file)),
    iconWebpOptions,
  ),
);

await runWithConcurrency(eliteIconFiles, conversionConcurrency, (file) =>
  convertToWebp(
    path.join(eliteIconsPath, file),
    path.join(outEliteIconsPath, webpFileName(file)),
    iconWebpOptions,
  ),
);

const manifest = {
  source: {
    localSourcePath: sourceRoot,
    generatedAt: new Date().toISOString(),
    metadataRows: metadata.length,
    portraitFiles: files.length,
    professionIconFiles: professionIconFiles.length,
    rarityIconFiles: rarityIconFiles.length,
    eliteIconFiles: eliteIconFiles.length,
    warnings,
  },
  operators,
};

await writeFile(outManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`Generated ${operators.length} operators and converted ${files.length} portraits.`);
if (warnings.length > 0) {
  console.warn(warnings.join("\n"));
}
