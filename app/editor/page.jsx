"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from "react";
import {
  getImageAlt,
  getImageSource,
  getDefaultPortfolioConfig,
  getStarterPortfolioConfig,
  isSafeImageSource,
  loadPortfolioConfig,
  loadLegacyPortfolioConfig,
  MAX_PROJECT_CONTENT_IMAGES,
  MAX_PROJECTS_PER_GROUP,
  MAX_TIMELINE_ITEMS,
  MAX_WORK_FILTERS,
  normalizeImageAsset,
  normalizePortfolioConfig,
  portfolioConfigSize,
  PORTFOLIO_PREVIEW_MESSAGE,
  savePortfolioConfig,
  typographyDefaults,
  typographyLimits
} from "../../lib/portfolio-config";

const editorSections = [
  { id: "home", index: "01", label: "首页" },
  { id: "profile", index: "02", label: "个人介绍" },
  { id: "resume", index: "03", label: "经历与数据" },
  { id: "works", index: "04", label: "作品" },
  { id: "contact", index: "05", label: "联系" },
  { id: "typography", index: "06", label: "排版" },
  { id: "theme", index: "07", label: "主题与备份" }
];

const typographyGroups = [
  {
    id: "heroTitle",
    title: "首页大标题",
    description: "控制首屏英文标题。桌面字号会保持流式缩放，手机端在窄屏会自动限制，避免横向溢出。"
  },
  {
    id: "sectionTitle",
    title: "区块标题",
    description: "控制个人介绍、作品集和联系区的主标题。"
  },
  {
    id: "body",
    title: "主要正文",
    description: "控制首屏说明和个人介绍正文，不影响标签、时间轴辅助文字等次级信息。"
  },
  {
    id: "workTitle",
    title: "作品卡标题",
    description: "控制作品封面底部标题，手机字号在窄屏作品卡中生效。"
  }
];

const MAX_SOURCE_IMAGE_BYTES = 100_000_000;
const MAX_CONFIG_IMPORT_BYTES = 150_000_000;
const LOCAL_EDITOR_CONFIG_API = "/__local-editor/config";
const LOCAL_EDITOR_STATUS_API = "/__local-editor/status";
const LOCAL_EDITOR_ASSETS_API = "/__local-editor/assets";
const LOCAL_EDITOR_CLEANUP_API = "/__local-editor/assets/cleanup";

const imageCompressionProfiles = {
  cover: {
    maxWidth: 1200,
    maxHeight: 1200,
    maxPixels: 1_440_000,
    quality: 0.82
  },
  longCover: {
    maxWidth: 1200,
    maxHeight: 16000,
    maxPixels: 12_000_000,
    quality: 0.8
  },
  standard: {
    maxWidth: 1920,
    maxHeight: 1920,
    maxPixels: 4_000_000,
    quality: 0.88
  },
  detail: {
    maxWidth: 1920,
    maxHeight: 32000,
    maxPixels: 32_000_000,
    minimumWidth: 750,
    quality: 0.9
  }
};

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function createWorkFilterId(workFilters) {
  const existingIds = new Set(workFilters.map((filter) => filter.id));
  let id = "";

  do {
    const token = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 24)
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    id = `filter-${token}`;
  } while (existingIds.has(id));

  return id;
}

function createProjectId(projects, groupId) {
  const existingIds = new Set(projects.map((project) => project.id));
  let id = "";

  do {
    const token = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 24)
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    id = `${groupId}-project-${token}`;
  } while (existingIds.has(id));

  return id;
}

function createTimelineId(items) {
  const existingIds = new Set(items.map((item) => item.id));
  let id = "";

  do {
    const token = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 24)
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    id = `timeline-${token}`;
  } while (existingIds.has(id));

  return id;
}

function workFilterDisplayLabel(filter, index) {
  const label = typeof filter?.label === "string" ? filter.label.trim() : "";
  return label || `分类 ${Math.max(0, index) + 1}`;
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  if (value < 1024) return `${Math.round(value)} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(2)} MB`;
  if (value < 1024 ** 4) return `${(value / 1024 ** 3).toFixed(2)} GB`;
  return `${(value / 1024 ** 4).toFixed(2)} TB`;
}

function errorMessage(error, fallback = "图片处理失败，请更换图片后重试。") {
  return error instanceof Error && error.message ? error.message : fallback;
}

function hexToRgb(hex) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function relativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const channels = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground, background) {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function fitImageDimensions(sourceWidth, sourceHeight, profile) {
  const pixelScale = Math.sqrt(
    profile.maxPixels / Math.max(1, sourceWidth * sourceHeight)
  );
  const scale = Math.min(
    1,
    profile.maxWidth / sourceWidth,
    profile.maxHeight / sourceHeight,
    pixelScale
  );

  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale))
  };
}

function createImageCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: true });

  if (!context) throw new Error("浏览器无法创建图片处理画布，请更换浏览器后重试。");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  return { canvas, context };
}

function renderHighQualityCanvas(
  source,
  sourceWidth,
  sourceHeight,
  targetWidth,
  targetHeight
) {
  let currentSource = source;
  let currentWidth = sourceWidth;
  let currentHeight = sourceHeight;

  while (
    currentWidth / 2 > targetWidth &&
    currentHeight / 2 > targetHeight
  ) {
    const nextWidth = Math.max(targetWidth, Math.round(currentWidth / 2));
    const nextHeight = Math.max(targetHeight, Math.round(currentHeight / 2));
    const intermediate = createImageCanvas(nextWidth, nextHeight);
    intermediate.context.drawImage(
      currentSource,
      0,
      0,
      currentWidth,
      currentHeight,
      0,
      0,
      nextWidth,
      nextHeight
    );
    currentSource = intermediate.canvas;
    currentWidth = nextWidth;
    currentHeight = nextHeight;
  }

  const output = createImageCanvas(targetWidth, targetHeight);
  output.context.drawImage(
    currentSource,
    0,
    0,
    currentWidth,
    currentHeight,
    0,
    0,
    targetWidth,
    targetHeight
  );
  return output.canvas;
}

function canvasToWebpBlob(canvas, quality) {
  return new Promise((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality)
  );
}

async function prepareImageUpload(file, { mode = "standard" } = {}) {
  if (!file?.type?.startsWith("image/")) {
    throw new Error("请选择 PNG、JPG、WebP 或其他常见图片格式。");
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error("源图片不能超过 100MB，请先压缩后再上传。");
  }

  let source;
  let cleanup = () => {};

  if (typeof window.createImageBitmap === "function") {
    source = await window.createImageBitmap(file);
    cleanup = () => source.close?.();
  } else {
    const objectUrl = URL.createObjectURL(file);
    cleanup = () => URL.revokeObjectURL(objectUrl);
    source = new Image();
    source.src = objectUrl;
    await new Promise((resolve, reject) => {
      source.onload = resolve;
      source.onerror = () => {
        cleanup();
        reject(new Error("图片读取失败，请更换图片。"));
      };
    });
  }

  try {
    const sourceWidth = source.width || source.naturalWidth;
    const sourceHeight = source.height || source.naturalHeight;
    const resolvedMode =
      mode === "auto"
        ? sourceHeight / Math.max(1, sourceWidth) >= 2
          ? "detail"
          : "standard"
        : mode;
    const profile =
      imageCompressionProfiles[resolvedMode] ??
      imageCompressionProfiles.standard;
    const dimensions = fitImageDimensions(sourceWidth, sourceHeight, profile);
    const coverProfile =
      resolvedMode === "detail"
        ? imageCompressionProfiles.longCover
        : imageCompressionProfiles.cover;
    const coverDimensions = fitImageDimensions(
      sourceWidth,
      sourceHeight,
      coverProfile
    );
    const minimumOutputWidth =
      resolvedMode === "detail"
        ? Math.min(sourceWidth, profile.minimumWidth)
        : 1;
    const detailSizeError =
      "长图在至少 750px 宽的清晰度下仍无法安全处理，请拆分长图后再上传。";

    if (dimensions.width < minimumOutputWidth) {
      throw new Error(detailSizeError);
    }

    const detailCanvas = renderHighQualityCanvas(
      source,
      sourceWidth,
      sourceHeight,
      dimensions.width,
      dimensions.height
    );
    const coverCanvas = renderHighQualityCanvas(
      source,
      sourceWidth,
      sourceHeight,
      coverDimensions.width,
      coverDimensions.height
    );
    const [detailBlob, coverBlob] = await Promise.all([
      canvasToWebpBlob(detailCanvas, profile.quality),
      canvasToWebpBlob(coverCanvas, coverProfile.quality)
    ]);

    if (!detailBlob || !coverBlob) {
      throw new Error("浏览器无法生成 WebP 图片，请更换浏览器后重试。");
    }

    return {
      coverBlob,
      coverHeight: coverDimensions.height,
      coverWidth: coverDimensions.width,
      detailBlob,
      outputHeight: dimensions.height,
      outputWidth: dimensions.width,
      sourceHeight,
      sourceWidth,
      compressionMode: resolvedMode
    };
  } finally {
    cleanup();
  }
}

async function readJsonResponse(response, fallbackMessage) {
  let payload = null;

  try {
    payload = await response.json();
  } catch {
    // The local service may be unavailable before it can return JSON.
  }

  if (!response.ok) {
    const apiError =
      typeof payload?.error === "string"
        ? payload.error
        : payload?.error?.message;
    throw new Error(apiError || payload?.message || fallbackMessage);
  }

  return payload;
}

async function uploadImageAsset(file, { alt = "", mode = "standard" } = {}) {
  const prepared = await prepareImageUpload(file, { mode });
  const formData = new FormData();
  formData.append("original", file, file.name || "source-image");
  formData.append("detail", prepared.detailBlob, "detail.webp");
  formData.append("cover", prepared.coverBlob, "cover.webp");
  formData.append("width", String(prepared.outputWidth));
  formData.append("height", String(prepared.outputHeight));
  formData.append("alt", alt);

  const response = await fetch(LOCAL_EDITOR_ASSETS_API, {
    method: "POST",
    body: formData
  });
  const payload = await readJsonResponse(
    response,
    "图片写入 E:\\本地编辑器存图 失败。"
  );
  const asset = normalizeImageAsset(payload?.asset);

  if (!asset) {
    throw new Error("本地服务未返回有效的图片资源。");
  }

  return {
    asset,
    ...prepared,
    coverBytes: prepared.coverBlob.size,
    detailBytes: prepared.detailBlob.size,
    sourceBytes: file.size
  };
}

function dataUrlToFile(dataUrl, name = "legacy-image") {
  return fetch(dataUrl)
    .then((response) => {
      if (!response.ok) throw new Error("内嵌图片读取失败。");
      return response.blob();
    })
    .then((blob) => {
      const extension = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
      return new File([blob], `${name}.${extension}`, { type: blob.type });
    });
}

function imageValueKey(value) {
  return getImageSource(value) || "";
}

async function migrateInlineImages(candidate, onProgress = () => {}) {
  const next = normalizePortfolioConfig(candidate);
  const jobs = [];

  const queueImage = (read, write, mode, fallbackAlt) => {
    const current = read();
    const source = getImageSource(current);
    if (!source?.startsWith("data:image/")) return;
    const jobNumber = jobs.length + 1;

    jobs.push(async () => {
      const file = await dataUrlToFile(source, `migrated-${jobNumber}`);
      const result = await uploadImageAsset(file, {
        alt: getImageAlt(current, fallbackAlt),
        mode
      });
      write(result.asset);
    });
  };

  queueImage(
    () => next.siteContent.heroImage,
    (asset) => {
      next.siteContent.heroImage = asset;
    },
    "standard",
    "首屏背景图"
  );
  queueImage(
    () => next.siteContent.profile.portraitImage,
    (asset) => {
      next.siteContent.profile.portraitImage = asset;
    },
    "standard",
    "人物图片"
  );

  next.workGroups.forEach((group) => {
    group.projects.forEach((project) => {
      project.contentImages.forEach((image, imageIndex) => {
        queueImage(
          () => project.contentImages[imageIndex],
          (asset) => {
            project.contentImages[imageIndex] = asset;
          },
          "auto",
          `${project.title || "作品"} 内容图 ${imageIndex + 1}`
        );
      });
    });
  });

  for (let index = 0; index < jobs.length; index += 1) {
    onProgress(index + 1, jobs.length);
    await jobs[index]();
  }

  return { config: normalizePortfolioConfig(next), migratedCount: jobs.length };
}

function TextControl({
  label,
  value,
  onChange,
  hint,
  maxLength = 200,
  multiline = false,
  rows = 3,
  type = "text",
  placeholder = ""
}) {
  const id = useId();
  const Component = multiline ? "textarea" : "input";

  return (
    <label className="editor-field" htmlFor={id}>
      <span className="editor-field-label">
        <span>{label}</span>
        <small>
          {String(value ?? "").length}/{maxLength}
        </small>
      </span>
      <Component
        id={id}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={multiline ? rows : undefined}
        type={multiline ? undefined : type}
        value={value ?? ""}
      />
      {hint && <small className="editor-field-hint">{hint}</small>}
    </label>
  );
}

function ColorControl({ label, value, onChange }) {
  const colorId = useId();
  const textId = useId();

  return (
    <div className="editor-color-field">
      <span>{label}</span>
      <div>
        <label aria-label={`${label}取色器`} htmlFor={colorId}>
          <input
            id={colorId}
            onChange={(event) => onChange(event.target.value)}
            type="color"
            value={value}
          />
        </label>
        <label className="sr-only" htmlFor={textId}>
          {label}十六进制颜色
        </label>
        <input
          id={textId}
          maxLength={7}
          onChange={(event) => onChange(event.target.value)}
          pattern="^#[0-9a-fA-F]{6}$"
          spellCheck="false"
          value={value}
        />
      </div>
    </div>
  );
}

function formatRangeValue(value, unit, decimals) {
  const numeric = Number(value);
  const prefix = unit === "em" && numeric > 0 ? "+" : "";
  return `${prefix}${numeric.toFixed(decimals)}${unit ? ` ${unit}` : ""}`;
}

function RangeControl({
  defaultValue,
  decimals = 0,
  hint,
  label,
  max,
  min,
  onChange,
  step,
  unit,
  value
}) {
  const id = useId();
  const hintId = useId();
  const numericValue = Number(value);
  const progress = ((numericValue - min) / (max - min)) * 100;
  const valueText = formatRangeValue(numericValue, unit, decimals);

  return (
    <div
      className="editor-range-field"
      style={{ "--range-progress": `${Math.min(100, Math.max(0, progress))}%` }}
    >
      <div className="editor-range-head">
        <label htmlFor={id}>{label}</label>
        <div>
          <small>{numericValue === defaultValue ? "默认值" : "已调整"}</small>
          <output htmlFor={id}>{valueText}</output>
        </div>
      </div>
      <input
        aria-describedby={hint ? hintId : undefined}
        aria-valuetext={valueText}
        id={id}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={numericValue}
      />
      <div aria-hidden="true" className="editor-range-scale">
        <span>{formatRangeValue(min, unit, decimals)}</span>
        <span>{formatRangeValue(max, unit, decimals)}</span>
      </div>
      {hint && (
        <small className="editor-field-hint" id={hintId}>
          {hint}
        </small>
      )}
    </div>
  );
}

function ImageControl({
  compressionMode = "standard",
  hint,
  label,
  onChange,
  previewMode = "cover",
  value
}) {
  const inputId = useId();
  const fileId = useId();
  const hintId = useId();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [uploadResult, setUploadResult] = useState(null);
  const detailValue = getImageSource(value);
  const [addressValue, setAddressValue] = useState(
    detailValue.startsWith("data:") ? "" : detailValue
  );
  const previewValue = getImageSource(
    value,
    previewMode === "cover" ? "cover" : "detail"
  );

  useEffect(() => {
    if (
      uploadResult &&
      getImageSource(uploadResult.asset) !== getImageSource(value)
    ) {
      setUploadResult(null);
    }
  }, [uploadResult, value]);

  useEffect(() => {
    setAddressValue(detailValue.startsWith("data:") ? "" : detailValue);
  }, [detailValue]);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setProcessing(true);
    setError("");

    try {
      const result = await uploadImageAsset(file, {
        alt: getImageAlt(value, label) || label,
        mode: compressionMode
      });
      setUploadResult({
        ...result
      });
      onChange(result.asset);
    } catch (uploadError) {
      setError(errorMessage(uploadError));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <fieldset className="editor-image-field">
      <legend>{label}</legend>
      {previewValue && (
        <div
          className={`editor-image-preview ${
            previewMode === "detail" ? "is-detail" : ""
          }`}
        >
          <img
            alt={`${label}预览`}
            onError={() =>
              setError("图片无法加载，请检查图片地址或更换图片。")
            }
            referrerPolicy="no-referrer"
            src={previewValue}
          />
          <button
            onClick={() => {
              setError("");
              setUploadResult(null);
              setAddressValue("");
              onChange(null);
            }}
            type="button"
          >
            移除图片
          </button>
        </div>
      )}
      <div className="editor-image-actions">
        <label className="editor-upload-button" htmlFor={fileId}>
          {processing
            ? compressionMode === "detail"
              ? "正在优化长图…"
              : "正在压缩…"
            : "选择本地图片"}
        </label>
        <input
          accept="image/*"
          aria-describedby={hint ? hintId : undefined}
          disabled={processing}
          id={fileId}
          onChange={handleFile}
          type="file"
        />
        {previewValue && <span>已添加图片</span>}
      </div>
      <label className="editor-field compact" htmlFor={inputId}>
        <span className="editor-field-label">
          <span>或填写图片地址</span>
        </span>
        <input
          aria-describedby={hint ? hintId : undefined}
          id={inputId}
          onChange={(event) => {
            setError("");
            setUploadResult(null);
            setAddressValue(event.target.value);
          }}
          onBlur={() => {
            const source = addressValue.trim();
            if (!source) {
              onChange(null);
              return;
            }
            if (!isSafeImageSource(source) || source.startsWith("data:")) {
              setError("图片地址仅支持 http(s):// 或 / 开头的站内路径。");
              return;
            }
            onChange(
              normalizeImageAsset({
                src: source,
                alt: getImageAlt(value, label)
              })
            );
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          placeholder="https://… 或 /assets/…"
          type="text"
          value={addressValue}
        />
      </label>
      {uploadResult && (
        <div
          className={`editor-image-result ${
            compressionMode === "detail" &&
            (uploadResult.outputWidth < 750 ||
              uploadResult.outputHeight / uploadResult.outputWidth < 2)
              ? "is-warning"
              : ""
          }`}
          role="status"
        >
          <strong>
            原图 {uploadResult.sourceWidth}×{uploadResult.sourceHeight} ·{" "}
            {formatBytes(uploadResult.sourceBytes)}
          </strong>
          <span>
            详情图 {uploadResult.outputWidth}×{uploadResult.outputHeight} ·{" "}
            {formatBytes(uploadResult.detailBytes)}；封面图{" "}
            {uploadResult.coverWidth}×{uploadResult.coverHeight} ·{" "}
            {formatBytes(uploadResult.coverBytes)}
          </span>
          <small>原图已归档到 E 盘，配置中仅保存网页图片路径。</small>
          {compressionMode === "detail" && uploadResult.outputWidth < 750 && (
            <small>输出宽度低于 750px，详情文字在大屏上可能不够清晰。</small>
          )}
          {compressionMode === "detail" &&
            uploadResult.outputHeight / uploadResult.outputWidth < 2 && (
              <small>当前图片比例较短，请确认内容是否完整。</small>
            )}
        </div>
      )}
      {hint && (
        <small className="editor-field-hint" id={hintId}>
          {hint}
        </small>
      )}
      {error && (
        <p className="editor-inline-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function ProjectContentImagesControl({ images = [], onChange }) {
  const addressId = useId();
  const fileId = useId();
  const hintId = useId();
  const jobTokenRef = useRef(0);
  const mountedRef = useRef(true);
  const [address, setAddress] = useState("");
  const [processing, setProcessing] = useState({
    active: false,
    current: 0,
    total: 0
  });
  const [errors, setErrors] = useState([]);
  const [batchStatus, setBatchStatus] = useState("");
  const contentImages = Array.isArray(images) ? images : [];
  const isFull = contentImages.length >= MAX_PROJECT_CONTENT_IMAGES;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      jobTokenRef.current += 1;
    };
  }, []);

  const moveImage = (index, direction) => {
    if (processing.active) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= contentImages.length) return;

    const next = [...contentImages];
    const [movedImage] = next.splice(index, 1);
    next.splice(targetIndex, 0, movedImage);
    onChange(next);
    setBatchStatus(
      `已将第 ${index + 1} 张内容图${direction < 0 ? "上移" : "下移"}。`
    );
  };

  const removeImage = (index) => {
    if (processing.active) return;
    onChange(contentImages.filter((_, imageIndex) => imageIndex !== index));
    setBatchStatus(`已删除第 ${index + 1} 张内容图。`);
  };

  const addImageAddress = (event) => {
    event.preventDefault();
    if (processing.active || isFull) return;

    const nextAddress = address.trim();
    if (!/^(?:https?:\/\/|\/(?!\/))/i.test(nextAddress)) {
      setErrors(["图片地址仅支持 http(s):// 或 / 开头的站内路径。"]);
      setBatchStatus("");
      return;
    }
    if (!isSafeImageSource(nextAddress)) {
      setErrors(["图片地址格式无效，请检查后重试。"]);
      setBatchStatus("");
      return;
    }
    if (
      contentImages.some((image) => imageValueKey(image) === nextAddress)
    ) {
      setErrors(["该图片地址已经存在，未重复添加。"]);
      setBatchStatus("");
      return;
    }

    onChange([
      ...contentImages,
      normalizeImageAsset({ src: nextAddress, alt: "" })
    ]);
    setAddress("");
    setErrors([]);
    setBatchStatus("已将图片地址追加到内容图末尾。");
  };

  const handleFiles = async (event) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!selectedFiles.length || processing.active) return;

    const availableSlots =
      MAX_PROJECT_CONTENT_IMAGES - contentImages.length;
    if (availableSlots <= 0) {
      setErrors([`每个作品最多添加 ${MAX_PROJECT_CONTENT_IMAGES} 张内容图。`]);
      setBatchStatus("");
      return;
    }

    const files = selectedFiles.slice(0, availableSlots);
    const nextErrors =
      selectedFiles.length > files.length
        ? [
            `已达到 ${MAX_PROJECT_CONTENT_IMAGES} 张上限，本次只处理前 ${files.length} 张。`
          ]
        : [];
    let nextImages = [...contentImages];
    let addedCount = 0;
    const jobToken = jobTokenRef.current + 1;
    jobTokenRef.current = jobToken;

    setErrors([]);
    setBatchStatus("");
    setProcessing({ active: true, current: 1, total: files.length });

    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setProcessing({
          active: true,
          current: index + 1,
          total: files.length
        });

        try {
          const result = await uploadImageAsset(file, {
            alt: file.name.replace(/\.[^.]+$/, ""),
            mode: "auto"
          });
          if (
            !mountedRef.current ||
            jobTokenRef.current !== jobToken
          ) {
            return;
          }
          if (
            nextImages.some(
              (image) => imageValueKey(image) === imageValueKey(result.asset)
            )
          ) {
            nextErrors.push(`${file.name}：与已有内容图重复，已跳过。`);
            continue;
          }
          nextImages = [...nextImages, result.asset];
          addedCount += 1;
          onChange(nextImages);
        } catch (uploadError) {
          if (
            !mountedRef.current ||
            jobTokenRef.current !== jobToken
          ) {
            return;
          }
          nextErrors.push(`${file.name}：${errorMessage(uploadError)}`);
        }
      }
    } catch (uploadError) {
      nextErrors.push(errorMessage(uploadError));
    } finally {
      if (mountedRef.current && jobTokenRef.current === jobToken) {
        setProcessing({ active: false, current: 0, total: 0 });
        setErrors(nextErrors);
        setBatchStatus(
          addedCount > 0
            ? `已按选择顺序添加 ${addedCount} 张内容图。`
            : "本次没有添加内容图。"
        );
      }
    }
  };

  return (
    <fieldset className="editor-image-field editor-content-images-field">
      <legend>作品内容图</legend>
      <div className="editor-content-images-head">
        <div>
          <strong>内容图顺序</strong>
          <small>
            {contentImages.length}/{MAX_PROJECT_CONTENT_IMAGES}
          </small>
        </div>
        <span>第 1 张自动作为封面</span>
      </div>

      {contentImages.length > 0 ? (
        <ol className="editor-content-images-list">
          {contentImages.map((image, index) => {
            const imageSource = getImageSource(
              image,
              index === 0 ? "cover" : "detail"
            );
            const safeImage = isSafeImageSource(imageSource);

            return (
              <li
                className={`editor-content-image-item ${
                  index === 0 ? "is-cover" : ""
                }`}
                key={`${imageValueKey(image) || "missing"}-${index}`}
              >
                <div className="editor-content-image-thumb">
                  {safeImage ? (
                    <img
                      alt={`作品内容图 ${index + 1} 预览`}
                      referrerPolicy="no-referrer"
                      src={imageSource}
                    />
                  ) : (
                    <span>内容图不可用</span>
                  )}
                  <b>{String(index + 1).padStart(2, "0")}</b>
                </div>
                <div className="editor-content-image-info">
                  <strong>
                    {index === 0 ? "第 1 张 · 网站封面" : `内容图 ${index + 1}`}
                  </strong>
                  <small>
                    {index === 0
                      ? "网站作品列表自动显示此图"
                      : "按当前顺序展示"}
                  </small>
                </div>
                <div
                  aria-label={`调整第 ${index + 1} 张内容图`}
                  className="editor-content-image-actions"
                >
                  <button
                    aria-label={`上移第 ${index + 1} 张内容图`}
                    disabled={processing.active || index === 0}
                    onClick={() => moveImage(index, -1)}
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`下移第 ${index + 1} 张内容图`}
                    disabled={
                      processing.active || index === contentImages.length - 1
                    }
                    onClick={() => moveImage(index, 1)}
                    type="button"
                  >
                    ↓
                  </button>
                  <button
                    aria-label={`删除第 ${index + 1} 张内容图`}
                    className="danger"
                    disabled={processing.active}
                    onClick={() => removeImage(index)}
                    type="button"
                  >
                    删除
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="editor-content-images-empty">
          <strong>还没有作品内容图</strong>
          <span>添加后，第 1 张自动作为网站封面。</span>
        </div>
      )}

      <div className="editor-image-actions editor-content-images-upload">
        <label
          aria-disabled={processing.active || isFull}
          className={`editor-upload-button ${
            processing.active || isFull ? "is-disabled" : ""
          }`}
          htmlFor={fileId}
        >
          {processing.active
            ? `正在处理 ${processing.current}/${processing.total}…`
            : isFull
              ? "已达到内容图上限"
              : "一次选择多张内容图"}
        </label>
        <input
          accept="image/*"
          aria-describedby={hintId}
          disabled={processing.active || isFull}
          id={fileId}
          multiple
          onChange={handleFiles}
          type="file"
        />
      </div>
      <small className="editor-field-hint" id={hintId}>
        最多 {MAX_PROJECT_CONTENT_IMAGES} 张、单张源文件不超过 100MB。系统按选择顺序逐张生成封面图和高清详情图；
        原图与网页图保存在 E:\本地编辑器存图，不占浏览器空间。
      </small>
      <form
        className="editor-content-images-address"
        onSubmit={addImageAddress}
      >
        <label htmlFor={addressId}>添加图片地址</label>
        <div>
          <input
            disabled={processing.active || isFull}
            id={addressId}
            maxLength={2000}
            onChange={(event) => {
              setAddress(event.target.value);
              setErrors([]);
            }}
            placeholder="https://… 或 /assets/…"
            type="text"
            value={address}
          />
          <button
            disabled={
              processing.active || isFull || address.trim().length === 0
            }
            type="submit"
          >
            添加地址
          </button>
        </div>
        <small>支持 http(s):// 图片地址或 /assets/ 等站内路径。</small>
      </form>
      {batchStatus && (
        <p className="editor-content-images-status" role="status">
          {batchStatus}
        </p>
      )}
      {errors.length > 0 && (
        <div className="editor-inline-error" role="alert">
          <strong>部分图片未能添加：</strong>
          <ul>
            {errors.map((message, index) => (
              <li key={`${message}-${index}`}>{message}</li>
            ))}
          </ul>
        </div>
      )}
    </fieldset>
  );
}

function SectionHeader({ eyebrow, title, description }) {
  return (
    <header className="editor-section-head">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}

export default function PortfolioEditor() {
  const [config, setConfig] = useState(getDefaultPortfolioConfig);
  const [ready, setReady] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [previewMode, setPreviewMode] = useState("desktop");
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0);
  const [selectedFilterId, setSelectedFilterId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [timelineStatus, setTimelineStatus] = useState("");
  const [workStatus, setWorkStatus] = useState("");
  const [saveStatus, setSaveStatus] = useState({
    kind: "idle",
    text: "正在读取本地配置…"
  });
  const [storageStatus, setStorageStatus] = useState({
    available: false,
    readOnly: true,
    loading: true
  });
  const [legacyConfigAvailable, setLegacyConfigAvailable] = useState(true);
  const [cleanupStatus, setCleanupStatus] = useState("");
  const iframeRef = useRef(null);
  const importInputRef = useRef(null);
  const autosaveTimerRef = useRef(null);
  const lastSavedJsonRef = useRef("");
  const saveQueueRef = useRef(Promise.resolve());
  const saveSequenceRef = useRef(0);
  const storageWritable =
    storageStatus.available === true && storageStatus.readOnly !== true;
  const workFilters = useMemo(
    () => (Array.isArray(config.workFilters) ? config.workFilters : []),
    [config.workFilters]
  );
  const selectedFilter = useMemo(
    () =>
      workFilters.find((filter) => filter.id === selectedFilterId) ?? null,
    [selectedFilterId, workFilters]
  );
  const selectedFilterIndex = selectedFilter
    ? workFilters.findIndex((filter) => filter.id === selectedFilter.id)
    : -1;

  const refreshStorageStatus = useCallback(async () => {
    try {
      const response = await fetch(LOCAL_EDITOR_STATUS_API, {
        cache: "no-store"
      });
      const payload = await readJsonResponse(
        response,
        "无法读取 E 盘图片库状态。"
      );
      const nextStatus = {
        ...payload,
        available: payload?.available === true,
        readOnly: payload?.readOnly !== false,
        loading: false
      };
      setStorageStatus(nextStatus);
      return nextStatus;
    } catch (statusError) {
      const nextStatus = {
        available: false,
        readOnly: true,
        loading: false,
        error: errorMessage(statusError, "本地文件服务不可用。")
      };
      setStorageStatus(nextStatus);
      return nextStatus;
    }
  }, []);

  const persistConfig = useCallback(
    (candidate, { label = "正在保存到本地项目…" } = {}) => {
      const normalized = normalizePortfolioConfig({
        ...candidate,
        version: 2
      });
      const serialized = JSON.stringify(normalized);
      const sequence = saveSequenceRef.current + 1;
      saveSequenceRef.current = sequence;
      setSaveStatus({ kind: "saving", text: label });

      const operation = saveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          const response = await fetch(LOCAL_EDITOR_CONFIG_API, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: serialized
          });
          const payload = await readJsonResponse(
            response,
            "配置写入项目文件失败。"
          );

          lastSavedJsonRef.current = serialized;
          savePortfolioConfig(normalized);
          iframeRef.current?.contentWindow?.postMessage(
            { type: PORTFOLIO_PREVIEW_MESSAGE, config: normalized },
            window.location.origin
          );
          setStorageStatus((current) => ({
            ...current,
            available: true,
            readOnly: false,
            lastSavedAt: payload?.savedAt ?? new Date().toISOString()
          }));

          if (sequence === saveSequenceRef.current) {
            const savedAt = new Date(
              payload?.savedAt || Date.now()
            ).toLocaleTimeString("zh-CN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit"
            });
            setSaveStatus({
              kind: "saved",
              text: `已保存到本地项目 · ${savedAt}`
            });
          }

          return payload;
        })
        .catch((saveError) => {
          if (sequence === saveSequenceRef.current) {
            setSaveStatus({
              kind: "error",
              text: `保存失败：${errorMessage(
                saveError,
                "请检查 E 盘和本地文件服务。"
              )}`
            });
          }
          throw saveError;
        });

      saveQueueRef.current = operation;
      return operation;
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      const status = await refreshStorageStatus();
      let loadedConfig = loadPortfolioConfig();

      try {
        const response = await fetch(LOCAL_EDITOR_CONFIG_API, {
          cache: "no-store"
        });
        const payload = await readJsonResponse(
          response,
          "无法读取项目配置文件。"
        );
        loadedConfig = normalizePortfolioConfig(payload?.config ?? payload);
      } catch (loadError) {
        if (status.available) {
          setSaveStatus({
            kind: "error",
            text: `配置读取失败：${errorMessage(loadError)}`
          });
        }
      }

      if (cancelled) return;
      const serialized = JSON.stringify(loadedConfig);
      lastSavedJsonRef.current = serialized;
      setConfig(loadedConfig);
      setSelectedFilterId(loadedConfig.workFilters?.[0]?.id ?? "");
      if (window.innerWidth <= 820) setPreviewMode("mobile");
      setReady(true);

      iframeRef.current?.contentWindow?.postMessage(
        { type: PORTFOLIO_PREVIEW_MESSAGE, config: loadedConfig },
        window.location.origin
      );

      if (!status.available || status.readOnly) {
        setSaveStatus({
          kind: "error",
          text:
            status.error ||
            "E 盘图片库不可写，编辑器已进入只读模式。"
        });
      } else {
        const savedAt = status.lastSavedAt
          ? new Date(status.lastSavedAt).toLocaleString("zh-CN")
          : "";
        setSaveStatus({
          kind: "saved",
          text: savedAt
            ? `已读取本地项目 · 上次保存 ${savedAt}`
            : "已读取本地项目，可开始编辑。"
        });
      }
    };

    initialize();
    return () => {
      cancelled = true;
    };
  }, [refreshStorageStatus]);

  useEffect(() => {
    setSelectedFilterId((current) =>
      workFilters.some((filter) => filter.id === current)
        ? current
        : (workFilters[0]?.id ?? "")
    );
  }, [workFilters]);

  useEffect(() => {
    if (!ready) return undefined;
    const serialized = JSON.stringify(normalizePortfolioConfig(config));
    if (serialized === lastSavedJsonRef.current) return undefined;

    if (!storageWritable) {
      setSaveStatus({
        kind: "error",
        text: "存在未保存修改：E 盘图片库不可写。"
      });
      return undefined;
    }

    setSaveStatus({ kind: "saving", text: "检测到修改，等待自动保存…" });
    autosaveTimerRef.current = window.setTimeout(() => {
      persistConfig(config).catch(() => undefined);
    }, 600);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [config, persistConfig, ready, storageWritable]);

  const updatePath = useCallback((path, value) => {
    setConfig((current) => {
      const next = clone(current);
      let pointer = next;

      path.slice(0, -1).forEach((key) => {
        pointer = pointer[key];
      });
      pointer[path.at(-1)] = value;

      return next;
    });
  }, []);

  const updateGroup = useCallback((groupIndex, key, value) => {
    setConfig((current) => {
      const next = clone(current);
      next.workGroups[groupIndex][key] = value;
      return next;
    });
  }, []);

  const updateProject = useCallback(
    (groupIndex, projectIndex, key, value) => {
      setConfig((current) => {
        const next = clone(current);
        next.workGroups[groupIndex].projects[projectIndex][key] = value;
        return next;
      });
    },
    []
  );

  const addTimelineItem = () => {
    const timeline = config.siteContent.profile.timeline;
    if (timeline.length >= MAX_TIMELINE_ITEMS) {
      setTimelineStatus(`个人经历最多可添加 ${MAX_TIMELINE_ITEMS} 条。`);
      return;
    }

    const nextItem = {
      id: createTimelineId(timeline),
      period: "",
      company: "",
      role: "",
      description: ""
    };

    setConfig((current) => {
      const next = clone(current);
      next.siteContent.profile.timeline.push(nextItem);
      return next;
    });
    setTimelineStatus(
      `已新增经历 ${timeline.length + 1}，请填写时间、项目和职责。`
    );
    window.requestAnimationFrame(() => {
      document
        .querySelector(
          `.editor-resume-card[data-timeline-id="${nextItem.id}"] input`
        )
        ?.focus();
    });
  };

  const deleteTimelineItem = (item, index) => {
    const itemName = item.company.trim() || `经历 ${index + 1}`;
    if (
      !window.confirm(
        `确定删除“${itemName}”吗？该条经历的时间、职责和说明会一并移除，此操作无法撤销。`
      )
    ) {
      return;
    }

    setConfig((current) => {
      const next = clone(current);
      next.siteContent.profile.timeline = next.siteContent.profile.timeline.filter(
        (timelineItem) => timelineItem.id !== item.id
      );
      return next;
    });
    setTimelineStatus(`已删除“${itemName}”。`);
    window.requestAnimationFrame(() => {
      document.querySelector(".editor-timeline-add")?.focus();
    });
  };

  const addProject = () => {
    const group = config.workGroups[selectedGroupIndex];
    if (!group || group.projects.length >= MAX_PROJECTS_PER_GROUP) {
      setWorkStatus(`每个分组最多可添加 ${MAX_PROJECTS_PER_GROUP} 个作品。`);
      return;
    }

    const nextIndex = group.projects.length;
    const nextProject = {
      id: createProjectId(group.projects, group.id),
      title: `新作品 ${nextIndex + 1}`,
      label: "",
      artwork: "brand",
      word: "NEW",
      code: String(nextIndex + 1).padStart(2, "0"),
      accent: "#71dce5",
      contentImages: [],
      visible: true
    };

    setConfig((current) => {
      const next = clone(current);
      next.workGroups[selectedGroupIndex].projects.push(nextProject);
      return next;
    });
    setSelectedProjectIndex(nextIndex);
    setWorkStatus(`已新增“${nextProject.title}”，可立即编辑并添加内容图。`);
    window.requestAnimationFrame(() => {
      document.querySelector(".editor-project-card input")?.focus();
    });
  };

  const deleteProject = () => {
    const group = config.workGroups[selectedGroupIndex];
    const project = group?.projects?.[selectedProjectIndex];
    if (!group || !project) return;

    const projectName = project.title.trim() || `作品 ${selectedProjectIndex + 1}`;
    if (
      !window.confirm(
        `确定删除“${projectName}”吗？该作品的文字和内容图引用会从本地项目中移除，此操作无法撤销。`
      )
    ) {
      return;
    }

    const remainingCount = group.projects.length - 1;
    const nextSelectedIndex =
      remainingCount > 0
        ? Math.min(selectedProjectIndex, remainingCount - 1)
        : 0;

    setConfig((current) => {
      const next = clone(current);
      next.workGroups[selectedGroupIndex].projects.splice(selectedProjectIndex, 1);
      return next;
    });
    setSelectedProjectIndex(nextSelectedIndex);
    setWorkStatus(
      remainingCount > 0
        ? `已删除“${projectName}”，当前分组剩余 ${remainingCount} 个作品。`
        : `已删除“${projectName}”，当前分组暂时没有作品。`
    );
    window.requestAnimationFrame(() => {
      const target =
        document.querySelector(
          '.editor-project-picker button[aria-pressed="true"]'
        ) ?? document.querySelector(".editor-project-add");
      target?.focus();
    });
  };

  const updateWorkFilter = useCallback((filterId, key, value) => {
    setConfig((current) => {
      const filterIndex = current.workFilters.findIndex(
        (filter) => filter.id === filterId
      );
      if (filterIndex < 0) return current;

      const next = clone(current);
      next.workFilters[filterIndex][key] = value;
      return next;
    });
  }, []);

  const updateFilterGroup = useCallback((filterId, groupId, checked) => {
    setConfig((current) => {
      const filterIndex = current.workFilters.findIndex(
        (filter) => filter.id === filterId
      );
      if (filterIndex < 0) return current;

      const filter = current.workFilters[filterIndex];
      const groupIds = Array.isArray(filter.groupIds) ? filter.groupIds : [];

      if (checked && groupIds.includes(groupId)) return current;
      if (!checked && (!groupIds.includes(groupId) || groupIds.length <= 1)) {
        return current;
      }

      const next = clone(current);
      next.workFilters[filterIndex].groupIds = checked
        ? [...groupIds, groupId]
        : groupIds.filter((id) => id !== groupId);
      return next;
    });
  }, []);

  const addWorkFilter = () => {
    if (workFilters.length >= MAX_WORK_FILTERS) {
      setFilterStatus(`最多可添加 ${MAX_WORK_FILTERS} 个导航项。`);
      return;
    }

    const groupIds = config.workGroups.map((group) => group.id);
    if (!groupIds.length) {
      setFilterStatus("当前没有可关联的作品分组，无法新增导航。");
      return;
    }

    const id = createWorkFilterId(workFilters);
    const nextFilter = {
      id,
      label: `新导航 ${workFilters.length + 1}`,
      groupIds,
      visible: true
    };

    setConfig((current) =>
      current.workFilters.length >= MAX_WORK_FILTERS
        ? current
        : {
            ...current,
            workFilters: [...current.workFilters, nextFilter]
          }
    );
    setSelectedFilterId(id);
    setFilterStatus(`已新增“${nextFilter.label}”，并关联全部作品分组。`);
  };

  const deleteWorkFilter = (filter) => {
    const deletedIndex = workFilters.findIndex((item) => item.id === filter.id);
    const label = workFilterDisplayLabel(filter, deletedIndex);
    if (
      !window.confirm(
        `确定删除导航“${label}”吗？只会删除这个导航项，作品分组和作品内容都会保留。`
      )
    ) {
      return;
    }

    const remainingFilters = workFilters.filter((item) => item.id !== filter.id);
    const fallbackId =
      remainingFilters[Math.min(deletedIndex, remainingFilters.length - 1)]?.id ??
      "";

    setConfig((current) => ({
      ...current,
      workFilters: current.workFilters.filter((item) => item.id !== filter.id)
    }));
    setSelectedFilterId((current) =>
      current === filter.id ||
      !remainingFilters.some((item) => item.id === current)
        ? fallbackId
        : current
    );
    setFilterStatus(`已删除导航“${label}”，作品内容未受影响。`);
    window.requestAnimationFrame(() => {
      const target =
        document.querySelector(
          '.editor-filter-picker button[aria-pressed="true"]'
        ) ?? document.querySelector(".editor-filter-add");
      target?.focus();
    });
  };

  const moveWorkFilter = (filterId, direction) => {
    const currentIndex = workFilters.findIndex(
      (filter) => filter.id === filterId
    );
    const nextIndex = currentIndex + direction;
    if (
      currentIndex < 0 ||
      nextIndex < 0 ||
      nextIndex >= workFilters.length
    ) {
      return;
    }

    setConfig((current) => {
      const filters = [...current.workFilters];
      const index = filters.findIndex((filter) => filter.id === filterId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= filters.length) {
        return current;
      }

      const [movedFilter] = filters.splice(index, 1);
      filters.splice(targetIndex, 0, movedFilter);
      return { ...current, workFilters: filters };
    });
    setSelectedFilterId(filterId);
    setFilterStatus(
      `已将“${workFilterDisplayLabel(
        selectedFilter,
        selectedFilterIndex
      )}”${
        direction < 0 ? "上移" : "下移"
      }。`
    );
  };

  const configBytes = useMemo(() => portfolioConfigSize(config), [config]);
  const contrast = useMemo(
    () => contrastRatio(config.theme.text, config.theme.background),
    [config.theme.background, config.theme.text]
  );
  const typographyIsDefault = useMemo(
    () => JSON.stringify(config.typography) === JSON.stringify(typographyDefaults),
    [config.typography]
  );
  const selectedGroup =
    config.workGroups[selectedGroupIndex] ?? config.workGroups[0];
  const selectedProject =
    selectedGroup?.projects?.[selectedProjectIndex] ?? null;
  const driveUsedPercent =
    storageStatus.totalBytes > 0
      ? Math.min(
          100,
          Math.max(
            0,
            ((storageStatus.totalBytes - storageStatus.freeBytes) /
              storageStatus.totalBytes) *
              100
          )
        )
      : 0;

  const saveNow = async () => {
    if (!storageWritable) {
      setSaveStatus({
        kind: "error",
        text: "无法保存：E 盘图片库或本地文件服务不可写。"
      });
      return;
    }

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    try {
      await persistConfig(config, { label: "正在立即保存到本地项目…" });
      await refreshStorageStatus();
    } catch {
      // persistConfig already exposes the actionable error.
    }
  };

  const migrateLegacyConfig = async () => {
    const legacyConfig = loadLegacyPortfolioConfig();
    if (!legacyConfig) {
      setLegacyConfigAvailable(false);
      setSaveStatus({
        kind: "idle",
        text: "当前浏览器没有可迁移的旧版编辑内容。"
      });
      return;
    }
    if (
      !window.confirm(
        "迁移会用旧浏览器内容替换当前编辑内容，并把其中的内嵌图片写入 E 盘。旧浏览器数据会保留，是否继续？"
      )
    ) {
      return;
    }

    try {
      const result = await migrateInlineImages(
        legacyConfig,
        (current, total) => {
          setSaveStatus({
            kind: "saving",
            text: `正在迁移旧版图片 ${current}/${total}…`
          });
        }
      );
      setConfig(result.config);
      setSelectedGroupIndex(0);
      setSelectedProjectIndex(0);
      setSelectedFilterId(result.config.workFilters?.[0]?.id ?? "");
      await persistConfig(result.config, {
        label: "正在保存迁移后的本地项目…"
      });
      setLegacyConfigAvailable(false);
      setSaveStatus({
        kind: "saved",
        text: `迁移完成：已写入 ${result.migratedCount} 张内嵌图片；旧浏览器数据仍保留。`
      });
      await refreshStorageStatus();
    } catch (migrationError) {
      setSaveStatus({
        kind: "error",
        text: `迁移失败：${errorMessage(migrationError)}`
      });
    }
  };

  const cleanupUnusedAssets = async () => {
    if (!storageWritable) {
      setCleanupStatus("无法清理：E 盘图片库不可写。");
      return;
    }

    setCleanupStatus("正在检查未使用的网页图…");
    try {
      await persistConfig(config, { label: "清理前正在保存配置…" });
      const previewResponse = await fetch(LOCAL_EDITOR_CLEANUP_API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dryRun: true })
      });
      const preview = await readJsonResponse(
        previewResponse,
        "无法检查未使用网页图。"
      );

      if (!preview?.unreferencedCount) {
        setCleanupStatus("没有未使用的网页图，不需要清理。");
        return;
      }

      const confirmed = window.confirm(
        `发现 ${preview.unreferencedCount} 个未使用文件，共 ${formatBytes(
          preview.unreferencedBytes || 0
        )}。继续后会移动到 E 盘回收站，不会永久删除。是否继续？`
      );
      if (!confirmed) {
        setCleanupStatus("已取消清理，未移动任何文件。");
        return;
      }

      const applyResponse = await fetch(LOCAL_EDITOR_CLEANUP_API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dryRun: false,
          previewToken: preview.previewToken
        })
      });
      const result = await readJsonResponse(
        applyResponse,
        "未使用网页图移动失败。"
      );
      setCleanupStatus(
        `已将 ${result?.movedCount || 0} 个文件（${formatBytes(
          result?.movedBytes || 0
        )}）移入 E 盘回收站。`
      );
      await refreshStorageStatus();
    } catch (cleanupError) {
      setCleanupStatus(`清理失败：${errorMessage(cleanupError)}`);
    }
  };

  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `portfolio-config-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importConfig = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_CONFIG_IMPORT_BYTES) {
      setSaveStatus({
        kind: "error",
        text: "导入失败：配置文件超过 150MB。"
      });
      return;
    }
    if (!window.confirm("导入会替换当前本地项目中的编辑内容，是否继续？")) {
      return;
    }

    try {
      const incoming = JSON.parse(await file.text());
      if (
        !incoming ||
        typeof incoming !== "object" ||
        Array.isArray(incoming) ||
        !incoming.siteContent ||
        !Array.isArray(incoming.workGroups)
      ) {
        throw new Error("文件缺少作品集配置结构。");
      }
      const result = await migrateInlineImages(
        incoming,
        (current, total) => {
          setSaveStatus({
            kind: "saving",
            text: `正在导入并迁移内嵌图片 ${current}/${total}…`
          });
        }
      );
      const normalizedConfig = result.config;
      setConfig(normalizedConfig);
      setSelectedGroupIndex(0);
      setSelectedProjectIndex(0);
      setSelectedFilterId(normalizedConfig.workFilters?.[0]?.id ?? "");
      setFilterStatus("");
      setTimelineStatus("");
      setWorkStatus("");
      await persistConfig(normalizedConfig, {
        label: "配置已导入，正在保存到本地项目…"
      });
      setSaveStatus({
        kind: "saved",
        text:
          result.migratedCount > 0
            ? `导入完成，并迁移 ${result.migratedCount} 张内嵌图片。`
            : "配置导入并保存完成。"
      });
      await refreshStorageStatus();
    } catch (importError) {
      setSaveStatus({
        kind: "error",
        text: `导入失败：${errorMessage(
          importError,
          "文件不是有效的作品集配置。"
        )}`
      });
    }
  };

  const resetConfig = () => {
    if (
      !window.confirm(
        "确定恢复默认内容吗？当前本地项目中的修改会被替换，建议先导出备份。"
      )
    ) {
      return;
    }

    const defaultConfig = getStarterPortfolioConfig();
    setConfig(defaultConfig);
    setSelectedGroupIndex(0);
    setSelectedProjectIndex(0);
    setSelectedFilterId(defaultConfig.workFilters?.[0]?.id ?? "");
    setFilterStatus("");
    setTimelineStatus("");
    setWorkStatus("");
    setSaveStatus({
      kind: "saving",
      text: "已恢复默认内容，等待自动保存…"
    });
  };

  const resetTypography = () => {
    if (typographyIsDefault) return;
    if (
      !window.confirm(
        "仅恢复排版设置，内容、颜色和图片不会改变。是否继续？"
      )
    ) {
      return;
    }

    setConfig((current) => ({
      ...current,
      typography: clone(typographyDefaults)
    }));
    setSaveStatus({
      kind: "saving",
      text: "已恢复默认排版，等待自动保存…"
    });
  };

  const renderHome = () => (
    <>
      <SectionHeader
        description="修改品牌名称、首屏英文标题、定位文案和主视觉。"
        eyebrow="01 / Home"
        title="首页内容"
      />
      <TextControl
        label="网站名称"
        maxLength={80}
        onChange={(value) => updatePath(["siteContent", "brand"], value)}
        value={config.siteContent.brand}
      />
      <TextControl
        label="职业定位"
        maxLength={160}
        onChange={(value) => updatePath(["siteContent", "role"], value)}
        value={config.siteContent.role}
      />
      <fieldset className="editor-fieldset">
        <legend>首屏英文标题</legend>
        {config.siteContent.heroLines.map((line, index) => (
          <TextControl
            key={index}
            label={`第 ${index + 1} 行`}
            maxLength={60}
            onChange={(value) =>
              updatePath(["siteContent", "heroLines", index], value)
            }
            value={line}
          />
        ))}
      </fieldset>
      <fieldset className="editor-fieldset">
        <legend>首屏中文标题</legend>
        {config.siteContent.heroStatementPhrases.map((line, index) => (
          <TextControl
            key={index}
            label={`第 ${index + 1} 行`}
            maxLength={120}
            onChange={(value) =>
              updatePath(["siteContent", "heroStatementPhrases", index], value)
            }
            value={line}
          />
        ))}
      </fieldset>
      <TextControl
        label="首屏说明"
        maxLength={1200}
        multiline
        onChange={(value) =>
          updatePath(["siteContent", "heroDescription"], value)
        }
        rows={5}
        value={config.siteContent.heroDescription}
      />
      <ImageControl
        hint="上传后会替换默认制冰机视觉。优先使用横向图片，建议 16:9。"
        label="首屏背景图"
        onChange={(value) => updatePath(["siteContent", "heroImage"], value)}
        value={config.siteContent.heroImage}
      />
    </>
  );

  const renderProfile = () => (
    <>
      <SectionHeader
        description="修改人物图片、个人定位、介绍标题和两段简介。"
        eyebrow="02 / Profile"
        title="个人介绍"
      />
      <ImageControl
        hint="优先使用 4:5 竖图；原图和网页图保存到 E 盘图片库。"
        label="人物图片"
        onChange={(value) =>
          updatePath(["siteContent", "profile", "portraitImage"], value)
        }
        value={config.siteContent.profile.portraitImage}
      />
      <TextControl
        label="人物卡职位"
        maxLength={100}
        onChange={(value) =>
          updatePath(["siteContent", "profile", "captionTitle"], value)
        }
        value={config.siteContent.profile.captionTitle}
      />
      <TextControl
        label="人物卡能力标签"
        maxLength={240}
        onChange={(value) =>
          updatePath(["siteContent", "profile", "captionText"], value)
        }
        value={config.siteContent.profile.captionText}
      />
      <fieldset className="editor-fieldset">
        <legend>个人介绍标题</legend>
        {config.siteContent.profile.titlePhrases.map((line, index) => (
          <TextControl
            key={index}
            label={`短句 ${index + 1}`}
            maxLength={120}
            onChange={(value) =>
              updatePath(
                ["siteContent", "profile", "titlePhrases", index],
                value
              )
            }
            value={line}
          />
        ))}
      </fieldset>
      {config.siteContent.profile.paragraphs.map((paragraph, index) => (
        <TextControl
          key={index}
          label={`简介第 ${index + 1} 段`}
          maxLength={500}
          multiline
          onChange={(value) =>
            updatePath(["siteContent", "profile", "paragraphs", index], value)
          }
          rows={5}
          value={paragraph}
        />
      ))}
    </>
  );

  const renderResume = () => (
    <>
      <SectionHeader
        description="个人经历可自由增减，能力数据保留 4 个可编辑槽位。"
        eyebrow="03 / Resume"
        title="经历与数据"
      />
      <div className="editor-timeline-toolbar">
        <div>
          <span>个人经历</span>
          <strong>{config.siteContent.profile.timeline.length} 条</strong>
        </div>
        <button
          className="editor-timeline-add"
          disabled={
            config.siteContent.profile.timeline.length >= MAX_TIMELINE_ITEMS
          }
          onClick={addTimelineItem}
          title={
            config.siteContent.profile.timeline.length >= MAX_TIMELINE_ITEMS
              ? `最多可添加 ${MAX_TIMELINE_ITEMS} 条经历`
              : "新增一条个人经历"
          }
          type="button"
        >
          ＋ 新增经历
        </button>
      </div>
      <p
        aria-live="polite"
        className="editor-timeline-feedback"
        role="status"
      >
        {timelineStatus}
      </p>
      {config.siteContent.profile.timeline.length > 0 ? (
        config.siteContent.profile.timeline.map((item, index) => (
          <fieldset
            className="editor-fieldset editor-resume-card"
            data-timeline-id={item.id}
            key={item.id}
          >
          <legend>经历 {index + 1}</legend>
          <div className="editor-resume-card-actions">
            <button
              aria-label={`删除经历 ${index + 1}${
                item.company.trim() ? `：${item.company.trim()}` : ""
              }`}
              onClick={() => deleteTimelineItem(item, index)}
              type="button"
            >
              － 删除这条经历
            </button>
          </div>
          <TextControl
            label="时间"
            maxLength={80}
            onChange={(value) =>
              updatePath(
                ["siteContent", "profile", "timeline", index, "period"],
                value
              )
            }
            value={item.period}
          />
          <TextControl
            label="公司或项目"
            maxLength={120}
            onChange={(value) =>
              updatePath(
                ["siteContent", "profile", "timeline", index, "company"],
                value
              )
            }
            value={item.company}
          />
          <TextControl
            label="职位或职责"
            maxLength={160}
            onChange={(value) =>
              updatePath(
                ["siteContent", "profile", "timeline", index, "role"],
                value
              )
            }
            value={item.role}
          />
          <TextControl
            label="说明"
            maxLength={500}
            multiline
            onChange={(value) =>
              updatePath(
                ["siteContent", "profile", "timeline", index, "description"],
                value
              )
            }
            value={item.description}
          />
        </fieldset>
        ))
      ) : (
        <div className="editor-timeline-empty">
          <strong>暂无个人经历</strong>
          <p>点击“新增经历”即可添加第一条，前台不会显示空白时间轴。</p>
        </div>
      )}
      <div className="editor-stats-grid">
        {config.siteContent.profile.stats.map((item, index) => (
          <fieldset className="editor-fieldset" key={index}>
            <legend>数据 {index + 1}</legend>
            <TextControl
              label="数值"
              maxLength={20}
              onChange={(value) =>
                updatePath(
                  ["siteContent", "profile", "stats", index, "value"],
                  value
                )
              }
              value={item.value}
            />
            <TextControl
              label="说明"
              maxLength={80}
              onChange={(value) =>
                updatePath(
                  ["siteContent", "profile", "stats", index, "label"],
                  value
                )
              }
              value={item.label}
            />
          </fieldset>
        ))}
      </div>
    </>
  );

  const renderWorks = () => (
    <>
      <SectionHeader
        description="管理作品筛选导航、分组信息、内容图和文案，或关闭不需要展示的项目。"
        eyebrow="04 / Selected Works"
        title="作品管理"
      />
      <fieldset className="editor-fieldset editor-filter-manager">
        <legend>筛选导航</legend>
        <div className="editor-filter-toolbar">
          <div>
            <strong>导航项</strong>
            <small>
              {workFilters.length}/{MAX_WORK_FILTERS}
            </small>
          </div>
          <button
            aria-label="新增筛选导航"
            className="editor-filter-add"
            disabled={
              workFilters.length >= MAX_WORK_FILTERS ||
              config.workGroups.length === 0
            }
            onClick={addWorkFilter}
            title={
              workFilters.length >= MAX_WORK_FILTERS
                ? `最多可添加 ${MAX_WORK_FILTERS} 个导航项`
                : config.workGroups.length === 0
                  ? "当前没有可关联的作品分组"
                  : "新增筛选导航"
            }
            type="button"
          >
            ＋ 新增导航
          </button>
        </div>
        <p className="editor-filter-intro">
          导航项可以关联一个或多个作品分组。隐藏或删除导航不会删除任何作品内容。
        </p>

        {workFilters.length > 0 ? (
          <>
            <div
              aria-label="选择要编辑的筛选导航"
              className="editor-filter-picker"
            >
              {workFilters.map((filter, index) => {
                const filterLabel = workFilterDisplayLabel(filter, index);

                return (
                  <button
                    aria-pressed={selectedFilterId === filter.id}
                    className={`${selectedFilterId === filter.id ? "active" : ""}${
                      filter.visible === false ? " is-hidden" : ""
                    }`}
                    key={filter.id}
                    onClick={() => {
                      setSelectedFilterId(filter.id);
                      setFilterStatus("");
                    }}
                    type="button"
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{filterLabel}</strong>
                    <small>
                      {filter.visible === false ? "已隐藏" : "显示中"} ·{" "}
                      {filter.groupIds.length} 个分组
                    </small>
                  </button>
                );
              })}
            </div>

            {selectedFilter && (
              <div className="editor-filter-detail">
                <TextControl
                  hint="显示在作品区顶部的筛选按钮中，最多 24 个字符。"
                  label="导航名称"
                  maxLength={24}
                  onChange={(value) =>
                    updateWorkFilter(selectedFilter.id, "label", value)
                  }
                  value={selectedFilter.label}
                />
                <label className="editor-toggle editor-filter-visibility">
                  <input
                    checked={selectedFilter.visible !== false}
                    onChange={(event) =>
                      updateWorkFilter(
                        selectedFilter.id,
                        "visible",
                        event.target.checked
                      )
                    }
                    type="checkbox"
                  />
                  <span>
                    <strong>在网站导航中显示</strong>
                    <small>
                      关闭后仅隐藏这个导航按钮，关联分组及作品内容仍会保留。
                    </small>
                  </span>
                </label>

                <fieldset
                  aria-describedby="editor-filter-group-help"
                  className="editor-filter-groups"
                >
                  <legend>关联作品分组</legend>
                  <p
                    className="editor-filter-group-help"
                    id="editor-filter-group-help"
                  >
                    至少选择一个分组；同一导航可以汇总多个分组。
                  </p>
                  <div className="editor-filter-group-list">
                    {config.workGroups.map((group) => {
                      const isChecked =
                        selectedFilter.groupIds.includes(group.id);
                      const isLastChecked =
                        isChecked && selectedFilter.groupIds.length <= 1;

                      return (
                        <label
                          className="editor-filter-group-option"
                          key={group.id}
                        >
                          <input
                            checked={isChecked}
                            disabled={isLastChecked}
                            onChange={(event) =>
                              updateFilterGroup(
                                selectedFilter.id,
                                group.id,
                                event.target.checked
                              )
                            }
                            type="checkbox"
                          />
                          <span>
                            <strong>{group.title}</strong>
                            <small>
                              {isLastChecked
                                ? "至少保留此分组"
                                : group.typeLabel}
                            </small>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="editor-filter-actions">
                  <button
                    aria-label={`上移导航“${workFilterDisplayLabel(
                      selectedFilter,
                      selectedFilterIndex
                    )}”`}
                    disabled={selectedFilterIndex <= 0}
                    onClick={() => moveWorkFilter(selectedFilter.id, -1)}
                    type="button"
                  >
                    ↑ 上移
                  </button>
                  <button
                    aria-label={`下移导航“${workFilterDisplayLabel(
                      selectedFilter,
                      selectedFilterIndex
                    )}”`}
                    disabled={
                      selectedFilterIndex < 0 ||
                      selectedFilterIndex >= workFilters.length - 1
                    }
                    onClick={() => moveWorkFilter(selectedFilter.id, 1)}
                    type="button"
                  >
                    ↓ 下移
                  </button>
                  <button
                    aria-label={`删除导航“${workFilterDisplayLabel(
                      selectedFilter,
                      selectedFilterIndex
                    )}”`}
                    className="danger"
                    onClick={() => deleteWorkFilter(selectedFilter)}
                    type="button"
                  >
                    删除导航
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="editor-filter-empty">
            <strong>暂无筛选导航</strong>
            <p>
              网站会直接显示作品列表。点击“新增导航”即可重新创建筛选入口。
            </p>
          </div>
        )}

        <p
          aria-live="polite"
          className="editor-filter-feedback"
          role="status"
        >
          {filterStatus}
        </p>
      </fieldset>
      <div className="editor-segmented wide" aria-label="作品分组">
        {config.workGroups.map((group, index) => (
          <button
            aria-pressed={selectedGroupIndex === index}
            className={selectedGroupIndex === index ? "active" : ""}
            key={group.id}
            onClick={() => {
              setSelectedGroupIndex(index);
              setSelectedProjectIndex(0);
            }}
            type="button"
          >
            {group.title}
          </button>
        ))}
      </div>
      <fieldset className="editor-fieldset">
        <legend>分组信息</legend>
        <TextControl
          label="分组标题"
          maxLength={100}
          onChange={(value) =>
            updateGroup(selectedGroupIndex, "title", value)
          }
          value={selectedGroup.title}
        />
        <TextControl
          label="英文类型"
          maxLength={40}
          onChange={(value) =>
            updateGroup(selectedGroupIndex, "typeLabel", value)
          }
          value={selectedGroup.typeLabel}
        />
      </fieldset>
      <div className="editor-project-toolbar">
        <div>
          <span>当前分组</span>
          <strong>{selectedGroup.projects.length} 个作品</strong>
        </div>
        <button
          className="editor-project-add"
          disabled={selectedGroup.projects.length >= MAX_PROJECTS_PER_GROUP}
          onClick={addProject}
          title={
            selectedGroup.projects.length >= MAX_PROJECTS_PER_GROUP
              ? `每个分组最多 ${MAX_PROJECTS_PER_GROUP} 个作品`
              : "在当前分组新增一个作品"
          }
          type="button"
        >
          ＋ 新增作品
        </button>
        <button
          className="danger"
          disabled={!selectedProject}
          onClick={deleteProject}
          type="button"
        >
          － 删除当前作品
        </button>
      </div>
      {selectedGroup.projects.length > 0 ? (
        <div className="editor-project-picker" aria-label="选择作品">
          {selectedGroup.projects.map((project, index) => (
            <button
              aria-pressed={selectedProjectIndex === index}
              className={selectedProjectIndex === index ? "active" : ""}
              key={project.id}
              onClick={() => {
                setSelectedProjectIndex(index);
                setWorkStatus("");
              }}
              type="button"
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {project.title || "未命名项目"}
              {project.visible === false && <small>已隐藏</small>}
            </button>
          ))}
        </div>
      ) : (
        <div className="editor-project-empty">
          <strong>当前分组暂无作品</strong>
          <p>点击“新增作品”即可添加第一项，保存后网站会自动更新作品数量。</p>
        </div>
      )}
      <p
        aria-live="polite"
        className="editor-project-feedback"
        role="status"
      >
        {workStatus}
      </p>
      {selectedProject && (
        <fieldset className="editor-fieldset editor-project-card">
          <legend>作品 {selectedProjectIndex + 1}</legend>
        <label className="editor-toggle">
          <input
            checked={selectedProject.visible !== false}
            onChange={(event) =>
              updateProject(
                selectedGroupIndex,
                selectedProjectIndex,
                "visible",
                event.target.checked
              )
            }
            type="checkbox"
          />
          <span>
            <strong>在网站中展示</strong>
            <small>关闭后该项目不会出现在首页，但编辑内容会保留。</small>
          </span>
        </label>
        <TextControl
          label="项目名称"
          maxLength={120}
          onChange={(value) =>
            updateProject(
              selectedGroupIndex,
              selectedProjectIndex,
              "title",
              value
            )
          }
          value={selectedProject.title}
        />
        <TextControl
          label="项目标签"
          maxLength={180}
          onChange={(value) =>
            updateProject(
              selectedGroupIndex,
              selectedProjectIndex,
              "label",
              value
            )
          }
          value={selectedProject.label}
        />
        <TextControl
          hint="封面上的大号英文关键词。"
          label="封面关键词"
          maxLength={24}
          onChange={(value) =>
            updateProject(
              selectedGroupIndex,
              selectedProjectIndex,
              "word",
              value
            )
          }
          value={selectedProject.word}
        />
        <ColorControl
          label="项目强调色"
          onChange={(value) =>
            updateProject(
              selectedGroupIndex,
              selectedProjectIndex,
              "accent",
              value
            )
          }
          value={selectedProject.accent}
        />
        <ProjectContentImagesControl
          images={selectedProject.contentImages}
          key={`${selectedGroup.id}:${selectedProject.id}`}
          onChange={(value) =>
            updateProject(
              selectedGroupIndex,
              selectedProjectIndex,
              "contentImages",
              value
            )
          }
        />
        </fieldset>
      )}
    </>
  );

  const renderContact = () => (
    <>
      <SectionHeader
        description="修改联系区标题、邮箱、微信号和可接项目状态。"
        eyebrow="05 / Contact"
        title="联系信息"
      />
      <fieldset className="editor-fieldset">
        <legend>联系区标题</legend>
        {config.siteContent.contact.titlePhrases.map((line, index) => (
          <TextControl
            key={index}
            label={`短句 ${index + 1}`}
            maxLength={120}
            onChange={(value) =>
              updatePath(
                ["siteContent", "contact", "titlePhrases", index],
                value
              )
            }
            value={line}
          />
        ))}
      </fieldset>
      <TextControl
        label="邮箱"
        maxLength={160}
        onChange={(value) =>
          updatePath(["siteContent", "contact", "email"], value)
        }
        type="email"
        value={config.siteContent.contact.email}
      />
      <TextControl
        label="微信号"
        maxLength={100}
        onChange={(value) =>
          updatePath(["siteContent", "contact", "wechat"], value)
        }
        value={config.siteContent.contact.wechat}
      />
      <TextControl
        label="项目状态"
        maxLength={160}
        onChange={(value) =>
          updatePath(["siteContent", "contact", "availability"], value)
        }
        value={config.siteContent.contact.availability}
      />
    </>
  );

  const renderTypography = () => (
    <>
      <SectionHeader
        description="调整主要文字层级的字号、字间距和行距，桌面端与手机端可分别设置。"
        eyebrow="06 / Typography"
        title="文字排版"
      />
      {typographyGroups.map((group) => {
        const values = config.typography[group.id];
        const defaults = typographyDefaults[group.id];
        const limits = typographyLimits[group.id];

        return (
          <fieldset
            className="editor-fieldset editor-typography-group"
            key={group.id}
          >
            <legend>{group.title}</legend>
            <p className="editor-typography-description">{group.description}</p>
            <RangeControl
              defaultValue={defaults.desktopSize}
              hint={
                group.id === "heroTitle" || group.id === "sectionTitle"
                  ? "桌面端会在此字号以内随屏幕宽度等比例缩放。"
                  : undefined
              }
              label="桌面字号"
              max={limits.desktopSize.max}
              min={limits.desktopSize.min}
              onChange={(value) =>
                updatePath(["typography", group.id, "desktopSize"], value)
              }
              step={limits.desktopSize.step}
              unit="px"
              value={values.desktopSize}
            />
            <RangeControl
              defaultValue={defaults.mobileSize}
              hint={
                group.id === "workTitle"
                  ? "手机作品卡会使用该字号，极窄屏仍会自动限制。"
                  : group.id === "body"
                    ? "手机预览会使用该字号。"
                    : "手机预览会使用该字号，极窄屏仍会自动限制。"
              }
              label={group.id === "body" ? "手机字号" : "手机最大字号"}
              max={limits.mobileSize.max}
              min={limits.mobileSize.min}
              onChange={(value) =>
                updatePath(["typography", group.id, "mobileSize"], value)
              }
              step={limits.mobileSize.step}
              unit="px"
              value={values.mobileSize}
            />
            <RangeControl
              decimals={3}
              defaultValue={defaults.letterSpacing}
              hint="负值让文字更紧凑，正值让文字更疏朗。"
              label="字间距"
              max={limits.letterSpacing.max}
              min={limits.letterSpacing.min}
              onChange={(value) =>
                updatePath(["typography", group.id, "letterSpacing"], value)
              }
              step={limits.letterSpacing.step}
              unit="em"
              value={values.letterSpacing}
            />
            <RangeControl
              decimals={2}
              defaultValue={defaults.lineHeight}
              hint="数值越大，行与行之间越松。"
              label="行距"
              max={limits.lineHeight.max}
              min={limits.lineHeight.min}
              onChange={(value) =>
                updatePath(["typography", group.id, "lineHeight"], value)
              }
              step={limits.lineHeight.step}
              unit=""
              value={values.lineHeight}
            />
          </fieldset>
        );
      })}
      <div className="editor-typography-actions">
        <button
          disabled={typographyIsDefault}
          onClick={resetTypography}
          type="button"
        >
          恢复排版默认值
        </button>
        <small>只恢复字号、字间距和行距，不影响文字内容、颜色或图片。</small>
      </div>
    </>
  );

  const renderTheme = () => (
    <>
      <SectionHeader
        description="修改基础色彩，并管理项目配置与 E 盘图片库。"
        eyebrow="07 / Theme & Backup"
        title="主题与备份"
      />
      <div className="editor-color-grid">
        <ColorControl
          label="页面背景"
          onChange={(value) => updatePath(["theme", "background"], value)}
          value={config.theme.background}
        />
        <ColorControl
          label="正文颜色"
          onChange={(value) => updatePath(["theme", "text"], value)}
          value={config.theme.text}
        />
        <ColorControl
          label="主强调色"
          onChange={(value) => updatePath(["theme", "cyan"], value)}
          value={config.theme.cyan}
        />
        <ColorControl
          label="辅助强调色"
          onChange={(value) => updatePath(["theme", "gold"], value)}
          value={config.theme.gold}
        />
      </div>
      <div
        className={`editor-contrast ${
          contrast >= 4.5 ? "is-pass" : "is-warning"
        }`}
      >
        <span>正文与背景对比度</span>
        <strong>{contrast.toFixed(2)} : 1</strong>
        <p>
          {contrast >= 4.5
            ? "符合普通正文的可读性建议。"
            : "低于 4.5:1，建议提高正文与背景的明暗差。"}
        </p>
      </div>
      <section className="editor-backup">
        <h3>E 盘图片库与项目配置</h3>
        <div className="editor-storage-meter">
          <span
            style={{
              width: `${driveUsedPercent}%`
            }}
          />
        </div>
        <p>
          {storageStatus.available
            ? `${storageStatus.root || "E:\\本地编辑器存图"} · 剩余 ${formatBytes(
                storageStatus.freeBytes || 0
              )} · 图片库 ${formatBytes(
                storageStatus.libraryBytes || 0
              )} · ${storageStatus.assetCount || 0} 组资源`
            : "E 盘图片库当前不可用，编辑器不会回退到浏览器存储。"}
        </p>
        <p>
          当前配置 {formatBytes(configBytes)}。配置只保存图片路径，原图不会写入
          JSON 或发布包。
        </p>
        <div className="editor-backup-actions">
          <button disabled={!storageWritable} onClick={saveNow} type="button">
            立即保存
          </button>
          <button onClick={exportConfig} type="button">
            导出配置
          </button>
          <button onClick={() => importInputRef.current?.click()} type="button">
            导入配置
          </button>
          <button className="danger" onClick={resetConfig} type="button">
            恢复默认
          </button>
        </div>
        <div className="editor-backup-actions">
          {legacyConfigAvailable && (
            <button onClick={migrateLegacyConfig} type="button">
              迁移旧浏览器内容
            </button>
          )}
          <button
            disabled={!storageWritable}
            onClick={cleanupUnusedAssets}
            type="button"
          >
            清理未使用网页图
          </button>
          <button onClick={refreshStorageStatus} type="button">
            刷新容量
          </button>
        </div>
        {legacyConfigAvailable && (
          <p>
            如果以前使用过浏览器版编辑器，可手动迁移；旧数据不会自动读取或删除。
          </p>
        )}
        {cleanupStatus && (
          <p aria-live="polite" role="status">
            {cleanupStatus}
          </p>
        )}
        <input
          accept="application/json,.json"
          hidden
          onChange={importConfig}
          ref={importInputRef}
          type="file"
        />
      </section>
    </>
  );

  const renderActiveSection = () => {
    if (activeSection === "profile") return renderProfile();
    if (activeSection === "resume") return renderResume();
    if (activeSection === "works") return renderWorks();
    if (activeSection === "contact") return renderContact();
    if (activeSection === "typography") return renderTypography();
    if (activeSection === "theme") return renderTheme();
    return renderHome();
  };

  return (
    <main className="editor-app">
      <aside className="editor-sidebar">
        <header className="editor-brand">
          <div>
            <span>Local visual editor</span>
            <h1>作品集编辑器</h1>
          </div>
          <span className="editor-local-badge">仅本机</span>
        </header>

        <div className="editor-local-note">
          {storageWritable
            ? `配置自动保存到项目，图片保存到 ${
                storageStatus.root || "E:\\本地编辑器存图"
              }，右侧同步预览；线上版本需另行发布。`
            : storageStatus.loading
              ? "正在连接 E 盘本地文件服务…"
              : `只读模式：${
                  storageStatus.error ||
                  "E 盘图片库不可用或不可写，请恢复磁盘后刷新状态。"
                }`}
          <div className="editor-backup-actions">
            <button
              disabled={!storageWritable}
              onClick={saveNow}
              type="button"
            >
              立即保存
            </button>
            <button onClick={refreshStorageStatus} type="button">
              刷新存储状态
            </button>
          </div>
        </div>

        <nav aria-label="编辑器分区" className="editor-nav">
          {editorSections.map((section) => (
            <button
              aria-current={activeSection === section.id ? "page" : undefined}
              className={activeSection === section.id ? "active" : ""}
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              type="button"
            >
              <span>{section.index}</span>
              {section.label}
            </button>
          ))}
        </nav>

        <section className="editor-controls">
          <fieldset
            disabled={!storageWritable}
            style={{
              border: 0,
              margin: 0,
              minInlineSize: 0,
              padding: 0
            }}
          >
            {renderActiveSection()}
          </fieldset>
        </section>

        <footer className="editor-status-bar">
          <span
            aria-live="polite"
            className={`editor-save-status ${saveStatus.kind}`}
            role="status"
          >
            {saveStatus.text}
          </span>
          <span>
            配置 {formatBytes(configBytes)}
            {storageStatus.available
              ? ` · 图片 ${formatBytes(storageStatus.libraryBytes || 0)}`
              : ""}
          </span>
        </footer>
      </aside>

      <section aria-label="网站实时预览" className="editor-preview-panel">
        <header className="editor-preview-toolbar">
          <div>
            <span>Live preview</span>
            <strong>实时预览</strong>
          </div>
          <div className="editor-preview-actions">
            <div className="editor-segmented" aria-label="预览设备">
              <button
                aria-pressed={previewMode === "desktop"}
                className={previewMode === "desktop" ? "active" : ""}
                onClick={() => setPreviewMode("desktop")}
                type="button"
              >
                桌面预览
              </button>
              <button
                aria-pressed={previewMode === "mobile"}
                className={previewMode === "mobile" ? "active" : ""}
                onClick={() => setPreviewMode("mobile")}
                type="button"
              >
                手机预览
              </button>
            </div>
            <button
              className="editor-refresh"
              onClick={() => {
                if (iframeRef.current) {
                  iframeRef.current.src = "/?editorPreview=1";
                }
              }}
              type="button"
            >
              刷新
            </button>
            <a href="/" rel="noreferrer" target="_blank">
              独立打开
            </a>
          </div>
        </header>
        <div className={`editor-frame-stage is-${previewMode}`}>
          <div className="editor-device-frame">
            <iframe
              onLoad={() => {
                if (!ready) return;
                iframeRef.current?.contentWindow?.postMessage(
                  { type: PORTFOLIO_PREVIEW_MESSAGE, config },
                  window.location.origin
                );
              }}
              ref={iframeRef}
              src="/?editorPreview=1"
              title="作品集网站实时预览"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
