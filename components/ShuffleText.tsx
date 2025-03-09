'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'

const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';

interface ShuffleTextProps {
  text: string;
}

export default function ShuffleText({ text }: ShuffleTextProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [displayText, setDisplayText] = useState(text);
  
  useEffect(() => {
    if (!isHovered) {
      setDisplayText(text);
      return;
    }

    let iteration = 0;
    const interval = setInterval(() => {
      setDisplayText(prev => 
        prev.split('').map((char, idx) => {
          if (char === ' ') return ' ';
          if (idx < iteration) return text[idx];
          return characters[Math.floor(Math.random() * characters.length)];
        }).join('')
      );
      
      iteration += 1/2;
      if (iteration > text.length) clearInterval(interval);
    }, 30);

    return () => clearInterval(interval);
  }, [isHovered, text]);

  return (
    <Link 
      href="https://lu.ma/usc"
      target="_blank"
      rel="noopener noreferrer"
    >
      <span 
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="cursor-pointer"
      >
        {displayText}
      </span>
    </Link>
  );
} 