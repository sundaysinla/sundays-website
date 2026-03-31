"use client";

import Image from "next/image";
import ShuffleText from "@/components/ShuffleText";
import { useInView } from "react-intersection-observer";

const cards = [
  { image: "/maker-keyboard.png", label: "(play)" },
  { image: "/maker-laptop.png", label: "(code)" },
  { image: "/maker-camera.png", label: "(capture)" },
  { image: "/maker-notebook.png", label: "(write)" },
  { image: "/maker-paintbrush.png", label: "(paint)" },
  { image: "/maker-design.png", label: "(design)" },
];

export default function WhatWeDoCarousel() {
  const [headerRef] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const doubled = [...cards, ...cards];

  return (
    <div className="col-span-full flex flex-col items-center text-center relative py-32 bg-stone-50">
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/3 w-[600px] h-[600px] md:w-[800px] md:h-[800px] rounded-full z-0 pointer-events-none"
        style={{
          background: "radial-gradient(circle, #BDFF004D 3%, #C0B9A526 25%, transparent 70%)",
        }}
      />

      {/* Header */}
      <div
        ref={headerRef}
        className="col-span-full flex flex-col items-center text-center relative z-10"
      >
        <div className="text-sm uppercase tracking-wide font-['Monument-Grotesk'] text-[#C0B9A5] mb-6">
          <ShuffleText text="WHAT WE DO" />
        </div>

        {/* Main text */}
        <div className="flex flex-col items-center space-y-0 md:space-y-1 max-w-xl py-4">
          <p className="text-lg md:text-2xl lg:text-3xl font-['Office-Times-Sharp-Regular'] text-black leading-snug">
            we meet every <span className="italic">sunday</span>
          </p>

          <p className="text-lg md:text-2xl lg:text-3xl font-['Office-Times-Sharp-Regular'] text-black leading-snug">
            to create whatever it is
          </p>
          <p className="text-lg md:text-2xl lg:text-3xl font-['Office-Times-Sharp-Regular'] text-black leading-snug">
            that makes us feel alive.
          </p>
        </div>
      </div>

      {/* Carousel */}
      <div className="relative z-10 overflow-hidden w-screen max-w-full mx-auto pt-20 pb-4">
        <div
          className="flex gap-4 md:gap-12 px-4 md:px-8 w-max animate-carousel"
          style={{ animationDuration: `${doubled.length * 4}s` }}
        >
          {[...doubled, ...doubled].map((card, i) => (
            <div
              key={i}
              className="flex-shrink-0 flex flex-col gap-4 md:gap-8 items-center justify-center p-3 md:p-6 rounded-[14px] md:rounded-[26px] overflow-clip transition-transform duration-300 ease-out hover:-translate-y-3"
              style={{
                background: 'rgba(255,255,255,0.5)',
                boxShadow: '0px 4px 12px 0px rgba(0,0,0,0.05)',
                cornerShape: 'squircle',
              } as React.CSSProperties}
            >
              <div className="relative w-[135px] h-[135px] md:w-[270px] md:h-[270px] shrink-0 flex items-center justify-center overflow-hidden">
                <Image
                  src={card.image}
                  alt={card.label}
                  width={270}
                  height={270}
                  className="object-contain max-w-full max-h-full"
                  priority={i < 6}
                />
              </div>
              <p className="w-[135px] md:w-[270px] text-left font-['Office-Times-Round'] text-[10px] md:text-[17px] text-[#3600cf] tracking-[-0.17px] lowercase leading-[1.2]">
                {card.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
