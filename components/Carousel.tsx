"use client";

import Image from "next/image";
import ShuffleText from "@/components/ShuffleText";
import { useInView } from "react-intersection-observer";
import { useEffect, useRef } from "react";

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();

    const drawGradient = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const scrollY = window.scrollY;
      const offset =
        (scrollY / document.body.scrollHeight) * canvas.height * 1.5;

      const circleX = canvas.width / 2;
      const circleY = canvas.height / 1.6 - offset;

      const radiusX = canvas.width * 0.4;
      const radiusY = canvas.height * 0.25;

      ctx.save();
      ctx.translate(circleX, circleY);
      ctx.scale(radiusX / radiusY, 1);

      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusY);
      gradient.addColorStop(0.03, "#BDFF004D");
      gradient.addColorStop(0.25, "#907CFF26");
      gradient.addColorStop(0.7, "#F3F2EC00");

      ctx.fillStyle = gradient;
      ctx.fillRect(
        -canvas.width,
        -canvas.height,
        canvas.width * 2,
        canvas.height * 2
      );

      ctx.restore();
    };

    drawGradient();

    const handleScroll = () => requestAnimationFrame(drawGradient);
    const handleResize = () => { resizeCanvas(); drawGradient(); };

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const doubled = [...cards, ...cards];

  return (
    <div className="col-span-full flex flex-col items-center text-center relative py-32 bg-stone-50">
      <canvas
        ref={canvasRef}
        className="fixed top-0 left-0 w-full h-full z-0 pointer-events-none"
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
        <div className="flex flex-col items-center space-y-3 max-w-xl py-4">
          <div className="flex items-center gap-3">
            <div className="relative w-6 h-6 translate-y-[1px]">
              <div className="absolute inset-0 rounded-full bg-[#C7FF41] animate-[glow-pulse_6s_ease-in-out_infinite]" />
              <div className="relative w-full h-full rounded-full bg-[#C7FF41]" />
            </div>
            <p className="text-xl md:text-3xl lg:text-4xl font-serif font-thin text-black leading-relaxed">
              we meet every <span className="text-stone-400">sunday</span>
            </p>
          </div>

          <p className="text-xl md:text-3xl lg:text-4xl font-serif font-thin text-black leading-relaxed">
            to create whatever it is
          </p>
          <p className="text-xl md:text-3xl lg:text-4xl font-serif font-thin text-black leading-relaxed">
            that makes us feel alive.
          </p>
        </div>
      </div>

      {/* Carousel */}
      <div className="relative z-10 overflow-hidden w-screen max-w-full mx-auto pt-10 pb-4">
        <div
          className="flex gap-12 px-8 w-max animate-carousel"
          style={{ animationDuration: `${doubled.length * 4}s` }}
        >
          {[...doubled, ...doubled].map((card, i) => (
            <div
              key={i}
              className="flex-shrink-0 flex flex-col gap-8 items-center justify-center p-6 rounded-lg overflow-clip transition-transform duration-300 ease-out hover:-translate-y-3"
              style={{
                background: 'rgba(255,255,255,0.5)',
                boxShadow: '0px 4px 12px 0px rgba(0,0,0,0.05)',
                borderRadius: '26px',
                cornerShape: 'squircle',
              } as React.CSSProperties}
            >
              <div className="relative w-[270px] h-[270px] shrink-0 flex items-center justify-center overflow-hidden">
                <Image
                  src={card.image}
                  alt={card.label}
                  width={270}
                  height={270}
                  className="object-contain max-w-full max-h-full"
                  priority={i < 6}
                />
              </div>
              <p className="w-[270px] text-left font-['Office-Times-Round'] text-[17px] text-[#3600cf] tracking-[-0.17px] lowercase leading-[1.2]">
                {card.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
