'use client'

import Link from 'next/link'
import Image from 'next/image'
import Button from './Button'

export default function NavBar() {
    return (
        <nav className="flex items-center justify-between pr-16 px-8 py-4 bg-[#FEFDFB] relative z-30">
            <div className="flex items-center space-x-4 pl-16">
                <Image
                    src="/smiley.png"
                    alt="Logo"
                    width={32}
                    height={32}
                    className="opacity-80 hover:opacity-100 transition-opacity"
                />
            </div>

            <div className="flex items-center space-x-8 text-[12px] md:text-[14px] font-['Monument-Grotesk'] font-normal tracking-[-0.02em] text-[#010101] uppercase text-center">
                <Link href="#about" className="hover:opacity-70 transition-opacity">ABOUT</Link>
                <Link href="#projects" className="hover:opacity-70 transition-opacity">PROJECTS</Link>
                <Link href="#team" className="hover:opacity-70 transition-opacity">TEAM</Link>
                <span className="flex items-center gap-3">
                    <Button href="/timer" external>LIVE TIMER</Button>
                    <Button href="https://luma.com/sundaysinla" variant="primary" external>JOIN US</Button>
                </span>
            </div>
        </nav>
    )
}
