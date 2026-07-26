"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { siteContent, workFilters, workGroups } from "../data/portfolio";

const navItems = [
  { href: "#profile", label: "介绍" },
  { href: "#works", label: "作品" }
];

function WorkArtwork({ project }) {
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

  return (
    <button
      aria-label={`查看项目：${project.title}`}
      className={`work-card ${isVideo ? "video-card" : "image-card"}`}
      onClick={() => onOpen({ ...project, groupId: group.id, typeLabel: group.typeLabel })}
      style={{ "--accent": project.accent }}
      type="button"
    >
      <WorkArtwork project={project} />
      {isVideo && (
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
    </button>
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
        {group.projects.map((project) => (
          <WorkCard group={group} key={project.id} onOpen={onOpen} project={project} />
        ))}
      </div>
    </section>
  );
}

function ProjectLightbox({ project, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();

    const handleKeydown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [onClose]);

  const isVideo = project.groupId === "video";

  return (
    <div
      aria-labelledby="lightbox-title"
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

      <div className={`lightbox-body ${isVideo ? "video-view" : "image-view"}`}>
        {isVideo ? (
          <div className="video-preview">
            <WorkArtwork project={project} />
            <span aria-hidden="true" className="video-preview-play">
              ▶
            </span>
            <div className="video-progress">
              <i />
            </div>
          </div>
        ) : (
          <div className="long-page-preview">
            <div className="long-page-hero">
              <WorkArtwork project={project} />
            </div>
            <section>
              <span>01 / PRODUCT VALUE</span>
              <h4>以清晰的视觉节奏，建立产品的第一印象。</h4>
              <p>此处为详情页长图结构占位，替换为你的完整项目图后可直接纵向浏览。</p>
            </section>
            <section className="long-page-dark">
              <span>02 / KEY FEATURE</span>
              <strong>{project.word}</strong>
              <p>核心卖点、技术参数与场景内容可以在这里分屏呈现。</p>
            </section>
            <section>
              <span>03 / EXPERIENCE</span>
              <h4>让信息、氛围和转化目标保持在同一套系统中。</h4>
            </section>
          </div>
        )}
        <div className="lightbox-meta">
          <span>{project.typeLabel}</span>
          <h2 id="lightbox-title">{project.title}</h2>
          <p>{project.label}</p>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedProject, setSelectedProject] = useState(null);
  const [copied, setCopied] = useState(false);
  const lastFocusedRef = useRef(null);

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

  return (
    <>
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
          </div>
          <div className="hero-shade" />
          <div className="hero-inner">
            <p className="kicker">{siteContent.role}</p>
            <h1 id="hero-title">
              {siteContent.heroLines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </h1>
            <div className="hero-grid">
              <p className="hero-title phrase-title">
                {siteContent.heroStatementPhrases.map((phrase) => (
                  <span key={phrase}>{phrase}</span>
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
                  <div className="portrait-grid" />
                  <div className="portrait-halo" />
                  <div className="portrait-figure">
                    <i className="portrait-head" />
                    <i className="portrait-body" />
                  </div>
                  <span className="portrait-word">YOUR<br />PORTRAIT</span>
                </div>
                <div className="profile-card-caption">
                  <span>Design Director</span>
                  <p>AIGC Workflow / Brand Upgrade / Ecommerce Visual</p>
                </div>
              </div>

              <div className="profile-copy">
                <p className="kicker">Profile</p>
                <h2 className="phrase-title">
                  {siteContent.profile.titlePhrases.map((phrase) => (
                    <span key={phrase}>{phrase}</span>
                  ))}
                </h2>
                {siteContent.profile.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}

                <div aria-label="工作经历时间轴" className="timeline">
                  {siteContent.profile.timeline.map((item) => (
                    <article className="timeline-item" key={item.period}>
                      <time>{item.period}</time>
                      <div>
                        <h3>{item.company}</h3>
                        <p>{item.role}</p>
                        <span>{item.description}</span>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="stats">
                  {siteContent.profile.stats.map((item) => (
                    <span key={item.label}>
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
                <div aria-label="作品分类" className="filters">
                  {workFilters.map((filter) => (
                    <button
                      aria-pressed={activeFilter === filter.id}
                      className={`filter ${activeFilter === filter.id ? "active" : ""}`}
                      key={filter.id}
                      onClick={() => setActiveFilter(filter.id)}
                      type="button"
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {workGroups.map((group) => (
                <WorkGroup
                  group={group}
                  hidden={activeFilter !== "all" && activeFilter !== group.id}
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
                {siteContent.contact.titlePhrases.map((phrase) => (
                  <span key={phrase}>{phrase}</span>
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
    </>
  );
}
