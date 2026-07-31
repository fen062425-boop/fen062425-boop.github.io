import {
  access,
  copyFile,
  mkdir,
  readdir,
  rename,
  stat,
  unlink
} from "node:fs/promises";
import { basename, resolve } from "node:path";
import {
  collectManagedAssetPaths,
  getLibraryPaths,
  loadLocalEditorSettings,
  parseManagedAssetPath
} from "../build/local-editor-vite-plugin.js";

const projectRoot = resolve(import.meta.dirname, "..");
const configPath = resolve(projectRoot, "data", "portfolio-config.json");
const publicDirectory = resolve(projectRoot, "public", "assets", "portfolio");
const managedFilenamePattern =
  /^[a-f0-9]{64}-(?:detail|cover)\.webp$/;

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function readConfig() {
  const { readFile } = await import("node:fs/promises");
  try {
    return JSON.parse(await readFile(configPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { version: 2 };
    throw new Error(`Cannot read data/portfolio-config.json: ${error.message}`);
  }
}

async function atomicCopy(source, target) {
  const temporary = `${target}.${process.pid}.tmp`;
  await copyFile(source, temporary);
  try {
    await rename(temporary, target);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

const config = await readConfig();
const referencedPaths = collectManagedAssetPaths(config);
const referencedFiles = new Set(
  referencedPaths.map((path) => parseManagedAssetPath(path).filename)
);
const settings = await loadLocalEditorSettings(projectRoot);
const library = getLibraryPaths(settings.root);
const sourceAvailable = await exists(library.web);

if (referencedFiles.size > 0) {
  await mkdir(publicDirectory, { recursive: true });
}

let copied = 0;
let reused = 0;
const missing = [];

for (const filename of referencedFiles) {
  const source = `${library.web}\\${filename}`;
  const target = resolve(publicDirectory, filename);

  if (sourceAvailable && (await exists(source))) {
    const sourceStat = await stat(source);
    const targetStat = await stat(target).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });

    if (
      !targetStat ||
      targetStat.size !== sourceStat.size ||
      targetStat.mtimeMs < sourceStat.mtimeMs
    ) {
      await atomicCopy(source, target);
      copied += 1;
    } else {
      reused += 1;
    }
  } else if (await exists(target)) {
    reused += 1;
  } else {
    missing.push(filename);
  }
}

if (missing.length > 0) {
  throw new Error(
    [
      "Referenced portfolio assets are missing from both the E-drive library and public mirror:",
      ...missing.map((filename) => `- ${filename}`)
    ].join("\n")
  );
}

let removed = 0;
if (await exists(publicDirectory)) {
  const publicFiles = await readdir(publicDirectory, { withFileTypes: true });
  for (const entry of publicFiles) {
    if (
      entry.isFile() &&
      managedFilenamePattern.test(entry.name) &&
      !referencedFiles.has(entry.name)
    ) {
      await unlink(resolve(publicDirectory, entry.name));
      removed += 1;
    }
  }
}

console.log(
  [
    "Portfolio asset sync complete.",
    `Referenced: ${referencedFiles.size}`,
    `Copied: ${copied}`,
    `Reused: ${reused}`,
    `Removed stale mirror files: ${removed}`,
    `Source library: ${sourceAvailable ? library.web : "unavailable; mirror-only mode"}`
  ].join("\n")
);
