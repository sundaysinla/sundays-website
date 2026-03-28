'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'

export default function ImageExplosion() {
  const [isHovered, setIsHovered] = useState(false)

  // Array of image options
  const images = [
    '/camera.png',
    '/laptop.png',
    '/notebook.png',
    '/paintbrush.png',
    '/keyboard.png',
    '/figma.png'
  ]

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
        href="https://luma.com/sundaysinla"
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
                width: '200px',
                height: '200px',
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
                duration: 2.3,  // Increased duration
                times: [0, 0.4, 1],
                ease: [0.25, 0.1, 0.25, 1],
                y: {
                  duration: 2.3,
                  times: [0, 0.3, 1],  // Adjusted timing
                  ease: [0.32, 0, 0.67, 1]
                },
                x: {
                  duration: 2.3,
                  times: [0, 0.5, 1],  // Adjusted for smoother horizontal movement
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