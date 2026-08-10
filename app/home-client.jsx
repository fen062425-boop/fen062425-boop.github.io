"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getImageAlt,
  getImageDimensions,
  getImageSource,
  getDefaultPortfolioConfig,
  loadPortfolioConfig,
  normalizePortfolioConfig,
  PORTFOLIO_PREVIEW_MESSAGE,
  PORTFOLIO_STORAGE_KEY,
  PORTFOLIO_UPDATE_EVENT
} from "../lib/portfolio-config";

const navItems = [
  { href: "#profile", label: "介绍" },
  { href: "#works", label: "作品" }
];

const COVER_SCROLL_THRESHOLD = 8;

function roundedCssNumber(value) {
  return Number(value.toFixed(3));
}

function interpolatedCssSize(startSize, endSize) {
  const slope = (endSize - startSize) / (1100 - 720);
  const viewportCoefficient = roundedCssNumber(Math.abs(slope * 100));
  const intercept = roundedCssNumber(startSize - slope * 720);
  const operator = slope >= 0 ? "+" : "-";

  return `calc(${intercept}px ${operator} ${viewportCoefficient}vw)`;
}

function getTypographyVariables(typography) {
  const heroDesktopScale = typography.heroTitle.desktopSize / 160;
  const sectionDesktopScale = typography.sectionTitle.desktopSize / 86;
  const heroSizeAt1100 = typography.heroTitle.desktopSize * (95.7 / 160);
  const sectionSizeAt1100 =
    typography.sectionTitle.desktopSize * (55 / 86);

  return {
    "--type-hero-min": `${roundedCssNumber(78 * heroDesktopScale)}px`,
    "--type-hero-fluid": `${roundedCssNumber(8.7 * heroDesktopScale)}vw`,
    "--type-hero-desktop": `${typography.heroTitle.desktopSize}px`,
    "--type-hero-mobile": `${typography.heroTitle.mobileSize}px`,
    "--type-hero-tablet": interpolatedCssSize(
      typography.heroTitle.mobileSize,
      heroSizeAt1100
    ),
    "--type-hero-spacing": `${typography.heroTitle.letterSpacing}em`,
    "--type-hero-leading": typography.heroTitle.lineHeight,
    "--type-section-min": `${roundedCssNumber(42 * sectionDesktopScale)}px`,
    "--type-section-fluid": `${roundedCssNumber(5 * sectionDesktopScale)}vw`,
    "--type-section-desktop": `${typography.sectionTitle.desktopSize}px`,
    "--type-section-mobile": `${typography.sectionTitle.mobileSize}px`,
    "--type-section-tablet": interpolatedCssSize(
      typography.sectionTitle.mobileSize,
      sectionSizeAt1100
    ),
    "--type-section-narrow": `${roundedCssNumber(
      typography.sectionTitle.mobileSize * (36 / 42)
    )}px`,
    "--type-section-spacing": `${typography.sectionTitle.letterSpacing}em`,
    "--type-section-leading": typography.sectionTitle.lineHeight,
    "--type-body-desktop": `${typography.body.desktopSize}px`,
    "--type-body-mobile": `${typography.body.mobileSize}px`,
    "--type-body-tablet": interpolatedCssSize(
      typography.body.mobileSize,
      typography.body.desktopSize
    ),
    "--type-body-spacing": `${typography.body.letterSpacing}em`,
    "--type-body-leading": typography.body.lineHeight,
    "--type-work-desktop": `${typography.workTitle.desktopSize}px`,
    "--type-work-mobile": `${typography.workTitle.mobileSize}px`,
    "--type-work-tablet": interpolatedCssSize(
      typography.workTitle.mobileSize,
      typography.workTitle.desktopSize
    ),
    "--type-work-spacing": `${typography.workTitle.letterSpacing}em`,
    "--type-work-leading": typography.workTitle.lineHeight
  };
}

function getProjectContentImages(project) {
  if (!Array.isArray(project.contentImages)) return [];

  return project.contentImages.filter((image) => getImageSource(image));
}

function WorkCoverImage({ accent, image }) {
  const frameRef = useRef(null);
  const imageRef = useRef(null);
  const [canScroll, setCanScroll] = useState(false);
  const src = getImageSource(image, "cover");
  const { width, height } = getImageDimensions(image);

  const measureCover = useCallback(() => {
    const frame = frameRef.current;
    const image = imageRef.current;

    if (
      !frame ||
      !image ||
      !image.complete ||
      image.naturalWidth <= 0 ||
      image.naturalHeight <= 0 ||
      frame.clientWidth <= 0 ||
      frame.clientHeight <= 0
    ) {
      setCanScroll(false);
      return;
    }

    const coverScale = Math.max(
      frame.clientWidth / image.naturalWidth,
      frame.clientHeight / image.naturalHeight
    );
    const scrollDistance = Math.max(
      0,
      image.naturalHeight * coverScale - frame.clientHeight
    );
    setCanScroll(scrollDistance > COVER_SCROLL_THRESHOLD);
  }, []);

  useEffect(() => {
    setCanScroll(false);

    const frame = frameRef.current;
    if (!frame) return undefined;

    measureCover();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureCover);
      return () => window.removeEventListener("resize", measureCover);
    }

    const observer = new ResizeObserver(measureCover);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [measureCover, src]);

  return (
    <div
      aria-hidden="true"
      className={`work-art work-art--image ${
        canScroll ? "can-scroll" : ""
      }`}
      data-cover-scroll={canScroll ? "true" : "false"}
      ref={frameRef}
      style={{ "--accent": accent }}
    >
      <img
        alt=""
        className="art-image"
        decoding="async"
        draggable="false"
        height={height || undefined}
        loading="lazy"
        onError={() => setCanScroll(false)}
        onLoad={measureCover}
        ref={imageRef}
        referrerPolicy="no-referrer"
        src={src}
        width={width || undefined}
      />
    </div>
  );
}

function WorkArtwork({ project }) {
  const coverImage = project.coverImage || getProjectContentImages(project)[0];

  if (coverImage) {
    return (
      <WorkCoverImage accent={project.accent} image={coverImage} />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`work-art work-art--${project.artwork}`}
      style={{ "--accent": project.accent }}
    >
      <div className="art-grid" />
      <div className="art-glow" />
      <div className="art-orbit art-orbit-one" />
      <div className="art-orbit art-orbit-two" />
      <div className="art-device">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="art-panel art-panel-one" />
      <div className="art-panel art-panel-two" />
      <span className="art-code">{project.code}</span>
      <strong className="art-word">{project.word}</strong>
      <span className="art-caption">Concept visual / replace with your work</span>
    </div>
  );
}

function WorkCard({ group, project, onOpen }) {
  const isVideo = group.id === "video";
  const isUiDetail = group.id === "ui-detail";
  const contentImages = getProjectContentImages(project);
  const hasContent = contentImages.length > 0;
  const CardElement = hasContent ? "button" : "article";

  return (
    <CardElement
      aria-label={
        hasContent
          ? `查看项目：${project.title}`
          : `项目：${project.title}，暂无详情内容`
      }
      className={`work-card ${isVideo ? "video-card" : "image-card"} ${
        group.id === "detail" ? "detail-card" : ""
      } ${isUiDetail ? "ui-detail-card" : ""} ${
        hasContent ? "" : "is-static"
      }`}
      onClick={
        hasContent
          ? () =>
              onOpen({
                ...project,
                contentImages,
                groupId: group.id,
                typeLabel: group.typeLabel
              })
          : undefined
      }
      style={{ "--accent": project.accent }}
      type={hasContent ? "button" : undefined}
    >
      <WorkArtwork project={project} />
      {isVideo && hasContent && (
        <span aria-hidden="true" className="play-badge">
          ▶
        </span>
      )}
      <span className="card-info">
        <span>
          {group.typeLabel} / {project.label}
        </span>
        <strong>{project.title}</strong>
      </span>
    </CardElement>
  );
}

function WorkGroup({ group, hidden, onOpen }) {
  return (
    <section
      aria-hidden={hidden}
      className={`work-group ${hidden ? "is-hidden" : ""}`}
      data-group={group.id}
    >
      <div className="group-title">
        <span>{group.index}</span>
        <h3>{group.title}</h3>
      </div>
      <div className={group.id === "video" ? "video-grid" : "image-grid"}>
        {group.projects
          .filter((project) => project.visible !== false)
          .map((project) => (
            <WorkCard
              group={group}
              key={project.id}
              onOpen={onOpen}
              project={project}
            />
          ))}
      </div>
    </section>
  );
}

function ProjectContentImage({ image, index, project }) {
  const src = getImageSource(image);
  const { width, height } = getImageDimensions(image);

  return (
    <img
      alt={getImageAlt(image, `${project.title}内容图 ${index + 1}`)}
      className="content-image"
      decoding="async"
      height={height || undefined}
      loading={index === 0 ? "eager" : "lazy"}
      referrerPolicy="no-referrer"
      src={src}
      width={width || undefined}
    />
  );
}

function ProjectLightbox({ project, onClose }) {
  const closeRef = useRef(null);
  const previewRef = useRef(null);
  const contentImages = getProjectContentImages(project);
  const isUiDetail = project.groupId === "ui-detail";

  useEffect(() => {
    closeRef.current?.focus();

    const handleKeydown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        event.preventDefault();
        const closeButton = closeRef.current;
        const contentPreview = previewRef.current;

        if (!contentPreview) {
          closeButton?.focus();
          return;
        }

        if (document.activeElement === closeButton) {
          contentPreview.focus();
        } else {
          closeButton?.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [onClose]);

  return (
    <div
      aria-label={`${project.title}作品详情`}
      aria-modal="true"
      className="lightbox is-open"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
    >
      <button
        aria-label="关闭项目预览"
        className="lightbox-close"
        onClick={onClose}
        ref={closeRef}
        type="button"
      >
        ×
      </button>

      <div
        aria-label={`${project.title}内容图片，可上下滚动浏览`}
        className={`lightbox-body content-image-view ${
          isUiDetail ? "content-image-view--ui-detail" : ""
        }`}
        ref={previewRef}
        tabIndex={0}
      >
        {contentImages.map((image, index) => (
          <ProjectContentImage
            image={image}
            index={index}
            key={`${project.id}-${index}`}
            project={project}
          />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [portfolioConfig, setPortfolioConfig] = useState(
    getDefaultPortfolioConfig
  );
  const [activeFilter, setActiveFilter] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [copied, setCopied] = useState(false);
  const lastFocusedRef = useRef(null);
  const {
    siteContent,
    theme,
    typography,
    workFilters = [],
    workGroups
  } = portfolioConfig;
  const heroImage = siteContent.heroImage;
  const heroImageSource = getImageSource(heroImage);
  const heroImageDimensions = getImageDimensions(heroImage);
  const portraitImage = siteContent.profile.portraitImage;
  const portraitImageSource = getImageSource(portraitImage);
  const portraitImageDimensions = getImageDimensions(portraitImage);

  useEffect(() => {
    const syncConfig = () => {
      setPortfolioConfig(loadPortfolioConfig());
      setSelectedProject(null);
    };
    const handleStorage = (event) => {
      if (!event.key || event.key === PORTFOLIO_STORAGE_KEY) syncConfig();
    };
    const handleMessage = (event) => {
      if (
        event.origin === window.location.origin &&
        event.source === window.parent &&
        event.data?.type === PORTFOLIO_PREVIEW_MESSAGE
      ) {
        setPortfolioConfig(normalizePortfolioConfig(event.data.config));
        setSelectedProject(null);
      }
    };

    syncConfig();
    window.addEventListener("storage", handleStorage);
    window.addEventListener(PORTFOLIO_UPDATE_EVENT, syncConfig);
    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(PORTFOLIO_UPDATE_EVENT, syncConfig);
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("is-locked", Boolean(selectedProject));
    return () => document.body.classList.remove("is-locked");
  }, [selectedProject]);

  const openProject = (project) => {
    lastFocusedRef.current = document.activeElement;
    setSelectedProject(project);
  };

  const closeProject = useCallback(() => {
    setSelectedProject(null);
    window.requestAnimationFrame(() => lastFocusedRef.current?.focus());
  }, []);

  const copyWechat = async () => {
    const value = siteContent.contact.wechat;

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const input = document.createElement("textarea");
      input.value = value;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const visibleWorkGroups = workGroups.filter((group) =>
    group.projects.some((project) => project.visible !== false)
  );
  const visibleGroupIds = new Set(visibleWorkGroups.map((group) => group.id));
  const availableFilters = workFilters.filter(
    (filter) =>
      filter.visible !== false &&
      filter.groupIds.some((groupId) => visibleGroupIds.has(groupId))
  );
  const activeFilterConfig =
    availableFilters.find((filter) => filter.id === activeFilter) ??
    availableFilters[0] ??
    null;
  const activeFilterId = activeFilterConfig?.id ?? null;
  const activeGroupIds = activeFilterConfig
    ? new Set(activeFilterConfig.groupIds)
    : null;

  useEffect(() => {
    if (activeFilter !== activeFilterId) {
      setActiveFilter(activeFilterId);
    }
  }, [activeFilter, activeFilterId]);

  return (
    <div
      className="site-root"
      style={{
        "--bg": theme.background,
        "--cyan": theme.cyan,
        "--gold": theme.gold,
        "--text": theme.text,
        ...getTypographyVariables(typography)
      }}
    >
      <header className="site-nav">
        <a aria-label="返回首页" className="brand" href="#top">
          {siteContent.brand}
        </a>
        <nav aria-label="主导航" className="nav-links">
          {navItems.map((item) => (
            <a href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <a className="nav-cta" href="#contact">
          联系我
        </a>
      </header>

      <main id="top">
        <section aria-labelledby="hero-title" className="hero">
          <div aria-hidden="true" className="hero-media">
            {heroImageSource ? (
              <img
                alt={getImageAlt(heroImage)}
                className="hero-background-image"
                decoding="async"
                draggable="false"
                fetchPriority="high"
                height={heroImageDimensions.height || undefined}
                loading="eager"
                referrerPolicy="no-referrer"
                src={heroImageSource}
                width={heroImageDimensions.width || undefined}
              />
            ) : (
              <>
                <div className="hero-media-grid" />
                <div className="hero-beam hero-beam-one" />
                <div className="hero-beam hero-beam-two" />
                <div className="ice-cube ice-cube-one" />
                <div className="ice-cube ice-cube-two" />
                <div className="ice-cube ice-cube-three" />
                <div className="hero-machine">
                  <div className="machine-top" />
                  <div className="machine-screen">
                    <span>ICE</span>
                    <strong>08</strong>
                  </div>
                  <div className="machine-window">
                    <i />
                    <i />
                    <i />
                  </div>
                  <div className="machine-line" />
                </div>
              </>
            )}
          </div>
          <div className="hero-shade" />
          <div className="hero-inner">
            <p className="kicker">{siteContent.role}</p>
            <h1 id="hero-title">
              {siteContent.heroLines.map((line, index) => (
                <span key={index}>{line}</span>
              ))}
            </h1>
            <div className="hero-grid">
              <p className="hero-title phrase-title">
                {siteContent.heroStatementPhrases.map((phrase, index) => (
                  <span key={index}>{phrase}</span>
                ))}
              </p>
              <p>{siteContent.heroDescription}</p>
            </div>
          </div>
        </section>

        <div className="below-stage">
          <div aria-hidden="true" className="below-media">
            <div className="below-cloud below-cloud-one" />
            <div className="below-cloud below-cloud-two" />
            <div className="below-ripple below-ripple-one" />
            <div className="below-ripple below-ripple-two" />
          </div>
          <div className="below-shade" />

          <section className="profile-section" id="profile">
            <div className="section-shell profile-layout">
              <div className="profile-card">
                <div aria-hidden="true" className="portrait-scene">
                  {portraitImageSource ? (
                    <img
                      alt={getImageAlt(portraitImage)}
                      className="portrait-image"
                      decoding="async"
                      draggable="false"
                      height={portraitImageDimensions.height || undefined}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      src={portraitImageSource}
                      width={portraitImageDimensions.width || undefined}
                    />
                  ) : (
                    <>
                      <div className="portrait-grid" />
                      <div className="portrait-halo" />
                      <div className="portrait-figure">
                        <i className="portrait-head" />
                        <i className="portrait-body" />
                      </div>
                      <span className="portrait-word">
                        YOUR
                        <br />
                        PORTRAIT
                      </span>
                    </>
                  )}
                </div>
                <div className="profile-card-caption">
                  <span>{siteContent.profile.captionTitle}</span>
                  <p>{siteContent.profile.captionText}</p>
                </div>
              </div>

              <div className="profile-copy">
                <p className="kicker">Profile</p>
                <h2 className="phrase-title">
                  {siteContent.profile.titlePhrases.map((phrase, index) => (
                    <span key={index}>{phrase}</span>
                  ))}
                </h2>
                {siteContent.profile.paragraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}

                {siteContent.profile.timeline.length > 0 && (
                  <div aria-label="工作经历时间轴" className="timeline">
                    {siteContent.profile.timeline.map((item, index) => (
                      <article className="timeline-item" key={item.id ?? index}>
                        <time>{item.period}</time>
                        <div>
                          <h3>{item.company}</h3>
                          <p>{item.role}</p>
                          <span>{item.description}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                <div className="stats">
                  {siteContent.profile.stats.map((item, index) => (
                    <span key={index}>
                      <strong>{item.value}</strong>
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="works-section" id="works">
            <div className="section-shell">
              <div className="section-head">
                <div>
                  <p className="kicker">Selected Works</p>
                  <h2>作品集</h2>
                </div>
                {availableFilters.length > 0 && (
                  <div aria-label="作品分类" className="filters">
                    {availableFilters.map((filter) => (
                      <button
                        aria-pressed={activeFilterId === filter.id}
                        className={`filter ${activeFilterId === filter.id ? "active" : ""}`}
                        key={filter.id}
                        onClick={() => setActiveFilter(filter.id)}
                        type="button"
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {visibleWorkGroups.map((group) => (
                <WorkGroup
                  group={group}
                  hidden={
                    activeGroupIds !== null && !activeGroupIds.has(group.id)
                  }
                  key={group.id}
                  onOpen={openProject}
                />
              ))}
            </div>
          </section>

          <section className="contact-section" id="contact">
            <div className="section-shell contact-inner">
              <p className="kicker">Contact</p>
              <h2 className="phrase-title">
                {siteContent.contact.titlePhrases.map((phrase, index) => (
                  <span key={index}>{phrase}</span>
                ))}
              </h2>
              <div className="contact-links">
                <a href={`mailto:${siteContent.contact.email}`}>
                  {siteContent.contact.email}
                </a>
                <button onClick={copyWechat} type="button">
                  {copied ? "微信已复制" : `微信 ${siteContent.contact.wechat}`}
                </button>
              </div>
              <div className="contact-foot">
                <span>© 2026 {siteContent.brand}</span>
                <span>{siteContent.contact.availability}</span>
                <a href="#top">Back to top ↑</a>
              </div>
            </div>
          </section>
        </div>
      </main>

      {selectedProject && (
        <ProjectLightbox onClose={closeProject} project={selectedProject} />
      )}
    </div>
  );
}
