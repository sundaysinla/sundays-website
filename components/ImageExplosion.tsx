'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'

export default function ImageExplosion() {
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseEnter = () => {
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
  }

  return (
    <div 
      className="relative cursor-pointer w-full text-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link 
        href="https://lu.ma/usc" 
        target="_blank" 
        rel="noopener noreferrer"
        className="inline-block w-full"
      >
        <p className="text-[4em] sm:text-[7em] md:text-[10em] lg:text-[11em] xl:text-[16em] font-['PP-Editorial-New-UltraLightItalic'] italic whitespace-nowrap mb-2 sm:-mb-2 md:-mb-6 lg:-mb-8">
          Join Us
        </p>
      </Link>

      <AnimatePresence>
        {isHovered && [...Array(7)].map((_, i) => {
          // Create a grid with offset
          const column = i % 3
          const row = Math.floor(i / 3)
          
          // Add randomness to base positions - center the distribution
          const baseX = (((column + (row % 2) * 0.5) / 2) - 0.5) * 500  // Reduced from 600 to 500
          const startX = baseX - 100 + (Math.random() - 0.5) * 100  // Offset by -50px to shift left
          
          // Always start from below
          const startY = 200 + (Math.random() * 100) // Start 200-300px below center
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
                width: '150px',
                height: '150px',
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
                  1200  // Final position off-screen
                ],
                x: [
                  startX,
                  startX,
                  startX - 50 + (Math.random() - 0.5) * 400  // Shift left by 50px for final position
                ],
                rotate: rotation,
                scale: [1, 1, 1]
              }}
              transition={{
                duration: 1,
                times: [0, 0.4, 1],
                ease: [0.25, 0.1, 0.25, 1],
                y: {
                  duration: 2,
                  times: [0, 0.3, 1],
                  ease: [0.32, 0, 0.67, 1] // Custom easing for parabolic motion
                },
                x: {
                  duration: 2,
                  times: [0, 0.6, 1],
                  ease: [0.45, 0, 0.55, 1] // Bezier curve for horizontal movement
                }
              }}
            >
              <Image
                src="/smiley.png"
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