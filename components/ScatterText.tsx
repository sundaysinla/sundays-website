'use client'
import { useState } from 'react'

export default function ScatterText({ 
  text, 
  onHoverChange,
  className = ''
}: { 
  text: string;
  onHoverChange?: (hovering: boolean) => void;
  className?: string;
}) {
  const [isHovered, setIsHovered] = useState(false)

  const handleHover = (hovering: boolean) => {
    setIsHovered(hovering)
    onHoverChange?.(hovering)
  }

  return (
    <p 
      className={`${className} text-[32px] font-['Office-Times-Sharp-Regular'] leading-relaxed`}
      style={{ 
        wordBreak: 'break-word',
        hyphens: 'manual'
      }}
      onMouseEnter={() => handleHover(true)}
      onMouseLeave={() => handleHover(false)}
    >
      {text.split(' / ').map((word, i) => (
        <span key={i} style={{ whiteSpace: 'nowrap', display: 'inline-block' }}>
          {word.split('').map((char, j) => (
            <span
              key={j}
              style={{
                display: 'inline-block',
                transition: 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: isHovered ? 
                  `translate3d(${Math.random() * 300 - 150}px, ${Math.random() * 300 - 150}px, 0) 
                   rotate3d(0, 0, 1, ${Math.random() * 90 - 45}deg)` : 
                  'translate3d(0, 0, 0) rotate3d(0, 0, 1, 0deg)',
                whiteSpace: 'pre'
              }}
            >
              {char}
            </span>
          ))}
          {i < text.split(' / ').length - 1 && (
            <>
              <span style={{ whiteSpace: 'pre' }}> </span>
              <span
                style={{
                  display: 'inline-block',
                  transition: 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: isHovered ? 
                    `translate3d(${Math.random() * 700 - 350}px, ${Math.random() * 700 - 350}px, 0) 
                     rotate3d(0, 0, 1, ${Math.random() * 90 - 45}deg)` : 
                    'translate3d(0, 0, 0) rotate3d(0, 0, 1, 0deg)',
                  whiteSpace: 'pre'
                }}
              >
                /
              </span>
              <span style={{ whiteSpace: 'pre' }}> </span>
            </>
          )}
        </span>
      ))}
    </p>
  )
} 