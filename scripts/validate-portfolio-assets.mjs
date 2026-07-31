import { access, readFile, stat } from "node:fs/promises";
import { resolve, win32 } from "node:path";
import {
  collectManagedAssetPaths,
  loadLocalEditorSettings,
  parseManagedAssetPath
} from "../build/local-editor-vite-plugin.js";

const projectRoot = resolve(import.meta.dirname, "..");
const configPath = resolve(projectRoot, "data", "portfolio-config.json");
const publicDirectory = resolve(projectRoot, "public", "assets", "portfolio");

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function inspectStrings(value) {
  const errors = [];
  const visited = new Set();

  function visit(candidate, location) {
    if (typeof candidate === "string") {
      if (/^data:image\//i.test(candidate)) {
        errors.push(`${location}: inline Base64 image data is not publishable.`);
      }
      if (win32.isAbsolute(candidate)) {
        errors.push(`${location}: absolute Windows path is not publishable.`);
      }
      if (
        candidate.startsWith("/assets/portfolio/") &&
        !parseManagedAssetPath(candidate)
      ) {
        errors.push(`${location}: malformed managed portfolio asset path.`);
      }
      return;
    }

    if (!candidate || typeof candidate !== "object" || visited.has(candidate)) {
      return;
    }
    visited.add(candidate);

    if (Array.isArray(candidate)) {
      candidate.forEach((item, index) => visit(item, `${location}[${index}]`));
      return;
    }

    for (const [key, item] of Object.entries(candidate)) {
      visit(item, `${location}.${key}`);
    }
  }

  visit(value, "config");
  return errors;
}

let config;
try {
  config = JSON.parse(await readFile(configPath, "utf8"));
} catch (error) {
  throw new Error(`Cannot read data/portfolio-config.json: ${error.message}`);
}

const errors = inspectStrings(config);
const referencedPaths = collectManagedAssetPaths(config);
let totalBytes = 0;

for (const assetPath of referencedPaths) {
  const managed = parseManagedAssetPath(assetPath);
  const mirrorPath = resolve(publicDirectory, managed.filename);
  if (!(await exists(mirrorPath))) {
    errors.push(`${assetPath}: missing from public/assets/portfolio.`);
    continue;
  }

  const details = await stat(mirrorPath);
  if (!details.isFile()) {
    errors.push(`${assetPath}: mirror path is not a file.`);
    continue;
  }
  totalBytes += details.size;
}

if (errors.length > 0) {
  throw new Error(
    ["Portfolio asset validation failed:", ...errors.map((item) => `- ${item}`)].join(
      "\n"
    )
  );
}

const settings = await loadLocalEditorSettings(projectRoot);
if (totalBytes > settings.deploymentWarnBytes) {
  console.warn(
    `Warning: referenced portfolio assets total ${totalBytes} bytes, above the configured ${settings.deploymentWarnBytes} byte deployment warning threshold.`
  );
}

console.log(
  [
    "Portfolio asset validation complete.",
    `Referenced files: ${referencedPaths.length}`,
    `Total bytes: ${totalBytes}`,
    `Warning threshold: ${settings.deploymentWarnBytes}`
  ].join("\n")
);
