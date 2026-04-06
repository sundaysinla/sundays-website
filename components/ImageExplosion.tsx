'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

export default function ImageExplosion() {
  const [isHovered, setIsHovered] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 950)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const images = [
    '/camera.png',
    '/laptop.png',
    '/notebook.png',
    '/paintbrush.png',
    '/keyboard.png',
    '/figma.png'
  ]

  const handleTap = () => {
    if (!isMobile) return
    setIsHovered(false)
    requestAnimationFrame(() => {
      setIsHovered(true)
      setTimeout(() => setIsHovered(false), 3500)
    })
  }

  const textEl = (
    <p className="text-7xl sm:text-9xl md:text-[12rem] lg:text-[16rem] xl:text-[20rem] font-['PP-Editorial-New-UltraLightItalic'] italic whitespace-nowrap mb-2 sm:-mb-2 md:-mb-6 lg:-mb-8 leading-[0.85]">
      Join Us
    </p>
  )

  return (
    <div 
      className="relative cursor-pointer w-full text-center"
      onMouseEnter={() => !isMobile && setIsHovered(true)}
      onMouseLeave={() => !isMobile && setIsHovered(false)}
      onClick={handleTap}
      onTouchEnd={(e) => { e.preventDefault(); handleTap(); }}
    >
      <span className="inline-block w-full">{textEl}</span>

      <AnimatePresence>
        {isHovered && [...Array(isMobile ? 14 : 7)].map((_, i) => {
          // Randomly select an image for each instance
          const randomImage = images[Math.floor(Math.random() * images.length)]
          
          // Create a grid with offset
          const column = i % 3
          const row = Math.floor(i / 3)
          
          // Add randomness to base positions - center the distribution
          const baseX = (((column + (row % 2) * 0.5) / 2) - 0.5) * 800  // Increased from 500 to 800
          const startX = baseX - 200 + (Math.random() - 0.5) * 300  // Increased random offset
          
          // Always start from below with more variation
          const startY = 150 + (Math.random() * 200) // More varied starting height
          const baseHeight = -50 - (row * 30)
          
          // Make a few smileys shoot much higher - randomly selected
          const isHighFlyer = Math.random() < 0.3; // 30% chance for any smiley to be a high flyer
          const peakHeight = isHighFlyer 
            ? baseHeight - 200 - Math.random() * 150 // Much higher peak for selected smileys
            : baseHeight - Math.random() * 150;      // Normal height for others
            
          const rotation = Math.random() * 360
          
          return (
            <motion.div
              key={i}
              className="absolute left-1/2 top-1/2"
              style={{
                width: isMobile ? '100px' : '200px',
                height: isMobile ? '100px' : '200px',
                // transform: 'translate(-50%, -50%)'
              }}
              initial={{ 
                scale: 1,
                y: startY,
                x: startX,
                rotate: rotation
              }}
              animate={{ 
                y: [
                  startY,
                  peakHeight,
                  1500 + (Math.random() * 300)
                ],
                x: [
                  startX,
                  startX + (Math.random() - 0.5) * 400,
                  startX - 200 + (Math.random() - 0.5) * 1000
                ],
                rotate: [
                  0,
                  rotation * 0.2,  // Reduced from 3 to 0.5
                  rotation * 1   // Reduced from 5 to 1.5
                ],
                // scale: [1, 1.3, 0.8]
              }}
              transition={{
                duration: isMobile ? 3.2 : 2.3,
                times: [0, 0.4, 1],
                ease: [0.25, 0.1, 0.25, 1],
                y: {
                  duration: isMobile ? 3.2 : 2.3,
                  times: [0, 0.3, 1],
                  ease: [0.32, 0, 0.67, 1]
                },
                x: {
                  duration: isMobile ? 3.2 : 2.3,
                  times: [0, 0.5, 1],
                  ease: [0.45, 0, 0.55, 1]
                }
              }}
            >
              <Image
                src={randomImage}
                alt=""
                fill
                className="object-contain"
              />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
} 