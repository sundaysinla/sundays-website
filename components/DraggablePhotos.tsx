'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useInView } from 'react-intersection-observer'

const images = [
  '/polaroid1.png',
  '/polaroid2.png',
  '/polaroid3.png',
  '/polaroid4.png',
  '/polaroid5.png'
]

const photoLayout = [
    { width: 335, height: 285, rotate: 10.42, offsetX: -450, offsetY: 80, z: 14},
    { width: 224, height: 343, rotate: 0, offsetX: -250, offsetY: 10, z: 1 },
    { width: 330, height: 280, rotate: -5.89, offsetX: -30, offsetY: 60, z: 5 },
    { width: 240, height: 350, rotate: 4.23, offsetX: 240, offsetY: 20, z: 2},
    { width: 334, height: 276, rotate: 10.34, offsetX: 500, offsetY: 45, z: 3 },
  ]

const mobileRotations = [-8, -12, 2, 10, 6]

const mobileOrder = {
  row1: [1, 2, 3],
  row2: [0, 4],
}

function isHorizontal(index: number) {
  return photoLayout[index].width > photoLayout[index].height
}

const BASE_WIDTH = 1200
const TOTAL_DURATION = 0.4
const STAGGER = TOTAL_DURATION / 5

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const [mounted, setMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const scrollYRef = useRef(0)

  const closingRef = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const handleClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setIsClosing(true)
    setIsOpen(false)
    setTimeout(() => {
      onCloseRef.current()
    }, 250)
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
      style={{
        transition: 'opacity 250ms ease-out',
        opacity: isOpen ? 1 : 0,
      }}
      onClick={handleClose}
    >
      <div className="absolute inset-0 bg-stone-100/95" />

      <button
        onClick={(e) => { e.stopPropagation(); handleClose() }}
        className="fixed right-4 top-4 z-10 flex h-10 w-10 items-center justify-center hover:scale-110"
        aria-label="Close expanded photo"
        style={{
          transition: 'opacity 250ms ease-out, transform 300ms ease-out',
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? 'translateY(0)' : 'translateY(-8px)',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1L13 13M1 13L13 1" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <div
        className="relative z-10 flex max-h-[50vh] max-w-[65vw] items-center justify-center"
        style={{
          transition: 'opacity 250ms ease-out, transform 300ms cubic-bezier(0.16, 1, 0.3, 1)',
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? 'scale(1)' : 'scale(0.92)',
        }}
      >
        <Image
          src={src}
          alt="Polaroid enlarged"
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

export default function DraggablePhotos() {
  const [positions, setPositions] = useState<Record<number, { x: number; y: number }>>({})
  const { ref: sectionRef, inView } = useInView({ triggerOnce: true, threshold: 0.2 })
  const [scale, setScale] = useState(1)
  const [isMobile, setIsMobile] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const draggedRef = useRef(false)

  useEffect(() => {
    const update = () => {
      setScale(Math.min(1, window.innerWidth / BASE_WIDTH))
      setIsMobile(window.innerWidth < 768)
    }
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
    draggedRef.current = false
  }

  const handleDragEnd = (index: number, _event: any, info: any) => {
    const dx = Math.abs(info.offset.x)
    const dy = Math.abs(info.offset.y)
    if (dx > 3 || dy > 3) {
      draggedRef.current = true
    }
    setPositions((prev) => ({
      ...prev,
      [index]: {
        x: info.point.x - window.innerWidth / 2,
        y: info.point.y - window.innerHeight / 2,
      },
    }))
    setTopLayer(null)
  }

  const handleClick = (src: string) => {
    if (!draggedRef.current) {
      setLightboxSrc(src)
    }
    draggedRef.current = false
  }

  if (isMobile) {
    return (
      <>
        {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
        <section ref={sectionRef} className="relative w-full flex flex-col items-center px-4 mt-6 overflow-visible">
          <div className="flex justify-center -space-x-4">
            {mobileOrder.row1.map((imgIdx, i) => {
              const mobileZ = [0, 5, 0][i] ?? 0
              return (
              <motion.div
                key={imgIdx}
                className="relative rounded-xl overflow-hidden select-none cursor-grab active:cursor-grabbing"
                drag
                dragMomentum={false}
                dragElastic={0.08}
                onDragStart={() => bringToFront(imgIdx)}
                onDragEnd={(e, info) => handleDragEnd(imgIdx, e, info)}
                onTap={() => handleClick(images[imgIdx])}
                style={{ width: isHorizontal(imgIdx) ? '38vw' : '24vw', aspectRatio: photoLayout[imgIdx].width / photoLayout[imgIdx].height, zIndex: 10 + layerOrder.indexOf(imgIdx) + mobileZ }}
                initial={{ rotate: mobileRotations[imgIdx], scale: 0, opacity: 0 }}
                animate={inView ? { rotate: mobileRotations[imgIdx], scale: 1, opacity: 1 } : { rotate: mobileRotations[imgIdx], scale: 0, opacity: 0 }}
                whileTap={{ scale: 1.05, zIndex: 99 }}
                transition={{
                  scale: { delay: i * STAGGER, duration: 0.2, ease: [0.34, 1.56, 0.64, 1] },
                  opacity: { delay: i * STAGGER, duration: 0.15 },
                  default: { type: 'spring', stiffness: 300, damping: 25 },
                }}
              >
                <Image src={images[imgIdx]} alt={`Polaroid ${imgIdx + 1}`} fill className="object-contain" draggable={false} />
              </motion.div>
              )
            })}
          </div>
          <div className="flex justify-center -space-x-4 -mt-6">
            {mobileOrder.row2.map((imgIdx, i) => (
              <motion.div
                key={imgIdx}
                className="relative rounded-xl overflow-hidden select-none cursor-grab active:cursor-grabbing"
                drag
                dragMomentum={false}
                dragElastic={0.08}
                onDragStart={() => bringToFront(imgIdx)}
                onDragEnd={(e, info) => handleDragEnd(imgIdx, e, info)}
                onTap={() => handleClick(images[imgIdx])}
                style={{ width: isHorizontal(imgIdx) ? '38vw' : '24vw', aspectRatio: photoLayout[imgIdx].width / photoLayout[imgIdx].height, zIndex: 10 + layerOrder.indexOf(imgIdx) }}
                initial={{ rotate: mobileRotations[imgIdx], scale: 0, opacity: 0 }}
                animate={inView ? { rotate: mobileRotations[imgIdx], scale: 1, opacity: 1 } : { rotate: mobileRotations[imgIdx], scale: 0, opacity: 0 }}
                whileTap={{ scale: 1.05, zIndex: 99 }}
                transition={{
                  scale: { delay: (i + 3) * STAGGER, duration: 0.2, ease: [0.34, 1.56, 0.64, 1] },
                  opacity: { delay: (i + 3) * STAGGER, duration: 0.15 },
                  default: { type: 'spring', stiffness: 300, damping: 25 },
                }}
              >
                <Image src={images[imgIdx]} alt={`Polaroid ${imgIdx + 1}`} fill className="object-contain" draggable={false} />
              </motion.div>
            ))}
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
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
                onTap={() => handleClick(src)}
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
    </>
  )
}
