'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { useState } from 'react'

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
    { width: 335, height: 285, rotate: 10.42, offsetX: -500, offsetY: 80, z: 14},
    { width: 224, height: 343, rotate: 0, offsetX: -300, offsetY: 10, z: 1 },
    { width: 330, height: 280, rotate: -5.89, offsetX: -80, offsetY: 60, z: 5 },
    { width: 240, height: 350, rotate: 4.23, offsetX: 190, offsetY: 20, z: 2},
    { width: 334, height: 276, rotate: 10.34, offsetX: 450, offsetY: 45, z: 3 },
  ]

export default function DraggablePhotos() {
  const [positions, setPositions] = useState<Record<number, { x: number; y: number }>>({})

  const [topLayer, setTopLayer] = useState<number | null>(null) //track photo on top
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
    <section className="relative w-full min-h-[20vh] flex items-center justify-center overflow-hidden">
      <div className="relative w-full max-w-[1200px] h-[500px] flex items-center justify-center">
        {images.map((src, index) => {
          const { width, height, rotate, offsetX, offsetY, z } = photoLayout[index]
          const zIndex = 10 + layerOrder.indexOf(index) + z
          return (
            <motion.div
              key={index}
              className="absolute cursor-grab active:cursor-grabbing"
              drag
              dragMomentum={false}
              dragElastic={0.08}
              onDragStart={() => bringToFront(index)}
              style={{
                x: positions[index]?.x ?? offsetX,
                y: positions[index]?.y ?? offsetY,
                zIndex,
              }}
              onDragEnd={(e, info) => handleDragEnd(index, e, info)}
              initial={{
                rotate,
                scale: 1,
              }}
              whileTap={{ scale: 1.05, zIndex: 99 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <div
                className="rounded-[4px] select-none"
                style={{
                  width: `${width}px`,
                  height: `${height}px`,
                }}
              >
                <div
                  className="relative overflow-hidden rounded-[4px]"
                  style={{
                    width: '100%',
                    height: '100%',
                  }}
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