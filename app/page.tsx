'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from "next/image"
import Link from "next/link"
import dynamic from 'next/dynamic'
import { useInView } from 'react-intersection-observer'
import { useScroll, motion, useTransform } from 'framer-motion'
import LoadingScreen from '@/components/LoadingScreen'
import ScatterText from '@/components/ScatterText'
import ShuffleText from '@/components/ShuffleText'
import ImageExplosion from '@/components/ImageExplosion'

// Dynamic import of the 3D model component to avoid SSR issues
const Logo3D = dynamic(() => import('../components/Logo3D'), { ssr: false })

export default function SundaysPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [canHide, setCanHide] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  
  useEffect(() => {
    // Only start the hiding timer after typing is done
    if (canHide) {
      const timer = setTimeout(() => {
        setIsLoading(false)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [canHide])

  const [headerRef, headerInView] = useInView({ triggerOnce: true, threshold: 0.1 })
  const [logoRef, logoInView] = useInView({ triggerOnce: true, threshold: 0.1 })
  const [textRef, textInView] = useInView({ triggerOnce: true, threshold: 0.1 })
  const imageContainerRef = useRef<HTMLDivElement | null>(null)
  const { ref: inViewRef, inView: imageContainerInView } = useInView({ triggerOnce: true, threshold: 0.1 })

  const { scrollYProgress } = useScroll({
    target: imageContainerRef,
    offset: ["start end", "end start"]
  })

  const imageY = useTransform(scrollYProgress, [0, 1], [0, 100])

  // Combine refs using callback ref
  const setRefs = useCallback((node: HTMLDivElement | null) => {
    imageContainerRef.current = node
    inViewRef(node)
  }, [inViewRef])

  return (
    <>
      <LoadingScreen isLoading={isLoading} onTypingDone={() => setCanHide(true)} />
      <div className={`min-h-screen relative overflow-hidden transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
        {/* Grid lines */}
        <div 
          className="absolute inset-0" 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(16, calc(100vw / 16))',
            gap: 0,
            background: 'transparent',
          }}
        >
          {[...Array(16)].map((_, i) => (
            <div 
              key={i} 
              className="h-full bg-[#FEFDFB]" 
              style={{
                backgroundImage: i > 0 ? 'linear-gradient(hsla(30, 6%, 90%, 1) 4px, transparent 2px)' : 'none',
                backgroundSize: '1px 12px',
                backgroundPosition: 'left top',
                backgroundRepeat: 'repeat-y'
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div 
          className="relative"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(16, calc((100vw - (15 * 1px)) / 16))',
            gap: '1px',
            gridTemplateRows: 'auto auto 1fr' // Header, Logo, Content rows
          }}
        >
          {/* Header */}
          <div 
            ref={headerRef}
            className={`col-start-8 col-span-2 py-2 md:py-8 text-xs whitespace-nowrap flex items-center justify-center font-['Office-Times-Sharp-Mono'] relative z-10`}
            style={{
              transition: 'all 1s ease-in-out 0.2s',
              opacity: !isLoading && headerInView ? '1' : '0',
              transform: !isLoading && headerInView ? 'translateY(0)' : 'translateY(1rem)'
            }}
          >
            {!isLoading && headerInView ? (
              <ShuffleText text="SUNDAYS AT USC" />
            ) : (
              "SUNDAYS AT USC"
            )}
          </div>
          
          {/* <div className="col-start-10 col-span-6 py-8"></div> */}

          {/* Logo row */}
          <div 
            ref={logoRef}
            className={`col-span-full mt-[-5vh] sm:mt-[-20vh] md:mt-[-15vh] lg:mt-[-8vh] xl:mt-[-16vh] mb-[20vh] sm:mb-[30vh] md:mb-[35vh] lg:mb-[50vh]`}
            style={{
              transition: 'all 1s ease-in-out 0.4s',
              opacity: !isLoading && logoInView ? '1' : '0',
              transform: !isLoading && logoInView ? 'translateY(0)' : 'translateY(1rem)',
            }}
          >
            <div style={{ 
              marginLeft: 'calc((100vw - (15 * 1px)) / 16 - min(100px, 8vw))',
              marginRight: 'calc((100vw - (15 * 1px)) / 16)',
              width: '100%',
              height: 'clamp(10vh, 15vh, 20vh)', // Make height responsive
              position: 'relative',
            }} 
            className="">
              <Logo3D />
            </div>
          </div>


          {/* Text */}
          <div 
            ref={textRef}
              className={`col-span-full`}
            style={{
              transition: 'all 1s ease-in-out 0.6s',
              opacity: !isLoading && textInView ? '1' : '0',
              transform: !isLoading && textInView ? 'translateY(0)' : 'translateY(1rem)'
            }}
          >
            <div style={{ 
              // maxWidth: '600px',
              textAlign: 'center',
              padding: '0 0px'
            }} className="mx-[calc((100vw/16)*2)] md:mx-[calc((100vw/16)*3)] lg:mx-[calc((100vw/16)*5)]">
              <p className="text-[0.75em] sm:text-[0.75em] md:text-[1em] font-light font-['Office-Times-Sharp-Mono'] text-[#2A2A24]">
                Every Sunday, we meet for a few hours to work on our passion projects. Whether it's art, coding, poetry, or anything in-between, Sundays is a space carved out for deep work so you can finish that project you've been itching to start.
              </p>
              <div className="mt-8 flex justify-center mb-[6vh]">
                <Link 
                  href="https://lu.ma/usc" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="border border-black rounded-[12px] px-6 py-3 text-[0.75em] font-['Office-Times-Sharp-Mono'] transition-colors duration-300 ease-out hover:bg-black relative overflow-hidden group"
                >
                  <span className="inline-block transition-transform duration-300 ease-out group-hover:-translate-y-full">
                    JOIN
                  </span>
                  <span className="absolute inset-0 flex items-center justify-center transition-transform duration-500 ease-out translate-y-full group-hover:translate-y-0 text-white">
                    JOIN
                  </span>
                </Link>
              </div>
            </div>
          </div>

          
          {/* Images */}
          <div 
            className="col-span-full mx-[calc((100vw/16)*1)] mt-[2vh] mb-[6vh]"
            ref={setRefs}
            style={{ 
              clipPath: 'ellipse(50% 50% at 50% 50%)',
              position: 'relative',
              overflow: 'hidden',
              opacity: !isLoading ? '1' : '0',
              transition: 'opacity 0.8s ease-in-out 1.2s'
            }}
          >
            <motion.div 
              style={{ y: imageY }} 
              className="transform-gpu"
              initial={{ y: -100 }}  // Start with image shifted up
            >
              <Image
                src="/students.png"
                alt="Students working together at a table"
                width={1200}
                height={1400}
                className="w-full scale-[1] origin-top"
                style={{
                  objectFit: 'cover',
                  objectPosition: 'center 30%',
                  transformOrigin: 'top center',
                  marginTop: '-75px'
                }}
                priority
              />
            </motion.div>
          </div>

          {/* After the image section */}
          <div className="col-span-full mt-8 text-center bg-[#F7F6F2] py-64 overflow-hidden">
            <h2 
              className="text-[12px] md:text-[14px] font-['Office-Times-Sharp-Mono'] text-[#999] mb-8 transition-opacity duration-500"
              style={{ opacity: isHovered ? 0 : 1 }}
            >
              What have we been jamming on?
            </h2>
            
            <div className="mx-[calc((100vw/16)*2)] md:mx-[calc((100vw/16)*4)]">
              <ScatterText 
                text="Music production / Font creation / AI research / Website design / Medical software / Magic tricks / Reading fiction / Writing articles / 3D modeling / Making card games"
                onHoverChange={(hovering) => setIsHovered(hovering)}
                className="text-[1em] sm:text-[1.5em] md:text-[2em]"
              />
            </div>
          </div>

          {/* What is Sundays Section */}
          <div className="col-span-full mt-24">
            <div className="space-y-8 mx-[calc((100vw/16)*2)] md:mx-[calc((100vw/16)*4)]">
              {/* Commented section here */}
            </div>
          </div>

          {/* Footer */}
          <div className="col-span-full mt-8">
            <div className="space-y-0 mx-[calc((100vw/16)*2)] md:mx-[calc((100vw/16)*4)]">
              <div>
                <div className="grid grid-cols-2 mb-8">
                  <h3 className="text-[12px] md:text-[14px] font-['Monument-Grotesk'] text-[#C3C2BB]">Whereabouts</h3>
                  <p className="text-[12px] md:text-[14px] font-['Office-Times-Sharp-Mono']">Every Sunday at 2pm PST, near USC campus</p>
                </div>
              </div>

              <div>
                <div className="grid grid-cols-2 mb-8">
                  <h3 className="text-[12px] md:text-[14px] font-['Monument-Grotesk'] text-[#C3C2BB]">Why we exist</h3>
                  <p className="text-[12px] md:text-[14px] font-['Office-Times-Sharp-Mono']">
                    We want to bring together likeminded people who love to make things, in the company of other creatives
                  </p>
                </div>
              </div>

              <div>
                <div className="grid grid-cols-2 mb-8">
                  <h3 className="text-[12px] md:text-[14px] font-['Monument-Grotesk'] text-[#C3C2BB]">Jam with us</h3>
                  <p className="text-[12px] md:text-[14px] font-['Office-Times-Sharp-Mono']">Register on <Link href="https://lu.ma/usc" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-60 transition-opacity">Luma</Link>!</p>
                </div>
              </div>

              <div>
                <div className="grid grid-cols-2 mb-24">
                  <h3 className="text-[12px] md:text-[14px] font-['Monument-Grotesk'] text-[#C3C2BB]">IG / X / Linkedin</h3>
                  <p className="text-[12px] md:text-[14px] font-['Office-Times-Sharp-Mono']">@sundaysatusc </p>
                </div>
              </div>

              <div className="text-center">
                <ImageExplosion />
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

