import Head from "next/head";
import { useEffect, useMemo, useRef, useState } from "react";
import { projectCategories, projects, siteContent } from "../data/portfolio";

const navItems = [
  { href: "#profile", label: "介绍" },
  { href: "#works", label: "作品" },
  { href: "#services", label: "服务" }
];

function Icon({ name, size = 20 }) {
  const paths = {
    arrow:
      "M5 19 19 5M8 5h11v11",
    down:
      "m6 9 6 6 6-6",
    menu:
      "M4 8h16M4 16h16",
    close:
      "M6 6l12 12M18 6 6 18",
    copy:
      "M8 8h11v11H8zM5 16H4V5h11v1",
    check:
      "m5 12 4 4L19 6",
    plus:
      "M12 5v14M5 12h14"
  };

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <path
        d={paths[name]}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function ProjectArtwork({ type }) {
  if (type === "travel") {
    return (
      <div className="artwork travel-art" aria-hidden="true">
        <div className="travel-sky" />
        <div className="travel-sun" />
        <div className="travel-mountain travel-mountain-back" />
        <div className="travel-mountain travel-mountain-front" />
        <p className="travel-coordinates">N 46° 48′ / E 10° 18′</p>
        <p className="travel-word">NORTH</p>
        <div className="travel-ticket">
          <span>Field Notes</span>
          <strong>052</strong>
        </div>
      </div>
    );
  }

  if (type === "beauty") {
    return (
      <div className="artwork beauty-art" aria-hidden="true">
        <div className="beauty-glow" />
        <div className="beauty-word">MORI</div>
        <div className="beauty-bottle beauty-bottle-back">
          <span>M</span>
        </div>
        <div className="beauty-bottle beauty-bottle-front">
          <span>MORI</span>
          <small>01 / cedar</small>
        </div>
        <p className="beauty-note">Scent as a quiet form of memory.</p>
      </div>
    );
  }

  if (type === "tech") {
    return (
      <div className="artwork tech-art" aria-hidden="true">
        <div className="tech-grid" />
        <div className="tech-orbit tech-orbit-one" />
        <div className="tech-orbit tech-orbit-two" />
        <div className="tech-core" />
        <p className="tech-logo">NOVA</p>
        <p className="tech-spec">X1 / OPTICAL SYSTEM / 04.08</p>
      </div>
    );
  }

  if (type === "social") {
    return (
      <div className="artwork social-art" aria-hidden="true">
        <div className="social-card social-card-one">
          <span>MIN</span>
          <strong>DAY</strong>
          <small>Slow living notes</small>
        </div>
        <div className="social-card social-card-two">
          <span>04</span>
          <p>A little space for a clearer mind.</p>
        </div>
        <div className="social-card social-card-three">
          <span>Daily</span>
          <strong>Pause</strong>
        </div>
        <p className="social-caption">Content system / 24 modules</p>
      </div>
    );
  }

  if (type === "culture") {
    return (
      <div className="artwork culture-art" aria-hidden="true">
        <div className="culture-sun" />
        <div className="culture-poster culture-poster-left">
          <span>WIND</span>
          <strong>03</strong>
        </div>
        <div className="culture-poster culture-poster-main">
          <small>Notes from elsewhere</small>
          <strong>SOL<br />ACE</strong>
          <span>Travel Edition</span>
        </div>
        <div className="culture-stamp">S / 25</div>
      </div>
    );
  }

  return (
    <div className="artwork ecommerce-art" aria-hidden="true">
      <div className="ecommerce-grid" />
      <div className="ecommerce-chair">
        <div className="chair-back" />
        <div className="chair-seat" />
        <i className="chair-leg chair-leg-one" />
        <i className="chair-leg chair-leg-two" />
      </div>
      <div className="ecommerce-type">
        <span>FORM</span>
        <strong>06</strong>
      </div>
      <p>Object / Space / Everyday</p>
    </div>
  );
}

function ProjectCard({ project, onOpen }) {
  return (
    <button
      className={`project-card project-card--${project.size} reveal`}
      onClick={() => onOpen(project)}
      style={{ "--project-accent": project.accent }}
      type="button"
    >
      <div className="project-cover">
        <ProjectArtwork type={project.artwork} />
        <span className="project-concept">Concept case</span>
        <span className="project-open" aria-hidden="true">
          <Icon name="arrow" size={22} />
        </span>
      </div>
      <span className="project-info">
        <span className="project-index">{project.index}</span>
        <span className="project-copy">
          <strong>{project.title}</strong>
          <small>{project.subtitle}</small>
        </span>
        <span className="project-meta">
          {project.category} · {project.year}
        </span>
      </span>
    </button>
  );
}

function ProjectModal({ project, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();

    const handleKeydown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [onClose]);

  if (!project) return null;

  return (
    <div
      aria-labelledby="project-dialog-title"
      aria-modal="true"
      className="project-modal"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
    >
      <div className="modal-panel" style={{ "--project-accent": project.accent }}>
        <button
          aria-label="关闭项目详情"
          className="modal-close"
          onClick={onClose}
          ref={closeRef}
          type="button"
        >
          <Icon name="close" size={24} />
        </button>

        <div className="modal-cover">
          <ProjectArtwork type={project.artwork} />
        </div>

        <div className="modal-content">
          <div className="modal-heading">
            <span>
              {project.category} / {project.year}
            </span>
            <h2 id="project-dialog-title">{project.title}</h2>
            <p>{project.subtitle}</p>
          </div>

          <div className="modal-description">
            <p>{project.summary}</p>
            <div className="modal-deliverables">
              <span>Deliverables</span>
              <ul>
                {project.deliverables.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <p className="modal-note">当前为概念案例占位，可替换为你的真实项目图片与说明。</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeFilter, setActiveFilter] = useState("全部");
  const [activeSection, setActiveSection] = useState("profile");
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  const filteredProjects = useMemo(() => {
    if (activeFilter === "全部") return projects;
    return projects.filter((project) => project.category === activeFilter);
  }, [activeFilter]);

  useEffect(() => {
    document.documentElement.classList.add("js");
    return () => document.documentElement.classList.remove("js");
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 32);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const elements = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [activeFilter]);

  useEffect(() => {
    const sections = ["profile", "works", "services", "contact"]
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.2, 0.6] }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.body.classList.toggle("is-locked", menuOpen || Boolean(selectedProject));
    return () => document.body.classList.remove("is-locked");
  }, [menuOpen, selectedProject]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const copyEmail = async () => {
    const email = siteContent.contact.email;

    try {
      await navigator.clipboard.writeText(email);
    } catch {
      const input = document.createElement("textarea");
      input.value = email;
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
      <Head>
        <title>设计师作品集 · Visual Designer Portfolio</title>
        <meta
          content="平面设计师个人作品集，涵盖品牌视觉、电商设计、活动主视觉与 AIGC 工作流。"
          name="description"
        />
        <meta content="width=device-width, initial-scale=1, viewport-fit=cover" name="viewport" />
        <meta content="#10110f" name="theme-color" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      </Head>

      <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
        <a aria-label="返回首页" className="site-brand" href="#top">
          <span className="brand-mark">D</span>
          <span>{siteContent.brand}</span>
        </a>

        <nav aria-label="主导航" className="desktop-nav">
          {navItems.map((item) => (
            <a
              className={activeSection === item.href.slice(1) ? "is-active" : ""}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <a className="header-cta" href="#contact">
          开始合作
          <Icon name="arrow" size={17} />
        </a>

        <button
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "关闭菜单" : "打开菜单"}
          className="menu-toggle"
          onClick={() => setMenuOpen((value) => !value)}
          type="button"
        >
          <Icon name={menuOpen ? "close" : "menu"} size={23} />
        </button>
      </header>

      <div aria-hidden={!menuOpen} className={`mobile-menu ${menuOpen ? "is-open" : ""}`}>
        <nav aria-label="移动端导航">
          {navItems.map((item, index) => (
            <a href={item.href} key={item.href} onClick={() => setMenuOpen(false)}>
              <span>0{index + 1}</span>
              {item.label}
            </a>
          ))}
          <a href="#contact" onClick={() => setMenuOpen(false)}>
            <span>04</span>
            联系
          </a>
        </nav>
        <p>{siteContent.contact.email}</p>
      </div>

      <main id="top">
        <section className="hero-section">
          <div className="hero-grain" />
          <div className="hero-shell">
            <div className="hero-copy">
              <p className="eyebrow reveal">{siteContent.eyebrow}</p>
              <h1 aria-label={siteContent.heroLines.join(" ")}>
                {siteContent.heroLines.map((line, index) => (
                  <span className="hero-line" key={line}>
                    <span>{line}</span>
                    {index === 1 && <i>CN</i>}
                  </span>
                ))}
              </h1>
            </div>

            <div className="hero-visual" aria-label="抽象作品集视觉展示">
              <div className="hero-visual-grid" />
              <div className="hero-orbit hero-orbit-one" />
              <div className="hero-orbit hero-orbit-two" />
              <div className="hero-orbit hero-orbit-three" />
              <div className="hero-orb" />
              <div className="hero-poster">
                <span>Selected works</span>
                <strong>26</strong>
                <small>Brand / Commerce / Campaign</small>
              </div>
              <span className="hero-coordinate hero-coordinate-top">31°14′N</span>
              <span className="hero-coordinate hero-coordinate-bottom">121°29′E</span>
            </div>

            <div className="hero-bottom reveal">
              <p className="hero-statement">{siteContent.heroStatement}</p>
              <p className="hero-description">{siteContent.heroDescription}</p>
              <a className="scroll-cue" href="#profile">
                <span>向下探索</span>
                <i>
                  <Icon name="down" size={18} />
                </i>
              </a>
            </div>
          </div>
        </section>

        <section className="profile-section section" id="profile">
          <div className="section-shell profile-grid">
            <div className="profile-visual reveal">
              <div className="profile-grid-lines" />
              <div className="profile-monogram">D</div>
              <div className="profile-label profile-label-top">
                <span>Visual designer</span>
                <span>Available for projects</span>
              </div>
              <div className="profile-label profile-label-bottom">
                <strong>YOUR<br />PORTRAIT</strong>
                <span>Replace this panel with a portrait or a signature work.</span>
              </div>
            </div>

            <div className="profile-content">
              <p className="section-kicker reveal">{siteContent.profile.label}</p>
              <h2 className="section-title reveal">
                {siteContent.profile.title.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </h2>
              <div className="profile-paragraphs reveal">
                {siteContent.profile.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>

              <div className="capability-grid">
                {siteContent.capabilities.map((item) => (
                  <article className="capability-card reveal" key={item.index}>
                    <span>{item.index}</span>
                    <strong>{item.title}</strong>
                    <p>{item.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="works-section section" id="works">
          <div className="section-shell">
            <div className="section-heading-row">
              <div>
                <p className="section-kicker reveal">Selected works / 02</p>
                <h2 className="display-title reveal">作品不止展示结果，<br />也展示判断。</h2>
              </div>
              <p className="section-intro reveal">
                以下为首版概念案例，用于展示网站的版式与交互。提供真实作品后，可直接替换封面、标题和项目说明。
              </p>
            </div>

            <div aria-label="作品筛选" className="project-filters reveal">
              {projectCategories.map((category) => (
                <button
                  aria-pressed={activeFilter === category}
                  className={activeFilter === category ? "is-active" : ""}
                  key={category}
                  onClick={() => setActiveFilter(category)}
                  type="button"
                >
                  <span>{category}</span>
                  <small>
                    {category === "全部"
                      ? projects.length
                      : projects.filter((project) => project.category === category).length}
                  </small>
                </button>
              ))}
            </div>

            <div className="projects-grid" key={activeFilter}>
              {filteredProjects.map((project) => (
                <ProjectCard key={project.id} onOpen={setSelectedProject} project={project} />
              ))}
            </div>
          </div>
        </section>

        <section className="services-section section" id="services">
          <div className="section-shell">
            <div className="services-heading">
              <p className="section-kicker reveal">Services / 03</p>
              <h2 className="display-title reveal">从一个方向，<br />到一套能落地的设计。</h2>
            </div>

            <div className="services-list">
              {siteContent.services.map((service) => (
                <article className="service-row reveal" key={service.number}>
                  <span className="service-number">{service.number}</span>
                  <h3>{service.title}</h3>
                  <p>{service.text}</p>
                  <div className="service-tags">
                    {service.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <span className="service-icon">
                    <Icon name="plus" size={24} />
                  </span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="contact-section" id="contact">
          <div className="contact-orb" />
          <div className="section-shell contact-shell">
            <p className="section-kicker reveal">Contact / 04</p>
            <h2 className="contact-title reveal">
              Have a project?
              <span>Let&apos;s make it clear.</span>
            </h2>
            <p className="contact-cn reveal">如果你正在寻找新的视觉方向，欢迎把项目发给我。</p>

            <div className="contact-actions reveal">
              <a href={`mailto:${siteContent.contact.email}`}>
                <span>发送邮件</span>
                <strong>{siteContent.contact.email}</strong>
                <Icon name="arrow" size={21} />
              </a>
              <button onClick={copyEmail} type="button">
                <Icon name={copied ? "check" : "copy"} size={20} />
                {copied ? "已复制" : "复制邮箱"}
              </button>
            </div>

            <div className="contact-meta reveal">
              <span>WeChat · {siteContent.contact.wechat}</span>
              <span>{siteContent.contact.location}</span>
              <span>Open for selected projects</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div>
          <a className="site-brand footer-brand" href="#top">
            <span className="brand-mark">D</span>
            <span>{siteContent.brand}</span>
          </a>
          <p>© 2026 Visual designer portfolio.</p>
        </div>
        <p>演示内容集中在 data/portfolio.js，替换后即可正式使用。</p>
        <a href="#top">回到顶部 ↑</a>
      </footer>

      {selectedProject && (
        <ProjectModal onClose={() => setSelectedProject(null)} project={selectedProject} />
      )}
    </>
  );
}
