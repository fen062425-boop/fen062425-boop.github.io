import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  stat,
  statfs,
  unlink,
  writeFile
} from "node:fs/promises";
import {
  basename,
  extname,
  isAbsolute,
  join,
  resolve,
  win32
} from "node:path";

const API_PREFIX = "/__local-editor";
const MANAGED_ASSET_PATTERN =
  /^\/assets\/portfolio\/([a-f0-9]{64})-(detail|cover)\.webp$/;
const MANAGED_FILE_PATTERN =
  /^([a-f0-9]{64})-(detail|cover)\.webp$/;
const INDEX_VERSION = 1;
const DEFAULT_SETTINGS = {
  root: "E:\\本地编辑器存图",
  maxOriginalBytes: 100 * 1024 * 1024,
  maxWebVariantBytes: 25 * 1024 * 1024,
  maxRequestBytes: 150 * 1024 * 1024,
  deploymentWarnBytes: 200 * 1024 * 1024,
  backupIntervalMinutes: 10,
  backupRetention: 72
};
let assetMutationQueue = Promise.resolve();

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function isWindowsAbsolute(path) {
  return typeof path === "string" && win32.isAbsolute(path);
}

function configuredJoin(root, ...parts) {
  return isWindowsAbsolute(root) ? win32.join(root, ...parts) : join(root, ...parts);
}

function storageAvailableOnPlatform(root) {
  return !(process.platform !== "win32" && isWindowsAbsolute(root));
}

function numericSetting(value, fallback, minimum = 1) {
  return Number.isFinite(value) && value >= minimum ? Math.round(value) : fallback;
}

export async function loadLocalEditorSettings(projectRoot = process.cwd()) {
  const settingsPath = resolve(projectRoot, "local-editor.config.json");
  let incoming = {};

  try {
    incoming = JSON.parse(await readFile(settingsPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw new Error(`Cannot read local-editor.config.json: ${error.message}`);
    }
  }

  const root =
    typeof incoming.root === "string" && incoming.root.trim()
      ? incoming.root.trim()
      : DEFAULT_SETTINGS.root;

  if (!isAbsolute(root) && !isWindowsAbsolute(root)) {
    throw new Error("local-editor.config.json root must be an absolute path.");
  }

  return {
    root,
    maxOriginalBytes: numericSetting(
      incoming.maxOriginalBytes,
      DEFAULT_SETTINGS.maxOriginalBytes
    ),
    maxWebVariantBytes: numericSetting(
      incoming.maxWebVariantBytes,
      DEFAULT_SETTINGS.maxWebVariantBytes
    ),
    maxRequestBytes: numericSetting(
      incoming.maxRequestBytes,
      DEFAULT_SETTINGS.maxRequestBytes
    ),
    deploymentWarnBytes: numericSetting(
      incoming.deploymentWarnBytes,
      DEFAULT_SETTINGS.deploymentWarnBytes
    ),
    backupIntervalMinutes: numericSetting(
      incoming.backupIntervalMinutes,
      DEFAULT_SETTINGS.backupIntervalMinutes
    ),
    backupRetention: numericSetting(
      incoming.backupRetention,
      DEFAULT_SETTINGS.backupRetention
    )
  };
}

export function getLibraryPaths(root) {
  return {
    root,
    originals: configuredJoin(root, "原图"),
    web: configuredJoin(root, "网页图"),
    recycle: configuredJoin(root, "回收站"),
    configBackups: configuredJoin(root, "回收站", "配置备份"),
    index: configuredJoin(root, "asset-index.json")
  };
}

export function parseManagedAssetPath(value) {
  if (typeof value !== "string") return null;
  const match = value.match(MANAGED_ASSET_PATTERN);
  if (!match) return null;

  return {
    path: value,
    id: match[1],
    variant: match[2],
    filename: basename(value)
  };
}

export function collectManagedAssetPaths(value) {
  const paths = new Set();
  const visited = new Set();

  function visit(candidate) {
    if (typeof candidate === "string") {
      if (parseManagedAssetPath(candidate)) paths.add(candidate);
      return;
    }

    if (!candidate || typeof candidate !== "object" || visited.has(candidate)) {
      return;
    }

    visited.add(candidate);

    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }

    Object.values(candidate).forEach(visit);
  }

  visit(value);
  return [...paths].sort();
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function timestampForFilename(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function withAssetMutation(operation) {
  const result = assetMutationQueue.then(operation, operation);
  assetMutationQueue = result.catch(() => undefined);
  return result;
}

async function atomicWrite(path, contents) {
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await open(temporaryPath, "wx");

  try {
    await handle.writeFile(contents);
    await handle.sync();
  } finally {
    await handle.close();
  }

  try {
    await rename(temporaryPath, path);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

async function atomicWriteJson(path, value) {
  await atomicWrite(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeOnce(path, data) {
  try {
    await writeFile(path, data, { flag: "wx" });
    return true;
  } catch (error) {
    if (error.code === "EEXIST") return false;
    throw error;
  }
}

function emptyAssetIndex() {
  return {
    version: INDEX_VERSION,
    updatedAt: new Date().toISOString(),
    assets: {}
  };
}

async function readAssetIndex(paths, { create = false } = {}) {
  try {
    const index = JSON.parse(await readFile(paths.index, "utf8"));
    if (
      !index ||
      typeof index !== "object" ||
      Array.isArray(index) ||
      !index.assets ||
      typeof index.assets !== "object" ||
      Array.isArray(index.assets)
    ) {
      throw new Error("asset-index.json has an invalid structure.");
    }
    return index;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const index = emptyAssetIndex();
    if (create) await atomicWriteJson(paths.index, index);
    return index;
  }
}

async function ensureLibrary(paths) {
  if (!storageAvailableOnPlatform(paths.root)) {
    throw new Error(`The configured storage root is unavailable on ${process.platform}.`);
  }

  await mkdir(paths.originals, { recursive: true });
  await mkdir(paths.web, { recursive: true });
  await mkdir(paths.recycle, { recursive: true });
  await readAssetIndex(paths, { create: true });

  const probe = configuredJoin(paths.root, `.write-test-${randomUUID()}`);
  await writeFile(probe, "");
  await unlink(probe);
}

async function readBody(request, maximumBytes) {
  const declaredLength = Number(request.headers["content-length"] ?? 0);
  if (declaredLength > maximumBytes) {
    throw new HttpError(
      413,
      "request_too_large",
      `Request exceeds the ${maximumBytes} byte safety limit.`
    );
  }

  const chunks = [];
  let total = 0;

  for await (const chunk of request) {
    total += chunk.length;
    if (total > maximumBytes) {
      throw new HttpError(
        413,
        "request_too_large",
        `Request exceeds the ${maximumBytes} byte safety limit.`
      );
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks, total);
}

async function readJsonBody(request, maximumBytes = 64 * 1024 * 1024) {
  const contentType = String(request.headers["content-type"] ?? "");
  if (!/^application\/json(?:;|$)/i.test(contentType)) {
    throw new HttpError(
      415,
      "unsupported_media_type",
      "Content-Type must be application/json."
    );
  }

  const body = await readBody(request, maximumBytes);
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    throw new HttpError(400, "invalid_json", "Request body is not valid JSON.");
  }
}

function parseContentDisposition(value) {
  const name = value.match(/(?:^|;)\s*name="([^"]*)"/i)?.[1];
  const filename = value.match(/(?:^|;)\s*filename="([^"]*)"/i)?.[1];
  return { name, filename };
}

function parseMultipartBody(body, boundary) {
  const marker = Buffer.from(`--${boundary}`);
  const nextMarker = Buffer.from(`\r\n--${boundary}`);
  const headerSeparator = Buffer.from("\r\n\r\n");
  const fields = {};
  const files = {};
  let cursor = body.indexOf(marker);

  if (cursor !== 0) {
    throw new HttpError(400, "invalid_multipart", "Malformed multipart body.");
  }

  cursor += marker.length;

  while (cursor < body.length) {
    if (body.subarray(cursor, cursor + 2).toString() === "--") break;
    if (body.subarray(cursor, cursor + 2).toString() === "\r\n") cursor += 2;

    const headerEnd = body.indexOf(headerSeparator, cursor);
    if (headerEnd < 0) {
      throw new HttpError(400, "invalid_multipart", "Multipart headers are incomplete.");
    }

    const rawHeaders = body.subarray(cursor, headerEnd).toString("utf8");
    const headers = {};
    for (const line of rawHeaders.split("\r\n")) {
      const separator = line.indexOf(":");
      if (separator <= 0) continue;
      headers[line.slice(0, separator).trim().toLowerCase()] = line
        .slice(separator + 1)
        .trim();
    }

    const disposition = parseContentDisposition(
      headers["content-disposition"] ?? ""
    );
    if (!disposition.name) {
      throw new HttpError(400, "invalid_multipart", "Multipart field has no name.");
    }

    const dataStart = headerEnd + headerSeparator.length;
    const dataEnd = body.indexOf(nextMarker, dataStart);
    if (dataEnd < 0) {
      throw new HttpError(400, "invalid_multipart", "Multipart boundary is incomplete.");
    }

    const data = body.subarray(dataStart, dataEnd);
    if (typeof disposition.filename === "string") {
      files[disposition.name] = {
        filename: disposition.filename,
        contentType: headers["content-type"] ?? "application/octet-stream",
        data
      };
    } else {
      fields[disposition.name] = data.toString("utf8");
    }

    cursor = dataEnd + 2 + marker.length;
  }

  return { fields, files };
}

async function readMultipart(request, maximumBytes) {
  const contentType = String(request.headers["content-type"] ?? "");
  const boundary = contentType.match(
    /^multipart\/form-data;\s*boundary=(?:"([^"]+)"|([^;\s]+))/i
  );
  const value = boundary?.[1] ?? boundary?.[2];

  if (!value || value.length > 200) {
    throw new HttpError(
      415,
      "unsupported_media_type",
      "Content-Type must be multipart/form-data with a valid boundary."
    );
  }

  return parseMultipartBody(await readBody(request, maximumBytes), value);
}

function isWebp(buffer) {
  return (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

const MIME_EXTENSIONS = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
  ["image/avif", ".avif"],
  ["image/bmp", ".bmp"],
  ["image/tiff", ".tiff"],
  ["image/svg+xml", ".svg"]
]);

const ALLOWED_ORIGINAL_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
  ".bmp",
  ".tif",
  ".tiff",
  ".svg"
]);

function originalExtension(file) {
  const fromName = extname(file.filename ?? "").toLowerCase();
  if (ALLOWED_ORIGINAL_EXTENSIONS.has(fromName)) {
    return fromName === ".jpeg" ? ".jpg" : fromName === ".tif" ? ".tiff" : fromName;
  }

  return MIME_EXTENSIONS.get(String(file.contentType).toLowerCase()) ?? ".bin";
}

function imageDimension(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100_000) {
    throw new HttpError(400, "invalid_dimension", `${fieldName} is invalid.`);
  }
  return Math.round(parsed);
}

function normalizeAlt(value) {
  return typeof value === "string" ? value.slice(0, 240) : "";
}

async function saveUploadedAsset({ fields, files, paths, settings }) {
  const original = files.original?.data?.length ? files.original : null;
  const detail = files.detail;
  const cover = files.cover;

  if (!detail?.data?.length || !cover?.data?.length) {
    throw new HttpError(
      400,
      "missing_web_variants",
      "Both detail and cover WebP files are required."
    );
  }
  if (!isWebp(detail.data) || !isWebp(cover.data)) {
    throw new HttpError(
      415,
      "invalid_web_variant",
      "detail and cover must both be WebP images."
    );
  }
  if (original && original.data.length > settings.maxOriginalBytes) {
    throw new HttpError(
      413,
      "original_too_large",
      `Original image exceeds ${settings.maxOriginalBytes} bytes.`
    );
  }
  if (
    detail.data.length > settings.maxWebVariantBytes ||
    cover.data.length > settings.maxWebVariantBytes
  ) {
    throw new HttpError(
      413,
      "web_variant_too_large",
      `A WebP variant exceeds ${settings.maxWebVariantBytes} bytes.`
    );
  }

  const hashSource = original?.data ?? detail.data;
  const originalId = createHash("sha256").update(hashSource).digest("hex");
  const id = createHash("sha256")
    .update(hashSource)
    .update(detail.data)
    .update(cover.data)
    .digest("hex");
  const detailFilename = `${id}-detail.webp`;
  const coverFilename = `${id}-cover.webp`;
  const detailPath = configuredJoin(paths.web, detailFilename);
  const coverPath = configuredJoin(paths.web, coverFilename);
  const index = await readAssetIndex(paths, { create: true });
  const existing = index.assets[id];
  let originalRelativePath = existing?.original ?? null;
  let wroteOriginal = false;

  if (original && !originalRelativePath) {
    const extension = originalExtension(original);
    const originalFilename = `${originalId}${extension}`;
    const originalPath = configuredJoin(paths.originals, originalFilename);
    wroteOriginal = await writeOnce(originalPath, original.data);
    originalRelativePath = `原图/${originalFilename}`;
  }

  const wroteDetail = await writeOnce(detailPath, detail.data);
  const wroteCover = await writeOnce(coverPath, cover.data);
  const now = new Date().toISOString();
  const asset = {
    id,
    src: `/assets/portfolio/${detailFilename}`,
    coverSrc: `/assets/portfolio/${coverFilename}`,
    width: imageDimension(fields.width, "width"),
    height: imageDimension(fields.height, "height"),
    alt: normalizeAlt(fields.alt)
  };

  index.version = INDEX_VERSION;
  index.updatedAt = now;
  index.assets[id] = {
    ...(existing && typeof existing === "object" ? existing : {}),
    ...asset,
    original: originalRelativePath,
    originalName: original?.filename || existing?.originalName || null,
    detail: `网页图/${detailFilename}`,
    cover: `网页图/${coverFilename}`,
    originalBytes: original?.data.length ?? existing?.originalBytes ?? 0,
    detailBytes: detail.data.length,
    coverBytes: cover.data.length,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    recycledAt: null
  };
  await atomicWriteJson(paths.index, index);

  return {
    asset,
    deduplicated: !wroteOriginal && !wroteDetail && !wroteCover
  };
}

async function maybeBackupConfig(configPath, paths, settings) {
  if (!(await exists(configPath))) return false;

  await mkdir(paths.configBackups, { recursive: true });
  const backupFiles = (await readdir(paths.configBackups, { withFileTypes: true }))
    .filter(
      (entry) =>
        entry.isFile() &&
        /^portfolio-config-\d{4}-\d{2}-\d{2}T.+\.json$/.test(entry.name)
    )
    .map((entry) => entry.name);
  const backupStats = await Promise.all(
    backupFiles.map(async (name) => ({
      name,
      modified: (await stat(configuredJoin(paths.configBackups, name))).mtimeMs
    }))
  );
  backupStats.sort((left, right) => right.modified - left.modified);
  const latest = backupStats[0];
  const intervalMs = settings.backupIntervalMinutes * 60 * 1000;

  if (latest && Date.now() - latest.modified < intervalMs) return false;

  const backupPath = configuredJoin(
    paths.configBackups,
    `portfolio-config-${timestampForFilename()}.json`
  );
  await copyFile(configPath, backupPath);

  for (const stale of backupStats.slice(Math.max(0, settings.backupRetention - 1))) {
    await unlink(configuredJoin(paths.configBackups, stale.name)).catch(() => {});
  }

  return true;
}

function validateConfigPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "invalid_config", "Portfolio config must be an object.");
  }

  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (/data:image\//i.test(serialized)) {
    throw new HttpError(
      400,
      "inline_image_not_allowed",
      "Upload local images before saving; Base64 image data is not allowed in config."
    );
  }
  if (/(?:^|["'])E:\\\\本地编辑器存图\\/i.test(serialized)) {
    throw new HttpError(
      400,
      "absolute_asset_path_not_allowed",
      "Config must store public asset paths, not E-drive absolute paths."
    );
  }

  return serialized;
}

async function saveConfig(config, projectRoot, paths, settings) {
  const configPath = resolve(projectRoot, "data", "portfolio-config.json");
  const serialized = validateConfigPayload(config);
  let backupCreated = false;

  try {
    await ensureLibrary(paths);
    backupCreated = await maybeBackupConfig(configPath, paths, settings);
  } catch {
    // The project config remains editable when the optional image library is offline.
  }

  await atomicWrite(configPath, serialized);
  const savedAt = new Date().toISOString();

  return {
    saved: true,
    savedAt,
    bytes: Buffer.byteLength(serialized),
    backupCreated
  };
}

async function directoryMetrics(path) {
  let bytes = 0;
  let files = 0;

  async function walk(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }

    for (const entry of entries) {
      const child = configuredJoin(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(child);
      } else if (entry.isFile()) {
        const details = await stat(child);
        bytes += details.size;
        files += 1;
      }
    }
  }

  await walk(path);
  return { bytes, files };
}

async function storageStatus(projectRoot, paths, settings) {
  const configPath = resolve(projectRoot, "data", "portfolio-config.json");
  const base = {
    available: false,
    readOnly: true,
    configWritable: false,
    configError: null,
    root: paths.root,
    freeBytes: null,
    totalBytes: null,
    libraryBytes: 0,
    originalBytes: 0,
    webBytes: 0,
    recycleBytes: 0,
    assetCount: 0,
    maxOriginalBytes: settings.maxOriginalBytes,
    lastSavedAt: null,
    error: null
  };

  try {
    const configProbe = resolve(
      projectRoot,
      "data",
      `.config-write-test-${randomUUID()}`
    );
    await writeFile(configProbe, "");
    await unlink(configProbe);
    base.configWritable = true;
  } catch (error) {
    base.configError = error.message;
  }

  try {
    await ensureLibrary(paths);
    const [originals, web, recycle, index] = await Promise.all([
      directoryMetrics(paths.originals),
      directoryMetrics(paths.web),
      directoryMetrics(paths.recycle),
      readAssetIndex(paths, { create: true })
    ]);
    const configStat = await stat(configPath).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    const fileSystem = await statfs(paths.root).catch(() => null);
    const blockSize = Number(fileSystem?.bsize ?? 0);

    return {
      ...base,
      available: true,
      readOnly: false,
      freeBytes: fileSystem ? blockSize * Number(fileSystem.bavail) : null,
      totalBytes: fileSystem ? blockSize * Number(fileSystem.blocks) : null,
      libraryBytes: originals.bytes + web.bytes + recycle.bytes,
      originalBytes: originals.bytes,
      webBytes: web.bytes,
      recycleBytes: recycle.bytes,
      assetCount: Object.keys(index.assets).length,
      lastSavedAt: configStat?.mtime.toISOString() ?? null
    };
  } catch (error) {
    return {
      ...base,
      error: error.message
    };
  }
}

async function cleanupAssets(payload, projectRoot, paths) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(400, "invalid_cleanup", "Cleanup body must be an object.");
  }

  const dryRun = payload.dryRun !== false;
  const configPath = resolve(projectRoot, "data", "portfolio-config.json");
  let config;
  try {
    config = JSON.parse(await readFile(configPath, "utf8"));
  } catch (error) {
    throw new HttpError(
      500,
      "config_unavailable",
      `Cannot read the saved portfolio config: ${error.message}`
    );
  }
  const referenced = new Set(
    collectManagedAssetPaths(config).map(
      (path) => parseManagedAssetPath(path).filename
    )
  );

  await ensureLibrary(paths);
  const entries = await readdir(paths.web, { withFileTypes: true });
  const managedFiles = entries.filter(
    (entry) => entry.isFile() && MANAGED_FILE_PATTERN.test(entry.name)
  );
  const candidates = [];
  const retained = [];

  for (const entry of managedFiles) {
    const details = await stat(configuredJoin(paths.web, entry.name));
    const record = { name: entry.name, bytes: details.size };
    (referenced.has(entry.name) ? retained : candidates).push(record);
  }
  candidates.sort((left, right) => left.name.localeCompare(right.name));
  retained.sort((left, right) => left.name.localeCompare(right.name));
  const previewToken = createHash("sha256")
    .update(JSON.stringify({ candidates, retained }))
    .digest("hex");

  let movedCount = 0;
  let movedBytes = 0;
  if (!dryRun && candidates.length > 0) {
    if (payload.previewToken !== previewToken) {
      throw new HttpError(
        409,
        "cleanup_preview_expired",
        "The image library or saved config changed after preview. Run cleanup again."
      );
    }
    const recycleBatch = configuredJoin(
      paths.recycle,
      `网页图-${timestampForFilename()}`
    );
    await mkdir(recycleBatch, { recursive: true });

    for (const candidate of candidates) {
      await rename(
        configuredJoin(paths.web, candidate.name),
        configuredJoin(recycleBatch, candidate.name)
      );
      movedCount += 1;
      movedBytes += candidate.bytes;
    }

    const index = await readAssetIndex(paths, { create: true });
    const recycledIds = new Set(
      candidates
        .map((candidate) => candidate.name.match(MANAGED_FILE_PATTERN)?.[1])
        .filter(Boolean)
    );
    const recycledAt = new Date().toISOString();
    for (const id of recycledIds) {
      if (!index.assets[id]) continue;

      const hasOriginal =
        typeof index.assets[id].original === "string" &&
        index.assets[id].original.length > 0;
      if (hasOriginal) {
        index.assets[id].recycledAt = recycledAt;
      } else {
        delete index.assets[id];
      }
    }
    index.updatedAt = recycledAt;
    await atomicWriteJson(paths.index, index);
  }

  return {
    dryRun,
    previewToken,
    unreferencedCount: candidates.length,
    unreferencedBytes: candidates.reduce((total, item) => total + item.bytes, 0),
    movedCount,
    movedBytes,
    retainedCount: retained.length,
    retainedBytes: retained.reduce((total, item) => total + item.bytes, 0),
    paths: candidates.map((item) => `/assets/portfolio/${item.name}`)
  };
}

function localRequest(request) {
  const remoteAddress = String(request.socket?.remoteAddress ?? "").toLowerCase();
  const isLoopback =
    remoteAddress === "::1" ||
    remoteAddress.startsWith("127.") ||
    remoteAddress.startsWith("::ffff:127.");
  if (!isLoopback) return false;

  const host = String(request.headers.host ?? "");
  let hostname;

  try {
    hostname = new URL(`http://${host}`).hostname;
  } catch {
    return false;
  }

  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}

function localMutationOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;

  try {
    const hostname = new URL(origin).hostname;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    );
  } catch {
    return false;
  }
}

function jsonResponse(response, status, body, headers = {}) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    ...headers
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function apiError(response, error) {
  const status = error instanceof HttpError ? error.status : 500;
  const code = error instanceof HttpError ? error.code : "local_storage_error";
  jsonResponse(response, status, {
    error: {
      code,
      message: error.message || "Local storage operation failed."
    }
  });
}

async function serveManagedAsset(request, response, paths, pathname) {
  const managed = parseManagedAssetPath(pathname);
  if (!managed || !["GET", "HEAD"].includes(request.method)) return false;

  const path = configuredJoin(paths.web, managed.filename);
  let details;
  try {
    details = await stat(path);
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
  if (!details.isFile()) return false;

  response.writeHead(200, {
    "Cache-Control": "no-cache",
    "Content-Length": details.size,
    "Content-Type": "image/webp",
    "Last-Modified": details.mtime.toUTCString()
  });
  if (request.method === "HEAD") {
    response.end();
    return true;
  }

  await new Promise((resolveStream, rejectStream) => {
    const stream = createReadStream(path);
    stream.on("error", rejectStream);
    stream.on("end", resolveStream);
    stream.pipe(response);
  });
  return true;
}

async function handleApiRequest(
  request,
  response,
  pathname,
  projectRoot,
  paths,
  settings
) {
  if (!localRequest(request)) {
    throw new HttpError(
      403,
      "local_requests_only",
      "The local editor API only accepts requests from this computer."
    );
  }
  if (!["GET", "HEAD"].includes(request.method) && !localMutationOrigin(request)) {
    throw new HttpError(
      403,
      "invalid_origin",
      "The local editor API rejected this request origin."
    );
  }

  if (pathname === `${API_PREFIX}/status`) {
    if (request.method !== "GET") {
      throw new HttpError(405, "method_not_allowed", "Use GET for this endpoint.");
    }
    jsonResponse(response, 200, await storageStatus(projectRoot, paths, settings));
    return;
  }

  if (pathname === `${API_PREFIX}/config`) {
    const configPath = resolve(projectRoot, "data", "portfolio-config.json");
    if (request.method === "GET") {
      try {
        const config = JSON.parse(await readFile(configPath, "utf8"));
        jsonResponse(response, 200, config);
      } catch (error) {
        if (error.code === "ENOENT") {
          jsonResponse(response, 200, { version: 2 });
          return;
        }
        throw error;
      }
      return;
    }
    if (request.method === "PUT") {
      const config = await readJsonBody(request);
      jsonResponse(
        response,
        200,
        await withAssetMutation(() =>
          saveConfig(config, projectRoot, paths, settings)
        )
      );
      return;
    }
    throw new HttpError(405, "method_not_allowed", "Use GET or PUT for this endpoint.");
  }

  if (pathname === `${API_PREFIX}/assets`) {
    if (request.method !== "POST") {
      throw new HttpError(405, "method_not_allowed", "Use POST for this endpoint.");
    }
    await ensureLibrary(paths);
    const multipart = await readMultipart(request, settings.maxRequestBytes);
    jsonResponse(
      response,
      201,
      await withAssetMutation(() =>
        saveUploadedAsset({ ...multipart, paths, settings })
      )
    );
    return;
  }

  if (pathname === `${API_PREFIX}/assets/cleanup`) {
    if (request.method !== "POST") {
      throw new HttpError(405, "method_not_allowed", "Use POST for this endpoint.");
    }
    const payload = await readJsonBody(request, 4 * 1024 * 1024);
    jsonResponse(
      response,
      200,
      await withAssetMutation(() => cleanupAssets(payload, projectRoot, paths))
    );
    return;
  }

  throw new HttpError(404, "not_found", "Local editor endpoint not found.");
}

export function localEditorStorage() {
  let projectRoot = process.cwd();
  let settingsPromise;

  return {
    name: "local-editor-storage",
    apply: "serve",
    configResolved(config) {
      projectRoot = config.root;
      settingsPromise = loadLocalEditorSettings(projectRoot);
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        let pathname;
        try {
          pathname = new URL(request.url ?? "/", "http://localhost").pathname;
        } catch {
          next();
          return;
        }

        if (
          !pathname.startsWith(API_PREFIX) &&
          !pathname.startsWith("/assets/portfolio/")
        ) {
          next();
          return;
        }

        try {
          const settings = await settingsPromise;
          const paths = getLibraryPaths(settings.root);

          if (pathname.startsWith("/assets/portfolio/")) {
            if (!localRequest(request)) {
              throw new HttpError(
                403,
                "local_requests_only",
                "The local image library only accepts requests from this computer."
              );
            }
            if (await serveManagedAsset(request, response, paths, pathname)) return;
            next();
            return;
          }

          await handleApiRequest(
            request,
            response,
            pathname,
            projectRoot,
            paths,
            settings
          );
        } catch (error) {
          if (response.headersSent) {
            response.destroy(error);
            return;
          }
          apiError(response, error);
        }
      });
    }
  };
}
