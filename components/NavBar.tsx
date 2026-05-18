'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Button from './Button'
import BigQuote from './BigQuote'

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

                {/* Hamburger / X button */}
                <button
                    onClick={() => setOpen(!open)}
                    className="lg:hidden relative w-8 h-8 flex items-center justify-center"
                    aria-label={open ? "Close menu" : "Open menu"}
                >
                    <span
                        className="absolute block w-5 h-[1.5px] bg-[#010101] transition-all duration-300 ease-in-out"
                        style={{
                            transform: open ? 'rotate(45deg)' : 'translateY(-3px)',
                        }}
                    />
                    <span
                        className="absolute block w-5 h-[1.5px] bg-[#010101] transition-all duration-300 ease-in-out"
                        style={{
                            transform: open ? 'rotate(-45deg)' : 'translateY(3px)',
                        }}
                    />
                </button>
            </nav>

            {/* Mobile menu overlay */}
            <div
                className={`fixed inset-0 z-50 bg-[#FEFDFB] flex flex-col transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
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
                        className="relative w-8 h-8 flex items-center justify-center"
                        aria-label="Close menu"
                    >
                        <span
                            className="absolute block w-5 h-[1.5px] bg-[#010101] transition-all duration-300 ease-in-out"
                            style={{ transform: 'rotate(45deg)' }}
                        />
                        <span
                            className="absolute block w-5 h-[1.5px] bg-[#010101] transition-all duration-300 ease-in-out"
                            style={{ transform: 'rotate(-45deg)' }}
                        />
                    </button>
                </div>

                <BigQuote
                    as="div"
                    className="flex flex-col flex-1 justify-center px-6 pb-16 gap-6 lowercase text-[#010101]"
                >
                    {[
                        { href: '#about', label: 'about' },
                        { href: '#projects', label: 'projects' },
                        { href: '#team', label: 'team' },
                        { href: '/timer', label: 'live timer' },
                        { href: 'https://luma.com/sundaysinla', label: 'join us', external: true },
                    ].map((item, i) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                            onClick={() => setOpen(false)}
                            className="hover:opacity-70"
                            style={{
                                opacity: open ? 1 : 0,
                                transform: open ? 'translateY(0)' : 'translateY(8px)',
                                transition: `opacity 200ms ease-out ${i * 80}ms, transform 200ms ease-out ${i * 80}ms`,
                            }}
                        >
                            {item.label}
                        </Link>
                    ))}
                </BigQuote>
            </div>
        </>
    )
}
