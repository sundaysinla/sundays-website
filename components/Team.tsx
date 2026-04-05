"use client";
import React from "react";
import DashedDivider from "@/components/DashedDivider";

const linkClass =
  "relative after:absolute after:left-0 after:-bottom-0.5 after:h-[1px] after:w-full after:bg-current after:opacity-20 md:after:opacity-0 after:transition-opacity after:duration-300 after:ease-out hover:after:opacity-20";

type Member = { name: string; href?: string };

function MemberList({ members }: { members: Member[] }) {
  return (
    <ul className="space-y-2 md:space-y-1 text-[16px] font-['Office-Times-Sharp-Regular'] tracking-[-0.16px]">
      {members.map((m) => (
        <li key={m.name}>
          {m.href ? (
            <a
              href={m.href}
              target="_blank"
              rel="noopener"
              className={linkClass}
            >
              {m.name}
            </a>
          ) : (
            m.name
          )}
        </li>
      ))}
    </ul>
  );
}

const uscHosts: Member[] = [
  { name: "Amanda Nepo", href: "https://www.linkedin.com/in/amanda-nepo-7830152b1/" },
  { name: "Maia Rocha", href: "https://www.linkedin.com/in/maia-rocha-154497213/" },
  { name: "Mark Hou", href: "https://www.linkedin.com/in/mark-hou-/" },
  { name: "Richard Zhang", href: "https://www.linkedin.com/in/richardshizhang/" },
  { name: "Sam Cheng", href: "https://www.linkedin.com/in/samfcheng/" },
  { name: "Sinchana Nama", href: "https://www.linkedin.com/in/snama/" },
];

const uclaHosts: Member[] = [
  { name: "Alan Song", href: "https://www.linkedin.com/in/alan-song-99123b260/" },
  { name: "Emily Shen", href: "https://www.linkedin.com/in/emilyshenucla/" },
  { name: "Hannah He", href: "https://www.linkedin.com/in/hannah-yixuan-he/" },
  { name: "Kai Davey", href: "https://www.linkedin.com/in/kai-davey/" },
  { name: "Michelle Liu", href: "https://www.linkedin.com/in/michelletliu/" },
];

const mediaTeam: Member[] = [
  { name: "Brandon Bao", href: "https://www.linkedin.com/in/brandonbbao/" },
  { name: "Fiori Lee", href: "https://www.linkedin.com/in/fiorilee/" },
  { name: "Jan Rebolledo", href: "https://www.linkedin.com/in/janrebolledo/" },
];

const alumniCol1: Member[] = [
  { name: "Joshua Wolk", href: "https://www.linkedin.com/in/joshgwolk/" },
  { name: "Jade Franson", href: "https://www.linkedin.com/in/jade-franson/" },
  { name: "BJ Moon", href: "https://www.linkedin.com/in/bjmoon/" },
  { name: "Jake Sacks", href: "https://www.linkedin.com/in/sacksjake/" },
  { name: "Ethan Lippman", href: "https://x.com/EbisuEthan" },
];

const alumniCol2: Member[] = [
  { name: "Chris Pramana", href: "https://www.linkedin.com/in/capramana/" },
  { name: "Celine Carr", href: "https://www.linkedin.com/in/celine-carr-072bb9261/" },
  { name: "Joseph Good", href: "https://www.linkedin.com/in/joseph-good1/" },
  { name: "Sarah Fan", href: "https://www.linkedin.com/in/sarah-fan-70400a241/" },
  { name: "Grace Li", href: "https://www.linkedin.com/in/grace-li51/" },
];

const alumniCol3: Member[] = [
  { name: "Jacqueline Guo", href: "https://www.linkedin.com/in/jacquelineguo7/" },
  { name: "Miki Safronov-Yamamoto", href: "https://www.linkedin.com/in/mikisafronov/" },
  { name: "Jayson Tian", href: "https://www.linkedin.com/in/jaysontian/" },
  { name: "Kyle Jeong", href: "https://www.linkedin.com/in/kyle-jeong/" },
];

export default function Team() {
  return (
    <section className="bg-[#FCFAF7] text-[#2A2A24] py-32 px-6 md:px-12 lg:px-16 relative">
      {/* Dashed column grid */}
      <div
        className="absolute inset-0 pointer-events-none grid grid-cols-8 md:grid-cols-[repeat(16,1fr)]"
      >
        {[...Array(16)].map((_, i) => (
          <div
            key={i}
            className={`h-full ${i >= 8 ? 'hidden md:block' : ''}`}
            style={{
              backgroundImage:
                i > 0
                  ? "linear-gradient(#F0EDE8 4px, transparent 2px)"
                  : "none",
              backgroundSize: "1px 12px",
              backgroundPosition: "left top",
              backgroundRepeat: "repeat-y",
            }}
          />
        ))}
      </div>

      <div className="max-w-[960px] mx-auto flex flex-col gap-20 items-center relative z-10">
        {/* Header */}
        <div className="text-center flex flex-col gap-1">
          <p className="text-sm text-[#C0B9A5] font-['Monument-Grotesk'] tracking-wide uppercase">
            Meet the Team
          </p>
          <p className="text-sm font-bold font-['Monument-Grotesk'] text-stone-400 uppercase">
            Season 6: 2025–26
          </p>
        </div>

        <DashedDivider />

        {/* Three columns */}
        <div className="flex flex-col md:grid md:grid-cols-3 gap-y-12 md:gap-8 text-center w-full items-center md:items-start">
          {/* USC Hosts */}
          <div className="flex flex-col gap-6 items-center">
            <div className="flex flex-col gap-3 items-center">
              <div className="text-[44px] leading-none h-[52px] flex items-end">✌️</div>
              <h2 className="text-4xl font-['Office-Times-Sharp-Regular'] text-[#C0B9A5] lowercase tracking-[-0.36px]">
                usc hosts
              </h2>
            </div>
            <MemberList members={uscHosts} />
          </div>

          {/* UCLA Hosts */}
          <div className="flex flex-col gap-6 items-center">
            <div className="flex flex-col gap-3 items-center">
              <div className="text-[44px] leading-none h-[52px] flex items-end">🐻</div>
              <h2 className="text-4xl font-['Office-Times-Sharp-Regular'] text-[#C0B9A5] lowercase tracking-[-0.36px]">
                ucla hosts
              </h2>
            </div>
            <MemberList members={uclaHosts} />
          </div>

          {/* Media Team */}
          <div className="flex flex-col gap-6 items-center">
            <div className="flex flex-col gap-3 items-center">
              <div className="text-[44px] leading-none h-[52px] flex items-end">🎥</div>
              <h2 className="text-4xl font-['Office-Times-Sharp-Regular'] text-[#C0B9A5] lowercase tracking-[-0.36px]">
                media team
              </h2>
            </div>
            <MemberList members={mediaTeam} />
          </div>
        </div>

        <DashedDivider />

        {/* Alumni */}
        <div className="flex flex-col gap-8 items-center w-full">
          <div className="flex flex-col gap-3 items-center">
            <div className="text-[44px] leading-none h-[52px] flex items-end text-[#C0B9A5]">⁂</div>
            <h2 className="text-4xl font-['Office-Times-Sharp-Regular'] text-[#C0B9A5] lowercase tracking-[-0.36px]">
              hosts alumni
            </h2>
          </div>
          <div className="md:hidden text-center w-full">
            <MemberList members={[...alumniCol1, ...alumniCol2, ...alumniCol3]} />
          </div>
          <div className="hidden md:grid md:grid-cols-3 gap-16 text-center w-full">
            <MemberList members={alumniCol1} />
            <MemberList members={alumniCol2} />
            <MemberList members={alumniCol3} />
          </div>
        </div>
      </div>
    </section>
  );
}
