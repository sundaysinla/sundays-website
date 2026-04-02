"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import DashedDivider from "@/components/DashedDivider";
import AsciiBackground from "@/components/AsciiBackground";

type Creator = {
  name: string;
  url: string;
  profilePic?: string;
};

type Project = {
  number: string;
  name: string;
  description?: string;
  image?: string;
  projectUrl?: string;
  creators?: Creator[];
};

const FALLBACK: Project[] = [
  { number: "01", name: "music production", description: "jamming on our favorite beats", image: "/maker-keyboard.png" },
  { number: "02", name: "making matcha", description: "building a campus matcha pop-up", creators: [{ name: "jayson tian", url: "https://x.com/jaezun_" }, { name: "michelle liu", url: "https://x.com/michelletliu" }] },
  { number: "03", name: "educational tools", description: "did i spell that right?", creators: [{ name: "sam cheng", url: "https://x.com/samfcheng" }] },
  { number: "04", name: "website design", description: "making this website!", image: "/maker-laptop.png" },
  { number: "05", name: "magic tricks", description: "now you see me, now you don't", creators: [{ name: "amanda nepo", url: "https://www.instagram.com/amandanepo.magic/" }] },
  { number: "06", name: "reading fiction", description: "food for the mind", image: "/maker-notebook.png" },
  { number: "07", name: "font making", description: "obsessing over pixels", image: "/maker-paintbrush.png", creators: [{ name: "jacqueline guo", url: "https://x.com/jacqfolio" }] },
  { number: "08", name: "3d modeling", description: "bringing ideas to life" },
];

const MISSPELLINGS = ["spel"];

function highlightMisspellings(text: string): React.ReactNode {
  const pattern = new RegExp(`(${MISSPELLINGS.join("|")})`, "gi");
  const parts = text.split(pattern);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    MISSPELLINGS.some((w) => w.toLowerCase() === part.toLowerCase()) ? (
      <span
        key={i}
        className="decoration-red-500 decoration-wavy underline underline-offset-[3px]"
      >
        {part}
      </span>
    ) : (
      part
    )
  );
}

function useAvatars(creators?: Creator[]) {
  const [avatars, setAvatars] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!creators?.length) return;
    let cancelled = false;
    creators.forEach((c) => {
      if (c.profilePic) {
        setAvatars((prev) => ({ ...prev, [c.url || c.name]: c.profilePic! }));
        return;
      }
      if (!c.url) return;
      fetch(`/api/og-image?url=${encodeURIComponent(c.url)}`)
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && data.image) {
            setAvatars((prev) => ({ ...prev, [c.url]: data.image }));
          }
        })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, [creators]);

  return avatars;
}

function CreatorRow({ creator, avatar }: { creator: Creator; avatar?: string }) {
  const inner = (
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded-full overflow-hidden bg-stone-100 shrink-0">
        {avatar ? (
          <img src={avatar} alt={creator.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-stone-200" />
        )}
      </div>
      <span className="text-[14px] font-['Monument-Grotesk'] text-black/70 lowercase leading-normal">
        {creator.name}
      </span>
    </div>
  );

  if (creator.url) {
    return (
      <a href={creator.url} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted decoration-stone-400/60 underline-offset-[3px] hover:decoration-solid hover:decoration-stone-500/80 transition-all duration-300">
        {inner}
      </a>
    );
  }
  return inner;
}

function ProjectCard({ project }: { project: Project }) {
  const avatars = useAvatars(project.creators);

  return (
    <div className="w-[318px] bg-white rounded-[8px] p-6 flex flex-col items-start gap-4 shadow-[0px_4px_14px_0px_rgba(0,0,0,0.12)] border border-[#FCFAF7] text-left">
      <div className="flex items-center gap-2.5 w-full">
        <p className="flex-1 text-[20px] font-['Office-Times-Sharp-Regular'] text-black lowercase tracking-[-0.2px] leading-[1.4]">
          {project.projectUrl ? (
            <a href={project.projectUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted decoration-stone-400/60 underline-offset-[3px] hover:decoration-solid hover:decoration-stone-500/80 hover:text-stone-900 transition-all duration-300">
              {project.name}
            </a>
          ) : (
            project.name
          )}
        </p>
        <span className="bg-[#BDFF00] text-[15px] font-['Office-Times-Sharp-Regular'] text-black lowercase tracking-[-0.15px] px-2 pt-0.5 pb-1 rounded-[8px] shrink-0" style={{ cornerShape: 'squircle' } as React.CSSProperties}>
          ({project.number})
        </span>
      </div>

      {project.image && (
        <div className="w-full flex-1 min-h-0 flex items-center justify-center">
          <div>
            <img
              src={project.image}
              alt={project.name}
              width={225}
              height={225}
              className="object-contain mix-blend-multiply rounded-xl"
              loading="lazy"
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.dataset.retried) {
                  img.dataset.retried = "1";
                  fetch("/api/projects")
                    .then((r) => r.json())
                    .then((data: Project[]) => {
                      const fresh = data.find((p) => p.number === project.number);
                      if (fresh?.image) img.src = fresh.image;
                    })
                    .catch(() => { img.style.display = "none"; });
                } else {
                  img.style.display = "none";
                }
              }}
            />
          </div>
        </div>
      )}

      {project.description && (
        <p className="text-sm font-['Monument-Grotesk'] text-[#4d4d4d] w-full">
          {highlightMisspellings(project.description)}
        </p>
      )}

      {project.creators && project.creators.length > 0 && (
        <>
          <DashedDivider className="w-full" />
          <div className="flex flex-col gap-3">
            {project.creators.map((c) => (
              <CreatorRow key={c.name} creator={c} avatar={avatars[c.url] || avatars[c.name]} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MobileProjectCard({ project }: { project: Project }) {
  const avatars = useAvatars(project.creators);

  return (
    <div className="bg-white rounded-[14px] px-5 py-4 flex flex-col gap-3 shadow-[0px_4px_20px_0px_rgba(0,0,0,0.16)] border border-[#FCFAF7] pointer-events-none">
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0 flex flex-col items-start gap-1.5">
          <div className="flex items-center gap-2">
            <span className="bg-[#BDFF00] text-[13px] font-['Office-Times-Sharp-Regular'] text-black lowercase tracking-[-0.15px] px-1.5 pt-px pb-0.5 rounded-[8px] shrink-0" style={{ cornerShape: 'squircle' } as React.CSSProperties}>
              ({project.number})
            </span>
            <p className="text-[18px] font-['Office-Times-Sharp-Regular'] text-black lowercase tracking-[-0.2px] leading-tight truncate text-left">
              {project.projectUrl ? (
                <a href={project.projectUrl} target="_blank" rel="noopener noreferrer" className="pointer-events-auto underline decoration-dotted decoration-stone-400/60 underline-offset-[3px] hover:decoration-solid hover:decoration-stone-500/80 hover:text-stone-900 transition-all duration-300">
                  {project.name}
                </a>
              ) : (
                project.name
              )}
            </p>
          </div>
          {project.description && (
            <p className="text-[13px] font-['Monument-Grotesk'] text-[#4d4d4d] leading-snug line-clamp-2 text-left">
              {highlightMisspellings(project.description)}
            </p>
          )}
        </div>
        {project.image && (
          <div className="w-[72px] h-[72px] shrink-0 flex items-center justify-center">
            <img
              src={project.image}
              alt={project.name}
              width={72}
              height={72}
              className="object-contain mix-blend-multiply rounded-xl"
              loading="lazy"
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.dataset.retried) {
                  img.dataset.retried = "1";
                  fetch("/api/projects")
                    .then((r) => r.json())
                    .then((data: Project[]) => {
                      const fresh = data.find((p) => p.number === project.number);
                      if (fresh?.image) img.src = fresh.image;
                    })
                    .catch(() => { img.style.display = "none"; });
                } else {
                  img.style.display = "none";
                }
              }}
            />
          </div>
        )}
      </div>
      {project.creators && project.creators.length > 0 && (
        <div className="flex items-center gap-3 pt-2.5 border-t border-dashed border-stone-200">
          {project.creators.map((c) => (
            <a
              key={c.name}
              href={c.url || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto flex items-center gap-1.5 underline decoration-dotted decoration-stone-400/60 underline-offset-[3px] hover:decoration-solid hover:decoration-stone-500/80 transition-all duration-300"
            >
              <div className="w-5 h-5 rounded-full overflow-hidden bg-stone-100 shrink-0">
                {(avatars[c.url] || avatars[c.name]) ? (
                  <img src={avatars[c.url] || avatars[c.name]} alt={c.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-stone-200" />
                )}
              </div>
              <span className="text-[12px] font-['Monument-Grotesk'] text-black/70 lowercase">
                {c.name}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>(FALLBACK);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(0);
  const cardHovered = useRef(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scrollIdx, setScrollIdx] = useState<number>(0);
  const [visible, setVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileCard, setShowMobileCard] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const mousePos = useRef<{ x: number; y: number; t: number }>({ x: 0, y: 0, t: 0 });
  const pendingHover = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeIdx = isMobile ? scrollIdx : hoveredIdx;

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    mousePos.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  }, []);

  const handleItemEnter = useCallback((i: number) => {
    if (pendingHover.current) clearTimeout(pendingHover.current);
    if (hoveredIdx === null) {
      setHoveredIdx(i);
      return;
    }
    const { x: prevX } = mousePos.current;
    const ul = listRef.current;
    if (ul) {
      const ulRect = ul.getBoundingClientRect();
      const distToRight = ulRect.right - prevX;
      if (distToRight > 60) {
        setHoveredIdx(i);
        return;
      }
    }
    pendingHover.current = setTimeout(() => {
      setHoveredIdx(i);
      pendingHover.current = null;
    }, 200);
  }, [hoveredIdx]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!isMobile) { setShowMobileCard(false); return; }
    function onScroll() {
      const ul = listRef.current;
      if (!ul) return;
      const rect = ul.getBoundingClientRect();
      const inView = rect.top < window.innerHeight - 80 && rect.bottom > 120;
      setShowMobileCard(inView);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isMobile]);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setProjects(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (hoveredIdx !== null) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [hoveredIdx]);

  const setItemRef = useCallback((el: HTMLLIElement | null, i: number) => {
    itemRefs.current[i] = el;
  }, []);

  useEffect(() => {
    if (!isMobile) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let best: { idx: number; ratio: number } | null = null;
        for (const entry of entries) {
          const idx = Number(entry.target.getAttribute("data-idx"));
          if (isNaN(idx)) continue;
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { idx, ratio: entry.intersectionRatio };
          }
        }
        if (best && best.ratio > 0) setScrollIdx(best.idx);
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: "-40% 0px -40% 0px" }
    );

    const items = itemRefs.current;
    items.forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [isMobile, projects]);

  return (
    <section ref={sectionRef} className="text-[#3A372F] py-32 px-6 md:px-16 lg:px-24 relative bg-white">
      <style>{`
        @keyframes mobileCardIn {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div className="absolute inset-0 overflow-hidden">
        <AsciiBackground />
      </div>
      <div className="relative z-10 text-center mb-8">
        <p className="text-sm uppercase text-[#C0B9A5] font-['ABC Monument Grotesk Unlicensed Trial']">
          Projects
        </p>
      </div>

      <h2 className="relative z-10 text-2xl md:text-3xl ml-8 font-['Office-Times-Sharp-Regular'] text-[#C0B9A5] mb-4 text-left">
        what have we been jamming on?
      </h2>

      <DashedDivider className="relative z-10 w-[85%] ml-8 my-8" />

      {/* Mobile: fixed card, only visible when project list is on screen */}
      {isMobile && showMobileCard && (
        <div className="fixed bottom-6 left-4 right-4 z-50 md:hidden">
          <div
            key={scrollIdx}
            style={{
              animation: 'mobileCardIn 250ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <MobileProjectCard project={projects[scrollIdx]} />
          </div>
        </div>
      )}

      <div
        className="relative z-10"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          if (pendingHover.current) clearTimeout(pendingHover.current);
          leaveTimer.current = setTimeout(() => {
            if (!cardHovered.current) setHoveredIdx(null);
          }, 300);
        }}
      >
        <ul ref={listRef} className="text-left">
          {projects.map((project, i) => (
            <li
              key={project.number}
              ref={(el) => setItemRef(el, i)}
              data-idx={i}
              className={`text-[22px] font-['Office-Times-Sharp-Regular'] py-4 md:pr-[340px] cursor-default transition-colors duration-200 ${
                isMobile
                  ? scrollIdx === i ? "text-stone-800" : "text-stone-400"
                  : hoveredIdx === i ? "text-stone-800" : "text-stone-400 hover:text-stone-800"
              }`}
              onMouseEnter={() => handleItemEnter(i)}
            >
              <span className="ml-8">({project.number}) {project.name}</span>
            </li>
          ))}
        </ul>

        {/* Desktop: card centered vertically within list */}
        {!isMobile && activeIdx !== null && (
          <div
            className="absolute right-[12%] top-1/2 w-[318px] z-50"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(-50%) scale(1)' : 'translateY(calc(-50% + 8px)) scale(0.96)',
              transition: 'opacity 200ms ease-out, transform 300ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onMouseEnter={() => {
              cardHovered.current = true;
              if (leaveTimer.current) clearTimeout(leaveTimer.current);
            }}
            onMouseLeave={() => {
              cardHovered.current = false;
              setHoveredIdx(null);
            }}
          >
            <ProjectCard project={projects[activeIdx]} />
          </div>
        )}
      </div>

    </section>
  );
}
