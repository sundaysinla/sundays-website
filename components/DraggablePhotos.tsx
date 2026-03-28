'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import React, { useState, useEffect } from 'react'
import { useInView } from 'react-intersection-observer'

// image list
const images = [
  '/polaroid1.png',
  '/polaroid2.png',
  '/polaroid3.png',
  '/polaroid4.png',
  '/polaroid5.png'
]

//photo
const photoLayout = [
    { width: 335, height: 285, rotate: 10.42, offsetX: -450, offsetY: 80, z: 14},
    { width: 224, height: 343, rotate: 0, offsetX: -250, offsetY: 10, z: 1 },
    { width: 330, height: 280, rotate: -5.89, offsetX: -30, offsetY: 60, z: 5 },
    { width: 240, height: 350, rotate: 4.23, offsetX: 240, offsetY: 20, z: 2},
    { width: 334, height: 276, rotate: 10.34, offsetX: 500, offsetY: 45, z: 3 },
  ]

const BASE_WIDTH = 1200
const TOTAL_DURATION = 0.4
const STAGGER = TOTAL_DURATION / 5

export default function DraggablePhotos() {
  const [positions, setPositions] = useState<Record<number, { x: number; y: number }>>({})
  const { ref: sectionRef, inView } = useInView({ triggerOnce: true, threshold: 0.2 })
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const update = () => setScale(Math.min(1, window.innerWidth / BASE_WIDTH))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const [topLayer, setTopLayer] = useState<number | null>(null)
  const [layerOrder, setLayerOrder] = useState<number[]>(images.map((_, i) => i))

  const bringToFront = (index: number) => {
    setLayerOrder((prev) => {
      const newOrder = prev.filter((i) => i !== index)
      return [...newOrder, index]
    })
    setTopLayer(index)
  }

  const handleDragEnd = (index: number, _event: any, info: any) => {
    setPositions((prev) => ({
      ...prev,
      [index]: {
        x: info.point.x - window.innerWidth / 2,
        y: info.point.y - window.innerHeight / 2,
      },
    }))
    setTopLayer(null)
  }

  return (
    <section ref={sectionRef} className="relative w-full flex items-center justify-center overflow-visible -mt-8">
      <div className="relative w-full max-w-[1200px] flex items-center justify-center" style={{ height: `${520 * scale}px` }}>
        {images.map((src, index) => {
          const { width, height, rotate, offsetX, offsetY, z } = photoLayout[index]
          const zIndex = 10 + layerOrder.indexOf(index) + z
          const sx = offsetX * scale
          const sy = offsetY * scale
          return (
            <motion.div
              key={index}
              className="absolute cursor-grab active:cursor-grabbing"
              drag
              dragMomentum={false}
              dragElastic={0.08}
              onDragStart={() => bringToFront(index)}
              style={{
                x: positions[index]?.x ?? sx,
                y: positions[index]?.y ?? sy,
                zIndex,
              }}
              onDragEnd={(e, info) => handleDragEnd(index, e, info)}
              initial={{
                rotate,
                scale: 0,
                opacity: 0,
              }}
              animate={inView ? {
                rotate,
                scale: 1,
                opacity: 1,
              } : {
                rotate,
                scale: 0,
                opacity: 0,
              }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 1.05, zIndex: 99 }}
              transition={{
                scale: { delay: index * STAGGER, duration: 0.2, ease: [0.34, 1.56, 0.64, 1] },
                opacity: { delay: index * STAGGER, duration: 0.15 },
                default: { type: 'spring', stiffness: 300, damping: 25 },
              }}
            >
              <div
                className="rounded-xl select-none"
                style={{
                  width: `${width * scale}px`,
                  height: `${height * scale}px`,
                  cornerShape: 'squircle',
                } as React.CSSProperties}
              >
                <div
                  className="relative overflow-hidden rounded-xl"
                  style={{
                    width: '100%',
                    height: '100%',
                    cornerShape: 'squircle',
                  } as React.CSSProperties}
                >
                  <Image
                    src={src}
                    alt={`Polaroid ${index + 1}`}
                    fill
                    className="object-contain"
                    draggable={false}
                  />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}