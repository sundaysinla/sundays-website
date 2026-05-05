'use client'
import { useState, useEffect, useRef } from 'react'

interface LoadingScreenProps {
  isLoading: boolean
  onTypingDone: () => void
}

const LOADING_TEXT = "hello, how's your day going?"
const TYPING_DELAY_MS = 90

export default function LoadingScreen({ isLoading, onTypingDone }: LoadingScreenProps) {
  const [displayText, setDisplayText] = useState(LOADING_TEXT.slice(0, 1))
  const [isTyping, setIsTyping] = useState(true)
  const hasTyped = useRef(false)
  const onDoneRef = useRef(onTypingDone)
  onDoneRef.current = onTypingDone

  useEffect(() => {
    if (!isLoading || hasTyped.current) return

    let currentIndex = 1
    let timeoutId: ReturnType<typeof setTimeout>

    const typeNextCharacter = () => {
      currentIndex += 1
      setDisplayText(LOADING_TEXT.slice(0, currentIndex))

      if (currentIndex < LOADING_TEXT.length) {
        timeoutId = setTimeout(typeNextCharacter, TYPING_DELAY_MS)
      } else {
        setIsTyping(false)
        hasTyped.current = true
        onDoneRef.current()
      }
    }

    timeoutId = setTimeout(typeNextCharacter, TYPING_DELAY_MS)
    return () => clearTimeout(timeoutId)
  }, [isLoading])

  return (
    <div 
      className={`fixed inset-0 z-50 bg-[#FEFDFB] flex items-center justify-center
        ${isLoading ? '' : 'animate-slide-up pointer-events-none'}`}
    >
      <p className="text-xs font-['Office-Times-Sharp-Mono'] text-black">
        {displayText}
        <span className={`${isTyping ? '' : 'animate-blink'} ml-[1px] inline-block w-[1px] h-[14px] bg-black translate-y-[2px]`} />
      </p>
    </div>
  )
}