'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Button from './Button'
import BigQuote from './BigQuote'

export default function NavBar({ showSuggestions }: { showSuggestions: boolean }) {
    const [open, setOpen] = useState(false)
    const suggestionsLink = showSuggestions && (
        <Link
            href="/basket"
            prefetch={false}
            aria-label="Suggestions, new"
            className="group inline-flex h-11 lg:h-8 items-center gap-1.5 text-[12px] md:text-[14px] font-['Monument-Grotesk'] uppercase text-[#010101]"
        >
            <span className="transition-opacity group-hover:opacity-70">Suggestions</span>
            <sup className="-top-1.5 inline-flex items-center gap-0.5 font-['PP-Editorial-New-UltraLightItalic'] text-[12px] md:text-[13px] font-extralight italic normal-case leading-none text-[#4b593e]">
                <svg width="6" height="9" viewBox="0 0 6 9" fill="none" stroke="currentColor" strokeWidth=".8" strokeLinecap="round" aria-hidden="true">
                    <path d="M4.5 3 2 1.5M4 6l-3 .8" />
                </svg>
                new!
                <svg width="6" height="9" viewBox="0 0 6 9" fill="none" stroke="currentColor" strokeWidth=".8" strokeLinecap="round" aria-hidden="true">
                    <path d="m1.5 3 2.8-2M2 6l3 .9" />
                </svg>
            </sup>
        </Link>
    )

    return (
        <>
            <nav className="flex items-center justify-between px-6 md:px-12 py-2.5 lg:py-4 bg-transparent relative z-30">
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
                    {suggestionsLink}
                    <span className="flex items-center gap-5">
                        <Button href="/timer" size="sm" className="text-[12px] md:text-[14px] bg-stone-50 border-stone-200 hover:bg-stone-100" external>LIVE TIMER</Button>
                        <Button href="https://luma.com/sundaysinla" variant="dark" size="sm" className="text-[12px] md:text-[14px]" external>JOIN US</Button>
                    </span>
                </div>

                <div className="flex items-center gap-3 lg:hidden">
                    {suggestionsLink}
                    <button
                        onClick={() => setOpen(!open)}
                        className="relative -mr-1.5 w-11 h-11 flex items-center justify-center"
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
                </div>
            </nav>

            {/* Mobile menu overlay */}
            <div
                className={`fixed inset-0 z-50 bg-[#FEFDFB] flex flex-col transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            >
                <div className="flex items-center justify-between px-6 py-2.5">
                    <Image
                        src="/smiley.png"
                        alt="Logo"
                        width={32}
                        height={32}
                        className="opacity-80"
                    />
                    <button
                        onClick={() => setOpen(false)}
                        className="relative -mr-1.5 w-11 h-11 flex items-center justify-center"
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
