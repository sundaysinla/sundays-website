"use client";
import React from "react";
import Link from "next/link";

export default function Projects() {
  return (
    <section className="text-[#3A372F] bg-[#F5F4EF]/80 py-32 px-6 md:px-20 lg:px-40 relative">
      <div className="text-center mb-8">
        <p className="text-sm uppercase text-[#C0B9A5] font-['ABC Monument Grotesk Unlicensed Trial']">
          Who we are
        </p>
      </div>

      <div className="flex flex-col items-center text-center space-y-3 max-w-4xl mx-auto py-6">
        <p className="text-xl md:text-3xl lg:text-4xl font-serif text-black leading-relaxed">
          <span className="text-[#C0B9A5]">⁂ ​​</span>this is a home for the
        </p>

        <p className="text-xl md:text-3xl lg:text-4xl font-serif text-black leading-relaxed">
          makers, artists, filmmakers,
        </p>
        <p className="text-xl md:text-3xl lg:text-4xl font-serif text-black leading-relaxed">
          learners, researchers, creatives,
        </p>
        <p className="text-xl md:text-3xl lg:text-4xl font-serif text-black leading-relaxed">
          founders, movers, <span className="text-[#C0B9A5]">&</span> shakers.
        </p>
        
        <p className="text-sm md:text-base font-sans text-black leading-relaxed pt-8">
          sundays is a node of <Link href="https://socratica.info/" target="_blank" rel="noopener noreferrer" className="text-[#C0B9A5] relative after:absolute after:left-0 after:bottom-0 after:h-[1px] after:w-full after:bg-[#C0B9A5] after:opacity-0 after:transition-opacity after:duration-300 after:ease-out hover:after:opacity-100">Socratica</Link>, a global creative community.
        </p>
      </div>
    </section>
  );
}