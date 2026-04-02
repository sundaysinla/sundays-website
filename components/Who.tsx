"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";

function PhotoLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const [mounted, setMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const closingRef = useRef(false)
  const scrollYRef = useRef(0)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const handleClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setIsOpen(false)
    setTimeout(() => onCloseRef.current(), 250)
  }, [])

  useEffect(() => {
    setMounted(true)
    scrollYRef.current = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollYRef.current}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsOpen(true))
    })
    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      window.scrollTo(0, scrollYRef.current)
    }
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleClose])

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] isolate flex items-center justify-center p-4"
      style={{ transition: 'opacity 250ms ease-out', opacity: isOpen ? 1 : 0 }}
      onClick={handleClose}
    >
      <div className="absolute inset-0 bg-stone-100/95" />
      <button
        onClick={(e) => { e.stopPropagation(); handleClose() }}
        className="fixed right-4 top-4 z-10 flex h-10 w-10 items-center justify-center hover:scale-110"
        aria-label="Close expanded photo"
        style={{ transition: 'opacity 250ms ease-out, transform 300ms ease-out', opacity: isOpen ? 1 : 0, transform: isOpen ? 'translateY(0)' : 'translateY(-8px)' }}
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1L13 13M1 13L13 1" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <div
        className="relative z-10 flex max-h-[50vh] max-w-[65vw] items-center justify-center"
        style={{ transition: 'opacity 250ms ease-out, transform 300ms cubic-bezier(0.16, 1, 0.3, 1)', opacity: isOpen ? 1 : 0, transform: isOpen ? 'scale(1)' : 'scale(0.92)' }}
      >
        <Image
          src={src}
          alt="Polaroids enlarged"
          width={1200}
          height={1200}
          className="object-contain rounded-sm pointer-events-none"
          style={{ maxWidth: '65vw', maxHeight: '50vh' }}
          draggable={false}
        />
      </div>
    </div>,
    document.body
  )
}

export default function Who() {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [inView, setInView] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect() } },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={sectionRef} className="text-[#3A372F] bg-[#F5F4EF]/80 py-56 md:py-40 lg:py-48 px-6 md:px-12 lg:px-16 relative overflow-hidden">
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
                  ? "linear-gradient(#e7e5e4 4px, transparent 2px)"
                  : "none",
              backgroundSize: "1px 12px",
              backgroundPosition: "left top",
              backgroundRepeat: "repeat-y",
            }}
          />
        ))}
      </div>
      {lightboxSrc && <PhotoLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      {/* Left polaroid cluster */}
      <div
        className="absolute -left-4 -bottom-6 w-[75%] md:w-[38%] max-w-[560px] select-none cursor-pointer z-20"
        style={{
          transform: inView ? 'translate(0, 0) rotate(0deg)' : 'translate(-120%, 40%) rotate(-45deg)',
          opacity: inView ? 1 : 0,
          transition: 'transform 1s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.6s ease-out',
        }}
        onClick={() => setLightboxSrc('/polaroids-full.png')}
      >
        <div className="transition-transform duration-300 ease-out hover:scale-[1.01]">
          <Image
            src="/polaroids-right.png"
            alt="Polaroid photos"
            width={960}
            height={640}
            className="w-full h-auto drop-shadow-[0_2px_6px_rgba(120,113,108,0.25)]"
          />
        </div>
      </div>

      {/* Right polaroid cluster */}
      <div
        className="absolute -right-4 -top-4 w-[75%] md:w-[38%] max-w-[560px] select-none cursor-pointer z-20"
        style={{
          transform: inView ? 'translate(0, 0) rotate(0deg)' : 'translate(120%, -40%) rotate(45deg)',
          opacity: inView ? 1 : 0,
          transition: 'transform 1s cubic-bezier(0.16, 1, 0.3, 1) 0.15s, opacity 0.6s ease-out 0.15s',
        }}
        onClick={() => setLightboxSrc('/polaroids-full-2.png')}
      >
        <div className="transition-transform duration-300 ease-out hover:scale-[1.01]">
          <Image
            src="/polaroids-left.png"
            alt="Polaroid photos"
            width={960}
            height={780}
            className="w-full h-auto drop-shadow-[0_2px_6px_rgba(120,113,108,0.25)]"
          />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10">
        <div className="text-center mb-8">
          <p className="text-sm uppercase text-[#C0B9A5] font-['ABC Monument Grotesk Unlicensed Trial']">
            Who we are
          </p>
        </div>

        <div className="flex flex-col items-center text-center space-y-0 md:space-y-1 max-w-4xl mx-auto py-6">
          <p className="text-lg md:text-2xl lg:text-3xl font-['Office-Times-Sharp-Regular'] text-black leading-snug">
            <span className="text-[#C0B9A5]">⁂ ​​</span>this is a home for the
          </p>

          <p className="text-lg md:text-2xl lg:text-3xl font-['Office-Times-Sharp-Regular'] text-black leading-snug">
            <span className="italic">makers</span>, artists, filmmakers,
          </p>
          <p className="text-lg md:text-2xl lg:text-3xl font-['Office-Times-Sharp-Regular'] text-black leading-snug">
            learners, researchers, creatives,
          </p>
          <p className="text-lg md:text-2xl lg:text-3xl font-['Office-Times-Sharp-Regular'] text-black leading-snug">
            founders, movers, <span className="text-[#C0B9A5]">&</span> shakers.
          </p>
          
          <p className="text-sm md:text-base font-sans text-stone-600 leading-relaxed pt-8 max-w-[220px] md:max-w-none mx-auto">
            sundays is a node of <Link href="https://socratica.info/" target="_blank" rel="noopener noreferrer" className="text-[#C0B9A5] underline decoration-dotted decoration-[#C0B9A5]/40 underline-offset-[3px] hover:text-[#8a7f6b] hover:decoration-solid hover:decoration-[#8a7f6b]/60 transition-all duration-300">Socratica</Link>, a global creative community.
          </p>
        </div>
      </div>
    </section>
  );
}
