"use client";
import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import DashedDivider from "@/components/DashedDivider";

type Project = {
  number: string;
  name: string;
  description?: string;
  image?: string;
};

const FALLBACK: Project[] = [
  { number: "01", name: "music production", description: "jamming on our favorite beats", image: "/maker-keyboard.png" },
  { number: "02", name: "making matcha", description: "building a campus matcha pop-up" },
  { number: "03", name: "educational tools", description: "did i spell that right?" },
  { number: "04", name: "website design", description: "making this website!", image: "/maker-laptop.png" },
  { number: "05", name: "magic tricks", description: "now you see me, now you don't" },
  { number: "06", name: "reading fiction", description: "food for the mind", image: "/maker-notebook.png" },
  { number: "07", name: "font making", description: "obsessing over pixels", image: "/maker-paintbrush.png" },
  { number: "08", name: "3d modeling", description: "bringing ideas to life" },
];

function ProjectCard({ project }: { project: Project }) {
  return (
    <div className="w-[280px] bg-white rounded-[26px] p-6 flex flex-col gap-2.5 shadow-[0px_8px_24px_0px_rgba(0,0,0,0.12)] border border-[#FCFAF7] pointer-events-none">
      <div className="flex items-center gap-2.5">
        <p className="flex-1 text-[20px] font-['Office-Times-Sharp-Regular'] text-black lowercase tracking-[-0.2px] leading-[1.4]">
          {project.name}
        </p>
        <span className="bg-[#BDFF00] text-[15px] font-['Office-Times-Sharp-Regular'] text-black lowercase tracking-[-0.15px] px-2 py-1 rounded-full shrink-0">
          ({project.number})
        </span>
      </div>

      {project.image && (
        <div className="w-full aspect-square flex items-center justify-center">
          <div className="-rotate-[13deg]">
            <img
              src={project.image}
              alt={project.name}
              width={225}
              height={225}
              className="object-contain mix-blend-multiply"
              loading="lazy"
            />
          </div>
        </div>
      )}

      {project.description && (
        <p className="text-sm font-['Monument-Grotesk'] text-[#4d4d4d]">
          {project.description}
        </p>
      )}
    </div>
  );
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>(FALLBACK);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [cardPos, setCardPos] = useState({ x: 0, y: 0 });
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setProjects(data);
      })
      .catch(() => {});
  }, []);

  const CARD_W = 280;
  const OFFSET_X = 140;

  useEffect(() => {
    if (hoveredIdx !== null) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [hoveredIdx]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const vw = window.innerWidth;
    const midpoint = vw / 2;
    let x: number;
    if (e.clientX < midpoint) {
      x = e.clientX + OFFSET_X;
      if (x + CARD_W > vw - 16) x = vw - CARD_W - 16;
    } else {
      x = e.clientX - OFFSET_X - CARD_W;
      if (x < 16) x = 16;
    }
    let y = e.clientY - 140;
    if (y < 16) y = 16;
    if (y + 400 > window.innerHeight) y = window.innerHeight - 400;
    setCardPos({ x, y });
  };

  return (
    <section className="text-[#3A372F] py-32 px-6 md:px-16 lg:px-24 relative bg-white">
      <div className="text-center mb-8">
        <p className="text-sm uppercase text-[#C0B9A5] font-['ABC Monument Grotesk Unlicensed Trial']">
          Projects
        </p>
      </div>

      <h2 className="text-2xl md:text-3xl ml-8 font-['Office-Times-Sharp-Regular'] text-[#C0B9A5] mb-4 text-left">
        what have we been jamming on?
      </h2>

      <DashedDivider className="w-[85%] ml-8 my-8" />

      <ul
        ref={listRef}
        className="space-y-4 md:space-y-6 text-left"
        onMouseMove={handleMouseMove}
      >
        {projects.map((project, i) => (
          <li
            key={project.number}
            className="text-[22px] font-['Office-Times-Sharp-Regular'] text-stone-400 hover:text-stone-800 py-2 -mx-6 px-6 md:-mx-16 md:px-16 lg:-mx-24 lg:px-24 cursor-default transition-colors duration-200"
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <span className="ml-8">({project.number}) {project.name}</span>
          </li>
        ))}
      </ul>

      {mounted &&
        createPortal(
          <div
            className="fixed z-[9999] pointer-events-none"
            style={{
              left: cardPos.x,
              top: cardPos.y,
              opacity: hoveredIdx !== null && visible ? 1 : 0,
              transform: hoveredIdx !== null && visible ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(6px)',
              transition: 'left 120ms ease-out, top 120ms ease-out, opacity 200ms ease-out, transform 250ms cubic-bezier(0.16, 1, 0.3, 1)',
              visibility: hoveredIdx !== null ? 'visible' : 'hidden',
            }}
          >
            {hoveredIdx !== null && <ProjectCard project={projects[hoveredIdx]} />}
          </div>,
          document.body
        )
      }
    </section>
  );
}
