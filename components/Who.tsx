"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";

export default function Who() {
  return (
    <section className="text-[#3A372F] bg-[#F5F4EF]/80 py-32 px-6 md:px-12 lg:px-16 relative overflow-hidden">
      {/* Dashed column grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(16, 1fr)",
        }}
      >
        {[...Array(16)].map((_, i) => (
          <div
            key={i}
            className="h-full"
            style={{
              backgroundImage:
                i > 0
                  ? "linear-gradient(#e7e5e4 4px, transparent 2px)"
                  : "none",
              backgroundSize: "1px 12px",
              backgroundPosition: "left top",
              backgroundRepeat: "repeat-y",
            }}
          />
        ))}
      </div>
      {/* Left polaroid cluster */}
      <div className="absolute -left-4 -bottom-6 w-[32%] max-w-[480px] select-none transition-transform duration-300 ease-out hover:scale-[1.01]">
        <Image
          src="/polaroids-right.png"
          alt=""
          width={960}
          height={640}
          className="w-full h-auto"
          aria-hidden="true"
        />
      </div>

      {/* Right polaroid cluster */}
      <div className="absolute -right-4 -top-4 w-[32%] max-w-[480px] select-none transition-transform duration-300 ease-out hover:scale-[1.01]">
        <Image
          src="/polaroids-left.png"
          alt=""
          width={960}
          height={780}
          className="w-full h-auto"
          aria-hidden="true"
        />
      </div>

      {/* Content */}
      <div className="relative z-10">
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
          
          <p className="text-sm md:text-base font-sans text-stone-600 leading-relaxed pt-8">
            sundays is a node of <Link href="https://socratica.info/" target="_blank" rel="noopener noreferrer" className="text-[#C0B9A5] underline decoration-dotted decoration-[#C0B9A5]/40 underline-offset-[3px] hover:text-[#8a7f6b] hover:decoration-solid hover:decoration-[#8a7f6b]/60 transition-all duration-300">Socratica</Link>, a global creative community.
          </p>
        </div>
      </div>
    </section>
  );
}
