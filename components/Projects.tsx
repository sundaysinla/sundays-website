"use client";
import React, { useEffect, useState } from "react";

type Project = {
  number: string;
  name: string;
};

const FALLBACK: Project[] = [
  { number: "01", name: "music production" },
  { number: "02", name: "font making" },
  { number: "03", name: "educational tools" },
  { number: "04", name: "website design" },
  { number: "05", name: "magic tricks" },
  { number: "06", name: "reading fiction" },
  { number: "07", name: "making matcha" },
  { number: "08", name: "3d modeling" },
];

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>(FALLBACK);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setProjects(data);
      })
      .catch(() => {});
  }, []);

  return (
    <section className="text-[#3A372F] py-32 px-6 md:px-16 lg:px-24 relative">
      <div className="text-center mb-8">
        <p className="text-sm uppercase text-[#C0B9A5] font-['ABC Monument Grotesk Unlicensed Trial']">
          Projects
        </p>
      </div>

      <h2 className="text-2xl md:text-3xl ml-8 font-['Office-Times-Sharp-Regular'] text-[#C0B9A5] mb-4 text-left">
        what have we been jamming on?
      </h2>

      {/* Divider */}
      <div className="w-[85%] ml-8 border-t border-dashed border-[#C0B9A5] my-8" />

      {/* Project List */}
      <ul className="space-y-4 ml-8 md:space-y-6 text-[#2A2A24] text-left">
        {projects.map((project) => (
          <li
            key={project.number}
            className="text-[22px] font-['Office-Times-Sharp-Regular']"
          >
            ({project.number}) {project.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
