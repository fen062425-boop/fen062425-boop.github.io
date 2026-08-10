import { siteContent, workFilters, workGroups } from "../data/portfolio.js";
import publishedPortfolioConfig from "../data/portfolio-config.json";

export const PORTFOLIO_STORAGE_KEY = "visual-portfolio-config-v1";
export const PORTFOLIO_UPDATE_EVENT = "visual-portfolio-config-updated";
export const PORTFOLIO_PREVIEW_MESSAGE = "visual-portfolio-preview-sync";
export const MAX_IMAGE_UPLOAD_DATA_LENGTH = 1_200_000;
export const MAX_INLINE_IMAGE_DATA_LENGTH = 140_000_000;
export const MAX_PORTFOLIO_CONFIG_BYTES = 5_000_000;
export const MAX_PROJECT_CONTENT_IMAGES = 12;
export const MAX_PROJECTS_PER_GROUP = 50;
export const MAX_TIMELINE_ITEMS = 20;
export const MAX_WORK_FILTERS = 12;
export const MAX_WORK_GROUPS = 12;

const PUBLIC_BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(
  /\/$/,
  ""
);

function withPublicBasePath(source) {
  if (
    !PUBLIC_BASE_PATH ||
    !source ||
    !/^\/(?!\/)/.test(source) ||
    source === PUBLIC_BASE_PATH ||
    source.startsWith(`${PUBLIC_BASE_PATH}/`)
  ) {
    return source;
  }

  return `${PUBLIC_BASE_PATH}${source}`;
}

const defaultTheme = {
  background: "#050607",
  text: "#edf4f8",
  cyan: "#71dce5",
  gold: "#bda66b"
};

export const typographyDefaults = {
  heroTitle: {
    desktopSize: 160,
    mobileSize: 58,
    letterSpacing: -0.065,
    lineHeight: 0.84
  },
  sectionTitle: {
    desktopSize: 86,
    mobileSize: 42,
    letterSpacing: -0.045,
    lineHeight: 1.03
  },
  body: {
    desktopSize: 18,
    mobileSize: 14,
    letterSpacing: 0,
    lineHeight: 1.9
  },
  workTitle: {
    desktopSize: 24,
    mobileSize: 21,
    letterSpacing: 0,
    lineHeight: 1.15
  }
};

export const typographyLimits = {
  heroTitle: {
    desktopSize: { min: 64, max: 200, step: 1 },
    mobileSize: { min: 38, max: 72, step: 1 },
    letterSpacing: { min: -0.12, max: 0.08, step: 0.005 },
    lineHeight: { min: 0.72, max: 1.25, step: 0.01 }
  },
  sectionTitle: {
    desktopSize: { min: 36, max: 112, step: 1 },
    mobileSize: { min: 28, max: 60, step: 1 },
    letterSpacing: { min: -0.08, max: 0.08, step: 0.005 },
    lineHeight: { min: 0.85, max: 1.5, step: 0.01 }
  },
  body: {
    desktopSize: { min: 13, max: 24, step: 1 },
    mobileSize: { min: 12, max: 19, step: 1 },
    letterSpacing: { min: -0.02, max: 0.08, step: 0.005 },
    lineHeight: { min: 1.2, max: 2.2, step: 0.05 }
  },
  workTitle: {
    desktopSize: { min: 16, max: 36, step: 1 },
    mobileSize: { min: 15, max: 30, step: 1 },
    letterSpacing: { min: -0.04, max: 0.08, step: 0.005 },
    lineHeight: { min: 0.9, max: 1.6, step: 0.01 }
  }
};

const publishedConfig =
  publishedPortfolioConfig &&
  typeof publishedPortfolioConfig === "object" &&
  !Array.isArray(publishedPortfolioConfig)
    ? publishedPortfolioConfig
    : {};

const starterPortfolioConfig = {
  version: 2,
  theme: defaultTheme,
  typography: typographyDefaults,
  siteContent,
  workFilters,
  workGroups
};

export const defaultPortfolioConfig = {
  version: 2,
  theme: publishedConfig.theme ?? defaultTheme,
  typography: publishedConfig.typography ?? typographyDefaults,
  siteContent: publishedConfig.siteContent ?? siteContent,
  workFilters: publishedConfig.workFilters ?? workFilters,
  workGroups: publishedConfig.workGroups ?? workGroups
};

function clone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function stringValue(value, fallback, maxLength = 2000) {
  return typeof value === "string" ? value.slice(0, maxLength) : fallback;
}

function stringList(value, fallback) {
  if (!Array.isArray(value)) return [...fallback];

  return fallback.map((item, index) => stringValue(value[index], item, 500));
}

function hexColor(value, fallback) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : fallback;
}

function numericValue(value, fallback, limits) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;

  const clamped = Math.min(limits.max, Math.max(limits.min, value));
  const quantized =
    Math.round((clamped - limits.min) / limits.step) * limits.step + limits.min;

  return Number(quantized.toFixed(3));
}

function normalizeTypographyRole(candidate, fallback, limits) {
  const incoming = candidate && typeof candidate === "object" ? candidate : {};

  return {
    desktopSize: numericValue(
      incoming.desktopSize,
      fallback.desktopSize,
      limits.desktopSize
    ),
    mobileSize: numericValue(
      incoming.mobileSize,
      fallback.mobileSize,
      limits.mobileSize
    ),
    letterSpacing: numericValue(
      incoming.letterSpacing,
      fallback.letterSpacing,
      limits.letterSpacing
    ),
    lineHeight: numericValue(
      incoming.lineHeight,
      fallback.lineHeight,
      limits.lineHeight
    )
  };
}

function normalizeTypography(candidate) {
  const incoming = candidate && typeof candidate === "object" ? candidate : {};

  return {
    heroTitle: normalizeTypographyRole(
      incoming.heroTitle,
      typographyDefaults.heroTitle,
      typographyLimits.heroTitle
    ),
    sectionTitle: normalizeTypographyRole(
      incoming.sectionTitle,
      typographyDefaults.sectionTitle,
      typographyLimits.sectionTitle
    ),
    body: normalizeTypographyRole(
      incoming.body,
      typographyDefaults.body,
      typographyLimits.body
    ),
    workTitle: normalizeTypographyRole(
      incoming.workTitle,
      typographyDefaults.workTitle,
      typographyLimits.workTitle
    )
  };
}

export function isSafeImageSource(value) {
  if (value == null || value === "") return true;
  if (typeof value !== "string") return false;

  return (
    /^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(value) ||
    /^https?:\/\//i.test(value) ||
    /^\/(?!\/)/.test(value)
  );
}

function safeImageSource(value, fallback = "") {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string" || !isSafeImageSource(value)) return fallback;
  if (/^data:/i.test(value) && value.length > MAX_INLINE_IMAGE_DATA_LENGTH) {
    return fallback;
  }
  if (!/^data:/i.test(value) && value.length > 2000) return fallback;

  return value;
}

function imageAssetId(value, source) {
  const rawValue = typeof value === "string" ? value.trim().toLowerCase() : "";
  const sanitized = rawValue
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  if (sanitized) return sanitized;

  const managedPathMatch = source.match(
    /\/assets\/portfolio\/([a-f0-9]{16,64})-(?:detail|cover)\.webp(?:[?#].*)?$/i
  );
  if (managedPathMatch) return managedPathMatch[1].toLowerCase();

  return "";
}

function imageDimension(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(100_000, Math.max(0, Math.round(value)));
}

export function normalizeImageAsset(value, fallback = null) {
  const incoming =
    typeof value === "string"
      ? { src: value }
      : value && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;

  if (!incoming) {
    if (fallback == null || fallback === "") return null;
    return normalizeImageAsset(fallback);
  }

  const fallbackAsset =
    fallback == null || fallback === ""
      ? null
      : typeof fallback === "object" && !Array.isArray(fallback)
        ? fallback
        : { src: fallback };
  const src = safeImageSource(incoming.src, safeImageSource(fallbackAsset?.src));

  if (!src) return null;

  const coverSrc = safeImageSource(
    incoming.coverSrc,
    safeImageSource(fallbackAsset?.coverSrc)
  );

  return {
    id: imageAssetId(incoming.id, src),
    src,
    coverSrc,
    width: imageDimension(incoming.width || fallbackAsset?.width),
    height: imageDimension(incoming.height || fallbackAsset?.height),
    alt: stringValue(incoming.alt, fallbackAsset?.alt ?? "", 240)
  };
}

export function getImageSource(value, variant = "detail") {
  if (typeof value === "string") {
    return withPublicBasePath(safeImageSource(value));
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";

  const src = safeImageSource(value.src);
  if (variant === "cover") {
    return withPublicBasePath(safeImageSource(value.coverSrc, src));
  }

  return withPublicBasePath(src);
}

export function getImageAlt(value, fallback = "") {
  return value && typeof value === "object" && !Array.isArray(value)
    ? stringValue(value.alt, fallback, 240)
    : fallback;
}

export function getImageDimensions(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { width: 0, height: 0 };
  }

  return {
    width: imageDimension(value.width),
    height: imageDimension(value.height)
  };
}

function normalizeContentImages(project) {
  const candidates = Array.isArray(project?.contentImages)
    ? project.contentImages
    : [project?.image, project?.detailImage];
  const images = [];
  const seen = new Set();

  for (const candidate of candidates) {
    const image = normalizeImageAsset(candidate);
    const source = getImageSource(image);
    if (!image || !source || seen.has(source)) continue;

    images.push(image);
    seen.add(source);
    if (images.length >= MAX_PROJECT_CONTENT_IMAGES) break;
  }

  return images;
}

function safeTimelineId(value, index, usedIds) {
  const rawValue = typeof value === "string" ? value.trim().toLowerCase() : "";
  const sanitized = rawValue
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  const baseId = sanitized || `timeline-${index + 1}`;
  let id = baseId;
  let suffix = 2;

  while (usedIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(id);
  return id;
}

function normalizeTimeline(candidate, fallback) {
  const source = Array.isArray(candidate) ? candidate : fallback;
  const usedIds = new Set();

  return source.slice(0, MAX_TIMELINE_ITEMS).map((item, index) => {
    const incoming = item && typeof item === "object" ? item : {};
    const defaultItem = fallback[index] ?? {};

    return {
      id: safeTimelineId(incoming.id, index, usedIds),
      period: stringValue(incoming.period, defaultItem.period ?? "", 80),
      company: stringValue(incoming.company, defaultItem.company ?? "", 120),
      role: stringValue(incoming.role, defaultItem.role ?? "", 160),
      description: stringValue(
        incoming.description,
        defaultItem.description ?? "",
        500
      )
    };
  });
}

function normalizeStats(candidate, fallback) {
  if (!Array.isArray(candidate)) return clone(fallback);

  return fallback.map((item, index) => {
    const incoming = candidate[index] ?? {};

    return {
      value: stringValue(incoming.value, item.value, 20),
      label: stringValue(incoming.label, item.label, 80)
    };
  });
}

function safeProjectId(value, index, groupId, usedIds) {
  const rawValue = typeof value === "string" ? value.trim().toLowerCase() : "";
  const sanitized = rawValue
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  const baseId = sanitized || `${groupId}-project-${index + 1}`;
  let id = baseId;
  let suffix = 2;

  while (usedIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(id);
  return id;
}

function safeGroupId(value, index, usedIds) {
  const rawValue = typeof value === "string" ? value.trim().toLowerCase() : "";
  const sanitized = rawValue
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const baseId = sanitized || `group-${index + 1}`;
  let id = baseId;
  let suffix = 2;

  while (usedIds.has(id)) {
    const suffixText = `-${suffix}`;
    id = `${baseId.slice(0, 48 - suffixText.length)}${suffixText}`;
    suffix += 1;
  }

  usedIds.add(id);
  return id;
}

function normalizeProjects(candidateGroups) {
  const sourceGroups =
    Array.isArray(candidateGroups) && candidateGroups.length > 0
      ? candidateGroups
      : workGroups;
  const usedGroupIds = new Set();

  return sourceGroups.slice(0, MAX_WORK_GROUPS).map((candidateGroup, groupIndex) => {
    const incomingGroup =
      candidateGroup && typeof candidateGroup === "object" ? candidateGroup : {};
    const matchedDefaultGroup = workGroups.find(
      (group) => group.id === incomingGroup.id
    );
    const defaultGroup = matchedDefaultGroup ?? {};
    const groupId = safeGroupId(incomingGroup.id, groupIndex, usedGroupIds);
    const sourceProjects = Array.isArray(incomingGroup?.projects)
      ? incomingGroup.projects
      : (matchedDefaultGroup?.projects ?? []);
    const usedProjectIds = new Set();

    return {
      id: groupId,
      index: String(groupIndex + 1).padStart(2, "0"),
      title: stringValue(
        incomingGroup.title,
        defaultGroup.title ?? `作品分组 ${groupIndex + 1}`,
        100
      ),
      typeLabel: stringValue(
        incomingGroup.typeLabel,
        defaultGroup.typeLabel ?? "Gallery",
        40
      ),
      projects: sourceProjects
        .slice(0, MAX_PROJECTS_PER_GROUP)
        .map((candidateProject, index) => {
          const incomingProject =
            candidateProject && typeof candidateProject === "object"
              ? candidateProject
              : {};
          const defaultProject =
            (defaultGroup.projects ?? []).find(
              (project) => project.id === incomingProject.id
            ) ?? {};
          const projectId = safeProjectId(
            incomingProject.id,
            index,
            groupId,
            usedProjectIds
          );
          const coverImage = normalizeImageAsset(
            incomingProject.coverImage,
            defaultProject.coverImage
          );

          return {
            id: projectId,
            title: stringValue(
              incomingProject.title,
              defaultProject.title ?? `新作品 ${index + 1}`,
              120
            ),
            label: stringValue(
              incomingProject.label,
              defaultProject.label ?? "",
              180
            ),
            artwork: stringValue(
              incomingProject.artwork,
              defaultProject.artwork ?? "brand",
              40
            ),
            word: stringValue(
              incomingProject.word,
              defaultProject.word ?? "NEW",
              24
            ),
            code: stringValue(
              incomingProject.code,
              defaultProject.code ?? String(index + 1).padStart(2, "0"),
              12
            ),
            accent: hexColor(
              incomingProject.accent,
              defaultProject.accent ?? defaultTheme.cyan
            ),
            ...(coverImage ? { coverImage } : {}),
            contentImages: normalizeContentImages(incomingProject),
            visible: incomingProject.visible !== false
          };
        })
    };
  });
}

function safeFilterId(value, index, usedIds) {
  const rawValue = typeof value === "string" ? value.trim().toLowerCase() : "";
  const sanitized = rawValue
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const baseId = sanitized || `filter-${index + 1}`;
  let id = baseId;
  let suffix = 2;

  while (usedIds.has(id)) {
    const suffixText = `-${suffix}`;
    id = `${baseId.slice(0, 40 - suffixText.length)}${suffixText}`;
    suffix += 1;
  }

  usedIds.add(id);
  return id;
}

function filterLabel(value, index) {
  const label = typeof value === "string" ? value.trim() : "";
  return (label || `分类 ${index + 1}`).slice(0, 24);
}

function normalizeWorkFilters(candidate, normalizedGroups) {
  const groupIds = normalizedGroups.map((group) => group.id);
  const validGroupIds = new Set(groupIds);

  if (!Array.isArray(candidate)) {
    return clone(workFilters);
  }

  const usedIds = new Set();

  return candidate.slice(0, MAX_WORK_FILTERS).map((filter, index) => {
    const incoming = filter && typeof filter === "object" ? filter : {};
    const id = safeFilterId(incoming.id, index, usedIds);
    const defaultFilter = workFilters.find(
      (item) => item.id === incoming.id || item.id === id
    );
    const incomingGroupIds = Array.isArray(incoming.groupIds)
      ? incoming.groupIds
          .filter((groupId) => typeof groupId === "string")
          .map((groupId) => groupId.trim())
          .filter(
            (groupId, groupIndex, values) =>
              validGroupIds.has(groupId) &&
              values.indexOf(groupId) === groupIndex
          )
      : [];
    const defaultGroupIds = (defaultFilter?.groupIds ?? groupIds).filter(
      (groupId) => validGroupIds.has(groupId)
    );

    return {
      id,
      label: filterLabel(incoming.label, index),
      groupIds:
        incomingGroupIds.length > 0
          ? incomingGroupIds
          : defaultGroupIds.length > 0
            ? defaultGroupIds
            : groupIds,
      visible: incoming.visible !== false
    };
  });
}

export function normalizePortfolioConfig(candidate) {
  const incoming = candidate && typeof candidate === "object" ? candidate : {};
  const incomingSite =
    incoming.siteContent && typeof incoming.siteContent === "object"
      ? incoming.siteContent
      : {};
  const incomingProfile =
    incomingSite.profile && typeof incomingSite.profile === "object"
      ? incomingSite.profile
      : {};
  const incomingContact =
    incomingSite.contact && typeof incomingSite.contact === "object"
      ? incomingSite.contact
      : {};
  const incomingTheme =
    incoming.theme && typeof incoming.theme === "object" ? incoming.theme : {};
  const normalizedWorkGroups = normalizeProjects(incoming.workGroups);

  return {
    version: 2,
    theme: {
      background: hexColor(incomingTheme.background, defaultTheme.background),
      text: hexColor(incomingTheme.text, defaultTheme.text),
      cyan: hexColor(incomingTheme.cyan, defaultTheme.cyan),
      gold: hexColor(incomingTheme.gold, defaultTheme.gold)
    },
    typography: normalizeTypography(incoming.typography),
    siteContent: {
      ...siteContent,
      brand: stringValue(incomingSite.brand, siteContent.brand, 80),
      role: stringValue(incomingSite.role, siteContent.role, 160),
      heroLines: stringList(incomingSite.heroLines, siteContent.heroLines),
      heroStatementPhrases: stringList(
        incomingSite.heroStatementPhrases,
        siteContent.heroStatementPhrases
      ),
      heroDescription: stringValue(
        incomingSite.heroDescription,
        siteContent.heroDescription,
        1200
      ),
      heroImage: normalizeImageAsset(incomingSite.heroImage),
      profile: {
        ...siteContent.profile,
        portraitImage: normalizeImageAsset(incomingProfile.portraitImage),
        captionTitle: stringValue(
          incomingProfile.captionTitle,
          siteContent.profile.captionTitle,
          100
        ),
        captionText: stringValue(
          incomingProfile.captionText,
          siteContent.profile.captionText,
          240
        ),
        titlePhrases: stringList(
          incomingProfile.titlePhrases,
          siteContent.profile.titlePhrases
        ),
        paragraphs: stringList(
          incomingProfile.paragraphs,
          siteContent.profile.paragraphs
        ),
        timeline: normalizeTimeline(
          incomingProfile.timeline,
          siteContent.profile.timeline
        ),
        stats: normalizeStats(incomingProfile.stats, siteContent.profile.stats)
      },
      contact: {
        ...siteContent.contact,
        titlePhrases: stringList(
          incomingContact.titlePhrases,
          siteContent.contact.titlePhrases
        ),
        email: stringValue(
          incomingContact.email,
          siteContent.contact.email,
          160
        ).replace(/[\r\n]/g, ""),
        wechat: stringValue(
          incomingContact.wechat,
          siteContent.contact.wechat,
          100
        ),
        availability: stringValue(
          incomingContact.availability,
          siteContent.contact.availability,
          160
        )
      }
    },
    workFilters: normalizeWorkFilters(incoming.workFilters, normalizedWorkGroups),
    workGroups: normalizedWorkGroups
  };
}

export function getDefaultPortfolioConfig() {
  return normalizePortfolioConfig(defaultPortfolioConfig);
}

export function getStarterPortfolioConfig() {
  return normalizePortfolioConfig(starterPortfolioConfig);
}

export function loadPortfolioConfig() {
  return getDefaultPortfolioConfig();
}

export function loadLegacyPortfolioConfig() {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(PORTFOLIO_STORAGE_KEY);
    return stored ? normalizePortfolioConfig(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
}

export function savePortfolioConfig(config) {
  const normalized = normalizePortfolioConfig(config);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(PORTFOLIO_UPDATE_EVENT, { detail: normalized })
    );
  }

  return normalized;
}

export function portfolioConfigSize(config) {
  return new TextEncoder().encode(JSON.stringify(config)).length;
}
