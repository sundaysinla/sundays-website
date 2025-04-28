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
import '../styles/grain.css'

// Dynamic import of the 3D model component to avoid SSR issues
const Logo3D = dynamic(() => import('../components/Logo3D'), { ssr: false })

export default function SundaysPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [canHide, setCanHide] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    // Only start the hiding timer after typing is done
    if (canHide) {
      const timer = setTimeout(() => {
        setIsLoading(false)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [canHide])

  // Check window width after mount
  useEffect(() => {
    setIsMobile(window.innerWidth < 500)
    
    const handleResize = () => {
      setIsMobile(window.innerWidth < 500)
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const [headerRef, headerInView] = useInView({ triggerOnce: true, threshold: 0.1 })
  const [logoRef, logoInView] = useInView({ triggerOnce: true, threshold: 0.1 })
  const [textRef, textInView] = useInView({ triggerOnce: true, threshold: 0.1 })
  const imageContainerRef = useRef<HTMLDivElement | null>(null)
  const { ref: inViewRef, inView: imageContainerInView } = useInView({ triggerOnce: true, threshold: 0.1 })
  const [jammingRef, jammingInView] = useInView({ triggerOnce: true, threshold: 0.1 })

  const { scrollYProgress } = useScroll({
    target: imageContainerRef,
    offset: ["start end", "end start"]
  })

  const imageY = useTransform(scrollYProgress, [0, 1], [0, 150])

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
                backgroundImage: i > 0 ? 'linear-gradient(#E2D8FF 4px, transparent 2px)' : 'none',
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
            className={`col-start-8 col-span-2 pt-6 sm:pt-6 md:pt-8 pb-0 lg:py-8 text-xs whitespace-nowrap flex items-center justify-center font-['Monument-Grotesk'] relative z-10`}
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
            className={`col-span-full mt-[-5vh] sm:mt-[-16vh] md:mt-[-4vw] lg:mt-[-8vw] xl:mt-[-15vh] mb-[20vh] sm:mb-[30vh] md:mb-[35vh] lg:mb-[42vh] xl:mb-[50vh]`}
            style={{
              transition: 'all 1s ease-in-out 0.4s',
              opacity: !isLoading && logoInView ? '1' : '0',
              transform: !isLoading && logoInView ? 'translateY(0)' : 'translateY(1rem)',
            }}
          >
            <div style={{ 
              marginLeft: 'calc((100vw - (15 * 1px)) / 16 - min(80px, 6vw))',
              marginRight: 'calc((100vw - (15 * 1px)) / 16 + min(20px, 2vw))',
              width: '100%',
              height: 'clamp(5vh, 14vh, 20vh)',
              position: 'relative',
            }} 
            className="">
              {/* Show static image on mobile, 3D model on larger screens */}
              {isMobile ? (
                <Image
                  src="/sundays-mobile.png"
                  alt="Sundays Logo"
                  fill
                  className="object-contain translate-y-[190%] scale-[1.2]"
                  priority
                />
              ) : (
                <Logo3D />
              )}
            </div>
          </div>


          {/* Text */}
          <div 
            ref={textRef}
            className={`col-span-full pt-[5vh] md:pt-[3vh] lg:pt-[5vh]`}
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
            }} className="mx-[calc((100vw/16)*2)] md:mx-[calc((100vw/16)*5)] lg:mx-[calc((100vw/16)*5)]">
              <p className="text-[1em] sm:text-[0.75em] md:text-[0.9em] lg:text-[1em] font-light font-['Office-Times-Round'] text-[#2A2A24]">
                Every Sunday, we meet for a few hours to work on our passion projects. Whether it's art, coding, poetry, or anything in-between, Sundays is your space to finish that project you've been itching to start.
              </p>
              <div className="mt-12 sm:mt-10 flex justify-center mb-[8vh] sm:mb-[10vh]">
                <Link 
                  href="https://lu.ma/usc" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="bg-black rounded-[8px] md:rounded-[8px] px-3 md:px-4 py-2 text-[0.3em] sm:text-[0.4em] md:text-[0.6em] lg:text-[0.8em] font-['Office-Times-Sharp-Mono'] transition-colors duration-300 ease-out hover:bg-[#EEEBE3] relative overflow-hidden group"
                  style={{
                    textAlign: 'center'
                  }}
                >
                  <span className="inline-block transition-transform duration-300 ease-out group-hover:-translate-y-full text-[#EEEBE3]">
                    JOIN
                  </span>
                  <span className="absolute inset-0 flex items-center justify-center transition-transform duration-500 ease-out translate-y-full group-hover:translate-y-0 text-black">
                    JOIN
                  </span>
                </Link>
              </div>
            </div>
          </div>

          
          {/* Images */}
          <div 
            className="col-span-full mx-[calc((100vw/16)*1)] mt-[-3vh] sm:mb-[5vh] relative overflow-hidden rounded-[100px] grain-container image-gradient"
            ref={setRefs}
          >
            <div 
              className="w-full relative"
              style={{ 
                aspectRatio: '1.8/1',
                opacity: !isLoading ? '1' : '0',
                transform: !isLoading ? 'translateY(0)' : 'translateY(16px)',
                transition: 'opacity 0.6s ease-in-out 1.0s, transform 1.2s ease-in-out 1.0s',
              }}
            >
              <motion.div 
                style={{ y: imageY }}
                className="transform-gpu w-full h-[140%] absolute inset-0"
              >
                <div className="w-full h-full relative" style={{ marginTop: '-25%' }}>
                  <Image
                    src="/bayer-dithered-image.png"
                    alt="Students working together at a table"
                    fill
                    className="object-cover scale-100"
                    sizes="100vw"
                    style={{
                      objectPosition: 'center center'
                    }}
                    priority
                  />
                </div>
              </motion.div>
            </div>
          </div>

          {/* After the image section */}
          <div 
            ref={jammingRef}
            className="col-span-full mt-8 text-center bg-[#F5F4EF] py-64 overflow-hidden"
            style={{
              transition: 'all 1s ease-in-out 0.5s',
              opacity: !isLoading && jammingInView ? '1' : '0',
              transform: !isLoading && jammingInView ? 'translateY(0)' : 'translateY(1rem)'
            }}
          >
            <h2 
              className="text-[12px] md:text-[16px] font-['Monument-Grotesk'] text-[#C0B9A5] mb-8 transition-opacity duration-300"
              style={{ opacity: isHovered ? 0 : 1 }}
            >
              What have we been jamming on?
            </h2>
            
            <div className="mx-[calc((100vw/16)*2)] md:mx-[calc((100vw/16)*4)]">
              <p className="text-[1em] sm:text-[1.5em] md:text-[2em] font-['Office-Times-Sharp-Regular'] text-[#000000]">
                Music production / Font design / AI research / Magic tricks / Writing / 3D modeling / Card game design / Reading fiction / Fashion design / more ...
              </p>
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
                  <h3 className="text-[12px] md:text-[14px] font-['Monument-Grotesk'] text-[#C0B9A5]">Whereabouts</h3>
                  <p className="text-[12px] md:text-[14px] font-['Office-Times-Sharp-Regular']">Every Sunday at 2pm PST, near USC campus</p>
                </div>
              </div>

              <div>
                <div className="grid grid-cols-2 mb-8">
                  <h3 className="text-[12px] md:text-[14px] font-['Monument-Grotesk'] text-[#C0B9A5]">Why we exist</h3>
                  <p className="text-[12px] md:text-[14px] font-['Office-Times-Sharp-Regular']">
                    We want to bring together likeminded people who love to make things, in the company of other creatives
                  </p>
                </div>
              </div>

              <div>
                <div className="grid grid-cols-2 mb-8">
                  <h3 className="text-[12px] md:text-[14px] font-['Monument-Grotesk'] text-[#C0B9A5]">Jam with us</h3>
                  <p className="text-[12px] md:text-[14px] font-['Office-Times-Sharp-Regular']">Register on <Link 
                    href="https://lu.ma/usc" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="underline hover:-translate-y-[2px] inline-block transition-all duration-300 ease-out hover:opacity-100"
                  >
                    Luma
                  </Link>!</p>
                </div>
              </div>

              <div>
                <div className="grid grid-cols-2 mb-24">
                  <h3 className="text-[12px] md:text-[14px] font-['Monument-Grotesk'] text-[#C0B9A5]">IG / X / Linkedin</h3>
                  <p className="text-[12px] md:text-[14px] font-['Office-Times-Sharp-Regular']">@sundaysatusc </p>
                </div>
              </div>

              <div className="text-center transition-transform duration-500 ease-in-out hover:-translate-y-[8px] hover:duration-[1000ms]">
                <ImageExplosion />
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

