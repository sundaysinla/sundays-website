'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Button from './Button'

export default function NavBar() {
    const [open, setOpen] = useState(false)

    return (
        <>
            <nav className="flex items-center justify-between px-6 md:px-12 py-4 bg-transparent relative z-30">
                <div className="flex items-center space-x-4">
                    <Image
                        src="/smiley.png"
                        alt="Logo"
                        width={32}
                        height={32}
                        className="opacity-80 hover:opacity-100 transition-opacity"
                    />
                </div>

                {/* Desktop nav */}
                <div className="hidden lg:flex items-center space-x-8 text-[12px] md:text-[14px] font-['Monument-Grotesk'] font-normal text-[#010101] uppercase text-center">
                    <Link href="#about" className="hover:opacity-70 transition-opacity">ABOUT</Link>
                    <Link href="#projects" className="hover:opacity-70 transition-opacity">PROJECTS</Link>
                    <Link href="#team" className="hover:opacity-70 transition-opacity">TEAM</Link>
                    <span className="flex items-center gap-5">
                        <Button href="/timer" size="sm" className="text-[12px] md:text-[14px] bg-stone-50 border-stone-200 hover:bg-stone-100" external>LIVE TIMER</Button>
                        <Button href="https://luma.com/sundaysinla" variant="dark" size="sm" className="text-[12px] md:text-[14px]" external>JOIN US</Button>
                    </span>
                </div>

                {/* Hamburger button */}
                <button
                    onClick={() => setOpen(true)}
                    className="lg:hidden flex flex-col justify-center items-center w-8 h-8 gap-[5px]"
                    aria-label="Open menu"
                >
                    <span className="block w-5 h-[1.5px] bg-[#010101]" />
                    <span className="block w-5 h-[1.5px] bg-[#010101]" />
                </button>
            </nav>

            {/* Mobile menu overlay */}
            <div
                className={`fixed inset-0 z-50 bg-[#FEFDFB] transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            >
                <div className="flex items-center justify-between px-6 py-4">
                    <Image
                        src="/smiley.png"
                        alt="Logo"
                        width={32}
                        height={32}
                        className="opacity-80"
                    />
                    <button
                        onClick={() => setOpen(false)}
                        className="w-8 h-8 flex items-center justify-center"
                        aria-label="Close menu"
                    >
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 1L17 17M17 1L1 17" stroke="#010101" strokeWidth="1.5" />
                        </svg>
                    </button>
                </div>

                <div className="flex flex-col px-6 pt-8 gap-6 font-['Monument-Grotesk'] text-[32px] uppercase text-[#010101]">
                    <Link href="#about" onClick={() => setOpen(false)} className="hover:opacity-70 transition-opacity">About</Link>
                    <Link href="#projects" onClick={() => setOpen(false)} className="hover:opacity-70 transition-opacity">Projects</Link>
                    <Link href="#team" onClick={() => setOpen(false)} className="hover:opacity-70 transition-opacity">Team</Link>
                    <Link href="/timer" onClick={() => setOpen(false)} className="hover:opacity-70 transition-opacity">Live Timer</Link>
                    <Link
                        href="https://luma.com/sundaysinla"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setOpen(false)}
                        className="hover:opacity-70 transition-opacity"
                    >
                        Join Us
                    </Link>
                </div>
            </div>
        </>
    )
}
