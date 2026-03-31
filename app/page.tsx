"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useInView } from "react-intersection-observer";
import { useScroll, motion, useTransform } from "framer-motion";
import LoadingScreen from "@/components/LoadingScreen";
import NavBar from "@/components/NavBar";
import DraggablePhotos from "@/components/DraggablePhotos";
import Carousel from "@/components/Carousel";
import ShuffleText from "@/components/ShuffleText";
import ImageExplosion from "@/components/ImageExplosion";
import Team from "@/components/Team";
import Projects from "@/components/Projects";
import Who from "@/components/Who";
import "../styles/grain.css";

const Logo3D = dynamic(() => import("../components/Logo3D"), { ssr: false });

export default function SundaysPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [canHide, setCanHide] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (canHide) {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [canHide]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(
        window.innerWidth < 500 ||
          /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
          )
      );
    };

    checkMobile();

    window.addEventListener("resize", checkMobile);
    window.addEventListener("orientationchange", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
      window.removeEventListener("orientationchange", checkMobile);
    };
  }, []);

  const [headerRef, headerInView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });
  const [logoRef, logoInView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });
  const [textRef, textInView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });
  const imageContainerRef = useRef<HTMLDivElement | null>(null);
  const { ref: inViewRef, inView: imageContainerInView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const { scrollYProgress } = useScroll({
    target: imageContainerRef,
    offset: ["start end", "end start"],
  });

  const imageY = useTransform(scrollYProgress, [0, 1], [0, 150]);

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      imageContainerRef.current = node;
      inViewRef(node);
    },
    [inViewRef]
  );

  return (
    <>
      {/* Loading screen removed */}
      <NavBar></NavBar>
      <div
        className={`min-h-screen relative overflow-x-clip overflow-y-visible transition-opacity duration-500 ${isLoading ? "opacity-0" : "opacity-100"}`}
      >
        {/* Grid lines */}
        <div
          className="fixed inset-0 -z-10 pointer-events-none grid grid-cols-8 md:grid-cols-[repeat(16,1fr)]"
        >
          {[...Array(16)].map((_, i) => (
            <div
              key={i}
              className={`h-full ${i >= 8 ? 'hidden md:block' : ''}`}
              style={{
                backgroundImage:
                  i > 0
                    ? "linear-gradient(#f5f5f4 4px, transparent 2px)"
                    : "none",
                backgroundSize: "1px 12px",
                backgroundPosition: "left top",
                backgroundRepeat: "repeat-y",
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div
          className="relative"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(16, 1fr)",
            gridTemplateRows: "auto auto 1fr",
          }}
        >
          {/* Header */}
          <div
            ref={headerRef}
            className={`col-start-8 col-span-2 pt-2 sm:pt-3 pb-0 sm:pb-0 text-sm whitespace-nowrap flex items-center justify-center font-['Monument-Grotesk'] relative z-10 text-[#C0B9A5]`}
            style={{
              transition: "all 1s ease-in-out 0.2s",
              opacity: !isLoading && headerInView ? "1" : "0",
              transform:
                !isLoading && headerInView
                  ? "translateY(0)"
                  : "translateY(1rem)",
            }}
          >
            {!isLoading && headerInView ? (
              <ShuffleText text="SUNDAYS IN LA" />
            ) : (
              "SUNDAYS IN LA"
            )}
          </div>

          {/* Logo row */}
          <div
            className="col-span-full py-8 sm:py-4 sm:-mb-4 md:-mb-3"
            style={{
              opacity: !isLoading ? "1" : "0",
              transition: "opacity 0.4s ease-in-out",
            }}
          >
            <div
              className="w-full relative"
              style={{
                height: isMobile ? "auto" : "clamp(160px, 24vw, 420px)",
              }}
            >
              {isMobile ? (
                <div
                  className="w-full h-full flex items-center justify-center"
                >
                  <Image
                    src="/sundays-mobile.png"
                    alt="Sundays Logo"
                    width={300}
                    height={100}
                    className="w-[85%] h-auto object-contain"
                    priority
                    sizes="100vw"
                  />
                </div>
              ) : (
                <Logo3D />
              )}
            </div>
          </div>

          {/* Text */}
          <div
            ref={textRef}
            className={`col-span-full mt-4 sm:mt-4 md:mt-0`}
            style={{
              transition: "all 1s ease-in-out 0.6s",
              opacity: !isLoading && textInView ? "1" : "0",
              transform:
                !isLoading && textInView ? "translateY(0)" : "translateY(1rem)",
            }}
          >
            <div
              className="mx-auto w-full sm:max-w-[50%] md:max-w-[40%] lg:max-w-[30%] xl:max-w-[28%] flex flex-col items-center"
            >
              <p className="text-base md:text-[0.9em] lg:text-[1em] font-light font-['Office-Times-Round'] text-[#2A2A24] pt-0 sm:whitespace-nowrap text-center leading-relaxed">
                A home for the passions that excite you.<br />Weekly coworking sessions, every Sunday.
              </p>
              <div className="mt-12 sm:mt-10 flex justify-center mb-2 sm:mb-1 relative z-20">
                <Link
                  href="https://luma.com/sundaysinla"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-black rounded-xl px-4 pt-2 pb-1.5 text-sm md:text-[0.8em] lg:text-[0.9em] font-['Monument-Grotesk'] uppercase transition-colors duration-300 ease-out hover:bg-[#EEEBE3] relative overflow-hidden group"
                  style={{
                    textAlign: "center",
                    cornerShape: "squircle",
                  } as React.CSSProperties}
                >
                  <span className="inline-block transition-transform duration-300 ease-out group-hover:-translate-y-full text-[#EEEBE3]">
                    ATTEND A SESSION
                  </span>
                  <span className="absolute inset-0 flex items-center justify-center transition-transform duration-500 ease-out translate-y-full group-hover:translate-y-0 text-black">
                    ATTEND A SESSION
                  </span>
                </Link>
              </div>
            </div>

            <DraggablePhotos />
          </div>

          {/* Images */}
          <div
            className="col-span-full mx-[calc((100vw/16)*1)] mt-[-3vh] sm:mb-[5vh] relative overflow-hidden"
            style={{
              borderRadius: "min(4vw, 100px)",
            }}
            ref={setRefs}
          ></div>

          {/* After the image section */}
          <div
            className="col-span-full text-center pt-32 overflow-x-clip overflow-y-visible"
          >

            <div id="about">
              <Carousel></Carousel>
            </div>

            <div>
              <Who></Who>
            </div>
            
            <div id="projects">
              <Projects></Projects>
            </div>

            <div id="team" className="bg-[#FCFAF7]/80">
              <Team></Team>
            </div>
          </div>

          {/* Footer */}
          <div className="col-span-full pt-32 overflow-hidden">
            <div className="space-y-0 mx-[calc((100vw/16)*3)] md:mx-[calc((100vw/16)*4)]">
              <div>
                <div className="grid grid-cols-2 mb-8">
                  <h3 className="text-sm md:text-base font-['Monument-Grotesk'] text-[#C0B9A5]">
                    Whereabouts
                  </h3>
                  <p className="text-sm md:text-base font-['Office-Times-Sharp-Regular']">
                    Every Sunday at 2pm PST near USC or UCLA campus
                  </p>
                </div>
              </div>

              <div>
                <div className="grid grid-cols-2 mb-8">
                  <h3 className="text-sm md:text-base font-['Monument-Grotesk'] text-[#C0B9A5]">
                    Why we exist
                  </h3>
                  <p className="text-sm md:text-base font-['Office-Times-Sharp-Regular']">
                    We want to bring together likeminded people who love to make
                    things, in the company of other creatives
                  </p>
                </div>
              </div>

              <div>
                <div className="grid grid-cols-2 mb-8">
                  <h3 className="text-sm md:text-base font-['Monument-Grotesk'] text-[#C0B9A5]">
                    Jam with us
                  </h3>
                  <p className="text-sm md:text-base font-['Office-Times-Sharp-Regular']">
                    Register on{" "}
                    <Link
                      href="https://lu.ma/sundaysinla"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#C0B9A5] font-['Office-Times-Sharp-Regular'] hover:-translate-y-[2px] inline-block transition-all duration-300 ease-out hover:opacity-100"
                    >
                      Luma
                    </Link>
                    !
                  </p>
                </div>
              </div>

              <div>
                <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4 sm:gap-0 mb-24">
                  <h3 className="text-sm md:text-base font-['Monument-Grotesk'] text-[#C0B9A5]">
                    Find us
                  </h3>
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center gap-6 md:gap-8">
                      <Link
                        href="https://x.com/sundaysinla"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-50 hover:opacity-100 transition-opacity duration-300"
                      >
                        <img
                          src="/x.png"
                          alt="X Logo"
                          className="w-[20px] h-auto md:w-[16px] shrink-0"
                        />
                      </Link>

                      <Link
                        href="https://www.linkedin.com/company/sundays-at-usc/posts/?feedView=all"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-50 hover:opacity-100 transition-opacity duration-300"
                      >
                        <img
                          src="/linkedin.png"
                          alt="LinkedIn Logo"
                          className="w-[20px] h-auto md:w-[16px] shrink-0"
                        />
                      </Link>

                      <Link
                        href="https://www.instagram.com/sundaysnla"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-50 hover:opacity-100 transition-opacity duration-300"
                      >
                        <img
                          src="/instagram.png"
                          alt="Instagram Logo"
                          className="w-[20px] h-auto md:w-[16px] shrink-0"
                        />
                      </Link>

                      <Link
                        href="https://luma.com/sundaysinla"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-50 hover:opacity-100 transition-opacity duration-300 -ml-1 md:-ml-1.25"
                      >
                        <svg viewBox="0 0 133 134" fill="none" xmlns="http://www.w3.org/2000/svg" width={20} height={20}>
                          <path d="M133 67C96.2822 67 66.5 36.9939 66.5 0C66.5 36.9939 36.7178 67 0 67C36.7178 67 66.5 97.0061 66.5 134C66.5 97.0061 96.2822 67 133 67Z" fill="#C0B9A5"/>
                        </svg>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

            </div>

              <div className="text-center flex justify-center transition-transform duration-500 ease-in-out hover:-translate-y-[8px] hover:duration-[1000ms]">
                <ImageExplosion />
              </div>
          </div>
        </div>
      </div>
    </>
  );
}
