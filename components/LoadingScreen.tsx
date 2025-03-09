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
  
  const typingDelay = 80  // Increase from default (usually 50-60)

  useEffect(() => {
    if (!isLoading || hasTyped.current) return
    
    let currentIndex = 0
    const interval = setInterval(() => {
      if (currentIndex <= text.length) {
        setDisplayText(text.slice(0, currentIndex))
        currentIndex++
      } else {
        clearInterval(interval)
        hasTyped.current = true
        onTypingDone()
      }
    }, typingDelay)
    
    return () => clearInterval(interval)
  }, [isLoading, onTypingDone])

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