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
  const [isLoading, setIsLoading] = useState(true);
  const [canHide, setCanHide] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("sundays-greeted") === "1") {
      setCanHide(true);
    }
  }, []);

  useEffect(() => {
    if (canHide) {
      const timer = setTimeout(() => {
        setIsLoading(false);
        sessionStorage.setItem("sundays-greeted", "1");
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
      <LoadingScreen isLoading={isLoading} onTypingDone={() => setCanHide(true)} />
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
                        className="transition-all duration-300 [&_svg]:fill-[#C0B9A5] hover:[&_svg]:fill-[#8a8478]"
                      >
                        <svg viewBox="0 0 24 24" fill="#C0B9A5" className="w-[16px] h-[16px] shrink-0" aria-label="X">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                      </Link>

                      <Link
                        href="https://www.linkedin.com/company/sundays-at-usc/posts/?feedView=all"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-all duration-300 [&_svg]:fill-[#C0B9A5] hover:[&_svg]:fill-[#8a8478]"
                      >
                        <svg viewBox="0 0 24 24" fill="#C0B9A5" className="w-[16px] h-[16px] shrink-0" aria-label="LinkedIn">
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                        </svg>
                      </Link>

                      <Link
                        href="https://www.instagram.com/sundaysnla"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-all duration-300 [&_svg]:fill-[#C0B9A5] hover:[&_svg]:fill-[#8a8478]"
                      >
                        <svg viewBox="0 0 24 24" fill="#C0B9A5" className="w-[16px] h-[16px] shrink-0" aria-label="Instagram">
                          <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 100 12.324 6.162 6.162 0 100-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 11-2.88 0 1.441 1.441 0 012.88 0z" />
                        </svg>
                      </Link>

                      <Link
                        href="https://luma.com/sundaysinla"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-all duration-300 -ml-0.5 [&_svg_path]:fill-[#C0B9A5] hover:[&_svg_path]:fill-[#8a8478]"
                      >
                        <svg viewBox="0 0 133 134" fill="none" xmlns="http://www.w3.org/2000/svg" width={18} height={18}>
                          <path d="M133 67C96.2822 67 66.5 36.9939 66.5 0C66.5 36.9939 36.7178 67 0 67C36.7178 67 66.5 97.0061 66.5 134C66.5 97.0061 96.2822 67 133 67Z" fill="#C0B9A5"/>
                        </svg>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

            </div>

              <div className="text-center flex justify-center transition-transform duration-500 ease-in-out hover:-translate-y-[8px] hover:duration-[1000ms] pt-16 md:pt-24 pb-12 md:pb-16">
                <ImageExplosion />
              </div>
          </div>
        </div>
      </div>
    </>
  );
}
