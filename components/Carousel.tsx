"use client";

import useEmblaCarousel from "embla-carousel-react";
import Image from "next/image";
import AutoScroll from "embla-carousel-auto-scroll";
import ShuffleText from "@/components/ShuffleText";
import { useInView } from "react-intersection-observer";
import { useEffect, useRef, useState } from "react";

const images = [
  "/carousel1.png",
  "/carousel2.png",
  "/carousel3.png",
  "/carousel4.png",
  "/carousel5.png",
  "/carousel6.png",
];

export default function WhatWeDoCarousel() {
  const [isLoading, setIsLoading] = useState(false);
  const [headerRef, headerInView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [emblaRef] = useEmblaCarousel(
    {
      loop: true,
      dragFree: false,
      containScroll: false,
    },
    [
      AutoScroll({
        speed: 1,
        stopOnInteraction: false,
      }),
    ]
  );

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

      // Position the glow slightly below center
      const circleX = canvas.width / 2;
      const circleY = canvas.height / 1.6 - offset;

      const radiusX = canvas.width * 0.4; // Controls WIDTH (40% of viewport width)
      const radiusY = canvas.height * 0.25; // Controls HEIGHT (50% of viewport height)

      // Save the current context state
      ctx.save();

      // Translate to center point
      ctx.translate(circleX, circleY);

      // Scale to create ellipse (stretch vertically or horizontally)
      ctx.scale(radiusX / radiusY, 1);

      // Create circular gradient at origin
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusY);

      // Center glow (green) → purple edge → offwhite fade
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

      // Restore the context state
      ctx.restore();
    };

    drawGradient();

    const handleScroll = () => requestAnimationFrame(drawGradient);
    const handleResize = () => {
      resizeCanvas();
      drawGradient();
    };

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div className="col-span-full flex flex-col items-center text-center relative">
      <canvas
        ref={canvasRef}
        className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none"
      />

      {/* Header */}
      <div
        ref={headerRef}
        className="col-span-full flex flex-col items-center text-center"
        style={{
          transition: "all 1s ease-in-out 0.2s",
          opacity: !isLoading && headerInView ? "1" : "0",
          transform:
            !isLoading && headerInView ? "translateY(0)" : "translateY(1rem)",
        }}
      >
        <div className="text-xs pt-4 uppercase tracking-wide font-['Monument-Grotesk'] text-[#C0B9A5] mb-8">
          {!isLoading && headerInView ? (
            <ShuffleText text="WHAT WE DO" />
          ) : (
            "WHAT WE DO"
          )}
        </div>

        {/* Main text */}
        <div className="flex flex-col items-center space-y-3 max-w-xl py-6">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-[#C7FF41]" />
            <p className="text-xl md:text-2xl font-serif text-black leading-relaxed">
              we meet every{" "}
              <span className="italic underline decoration-[#C0B9A5]/40">
                sunday
              </span>
            </p>
          </div>

          <p className="text-xl md:text-2xl font-serif text-black leading-relaxed">
            to create whatever it is
          </p>
          <p className="text-xl md:text-2xl font-serif text-black leading-relaxed">
            that makes us feel alive.
          </p>
        </div>
      </div>

      {/* Carousel */}
      <div
        ref={emblaRef}
        className="relative z-10 overflow-hidden w-screen max-w-full mx-auto py-16"
      >
        <div className="flex gap-6 px-8">
          {[...images, ...images].map((src, i) => (
            <div
              key={i}
              className="flex-[0_0_22%] min-w-0 relative aspect-[3/4] overflow-hidden transition-transform duration-300 hover:-translate-y-1"
            >
              <div
                key={i}
                className="flex-[0_0_22%] min-w-0 relative aspect-[3/4] overflow-hidden transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="w-full h-full flex bg-white rounded-2xl shadow-[0_6px_20px_rgba(0,0,0,0.05)] overflow-hidden">
                  <Image
                    src={src}
                    alt={`carousel-${i}`}
                    fill
                    className="object-cover"
                    priority={i < 6}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
