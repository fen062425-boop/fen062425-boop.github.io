import { siteContent, workGroups } from "../data/portfolio.js";

export const PORTFOLIO_STORAGE_KEY = "visual-portfolio-config-v1";
export const PORTFOLIO_UPDATE_EVENT = "visual-portfolio-config-updated";
export const PORTFOLIO_PREVIEW_MESSAGE = "visual-portfolio-preview-sync";

const defaultTheme = {
  background: "#050607",
  text: "#edf4f8",
  cyan: "#71dce5",
  gold: "#bda66b"
};

export const defaultPortfolioConfig = {
  version: 1,
  theme: defaultTheme,
  siteContent,
  workGroups
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

export function isSafeImageSource(value) {
  if (value == null || value === "") return true;
  if (typeof value !== "string") return false;

  return (
    /^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(value) ||
    /^https?:\/\//i.test(value) ||
    /^\/(?!\/)/.test(value)
  );
}

function imageValue(value, fallback = "") {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string" || !isSafeImageSource(value)) return fallback;
  if (/^data:/i.test(value) && value.length > 1600000) return fallback;
  if (!/^data:/i.test(value) && value.length > 2000) return fallback;

  return value;
}

function normalizeTimeline(candidate, fallback) {
  if (!Array.isArray(candidate)) return clone(fallback);

  return fallback.map((item, index) => {
    const incoming = candidate[index] ?? {};

    return {
      period: stringValue(incoming.period, item.period, 80),
      company: stringValue(incoming.company, item.company, 120),
      role: stringValue(incoming.role, item.role, 160),
      description: stringValue(incoming.description, item.description, 500)
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

function normalizeProjects(candidateGroups) {
  return workGroups.map((defaultGroup) => {
    const incomingGroup = Array.isArray(candidateGroups)
      ? candidateGroups.find((group) => group?.id === defaultGroup.id)
      : null;

    return {
      ...defaultGroup,
      title: stringValue(incomingGroup?.title, defaultGroup.title, 100),
      typeLabel: stringValue(incomingGroup?.typeLabel, defaultGroup.typeLabel, 40),
      projects: defaultGroup.projects.map((defaultProject) => {
        const incomingProject = incomingGroup?.projects?.find(
          (project) => project?.id === defaultProject.id
        );

        return {
          ...defaultProject,
          title: stringValue(incomingProject?.title, defaultProject.title, 120),
          label: stringValue(incomingProject?.label, defaultProject.label, 180),
          word: stringValue(incomingProject?.word, defaultProject.word, 24),
          accent: hexColor(incomingProject?.accent, defaultProject.accent),
          image: imageValue(incomingProject?.image),
          visible: incomingProject?.visible !== false
        };
      })
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

  return {
    version: 1,
    theme: {
      background: hexColor(incomingTheme.background, defaultTheme.background),
      text: hexColor(incomingTheme.text, defaultTheme.text),
      cyan: hexColor(incomingTheme.cyan, defaultTheme.cyan),
      gold: hexColor(incomingTheme.gold, defaultTheme.gold)
    },
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
      heroImage: imageValue(incomingSite.heroImage),
      profile: {
        ...siteContent.profile,
        portraitImage: imageValue(incomingProfile.portraitImage),
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
    workGroups: normalizeProjects(incoming.workGroups)
  };
}

export function getDefaultPortfolioConfig() {
  return normalizePortfolioConfig(defaultPortfolioConfig);
}

export function loadPortfolioConfig() {
  if (typeof window === "undefined") return getDefaultPortfolioConfig();

  try {
    const stored = window.localStorage.getItem(PORTFOLIO_STORAGE_KEY);
    return stored
      ? normalizePortfolioConfig(JSON.parse(stored))
      : getDefaultPortfolioConfig();
  } catch {
    return getDefaultPortfolioConfig();
  }
}

export function savePortfolioConfig(config) {
  const normalized = normalizePortfolioConfig(config);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      PORTFOLIO_STORAGE_KEY,
      JSON.stringify(normalized)
    );
    window.dispatchEvent(
      new CustomEvent(PORTFOLIO_UPDATE_EVENT, { detail: normalized })
    );
  }

  return normalized;
}

export function portfolioConfigSize(config) {
  return new TextEncoder().encode(JSON.stringify(config)).length;
}
