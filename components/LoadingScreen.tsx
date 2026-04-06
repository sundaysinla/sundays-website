'use client'
import { useState, useEffect, useRef } from 'react'

interface LoadingScreenProps {
  isLoading: boolean
  onTypingDone: () => void
}

export default function LoadingScreen({ isLoading, onTypingDone }: LoadingScreenProps) {
  const text = "hello, how's your day going?"
  const [displayText, setDisplayText] = useState('')
  const hasTyped = useRef(false)
  const onDoneRef = useRef(onTypingDone)
  onDoneRef.current = onTypingDone

  const DURATION = 1200

  useEffect(() => {
    if (!isLoading || hasTyped.current) return

    let rafId: number
    const start = performance.now()

    const step = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / DURATION, 1)
      const chars = Math.floor(progress * text.length)
      setDisplayText(text.slice(0, chars))

      if (progress < 1) {
        rafId = requestAnimationFrame(step)
      } else {
        setDisplayText(text)
        hasTyped.current = true
        onDoneRef.current()
      }
    }

    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [isLoading])

  return (
    <div 
      className={`fixed inset-0 z-50 bg-[#FEFDFB] flex items-center justify-center
        ${isLoading ? '' : 'animate-slide-up pointer-events-none'}`}
    >
      <p className="text-xs font-['Office-Times-Sharp-Mono'] text-black">
        {displayText}
        <span className="animate-blink ml-[1px] inline-block w-[1px] h-[14px] bg-black translate-y-[2px]" />
      </p>
    </div>
  )
}