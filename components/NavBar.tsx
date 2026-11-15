'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import Button from './Button'
import BigQuote from './BigQuote'

export type PortalNav = {
    name: string | null
    image: string | null
    email: string | null
    isAdmin: boolean
    /** Server action that signs the member out. */
    signOut: () => Promise<void>
}

const siteLinks = [
    { href: '/#about', label: 'about' },
    { href: '/#projects', label: 'projects' },
    { href: '/#team', label: 'team' },
]

const portalLinks = [
    { href: '/portal', label: 'home' },
    { href: '/portal/profile', label: 'profile' },
    { href: '/portal/rsvp', label: 'rsvp' },
    { href: '/portal/carpool', label: 'carpool' },
]

function Avatar({ name, image }: { name: string | null; image: string | null }) {
    const initial = (name?.trim()?.[0] ?? '?').toUpperCase()
    return image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" width={26} height={26} className="h-[26px] w-[26px] rounded-full object-cover" referrerPolicy="no-referrer" />
    ) : (
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#EBEAE0] font-['Monument-Grotesk'] text-[11px] text-[#010101]">
            {initial}
        </span>
    )
}

/**
 * Site navigation. With `portal`, it becomes the signed-in portal header:
 * portal links, the member's avatar, and sign out, on the same bar.
 */
export default function NavBar({ portal }: { portal?: PortalNav | null }) {
    const [open, setOpen] = useState(false)
    const pathname = usePathname()

    const links = portal
        ? [...portalLinks, ...(portal.isAdmin ? [{ href: '/portal/admin', label: 'hosts' }] : [])]
        : siteLinks

    const isActive = (href: string) =>
        href === '/portal' ? pathname === '/portal' : pathname.startsWith(href.replace(/#.*$/, '')) && href.startsWith('/portal')

    const firstName = portal?.name?.trim().split(/\s+/)[0] ?? null

    return (
        <>
            <nav className="flex items-center justify-between px-6 md:px-12 py-4 bg-transparent relative z-30">
                <div className="flex items-center gap-4">
                    <Link href="/" aria-label="Sundays in LA home">
                        <Image
                            src="/smiley.png"
                            alt="Logo"
                            width={32}
                            height={32}
                            className="opacity-80 hover:opacity-100 transition-opacity"
                        />
                    </Link>
                    {portal ? (
                        <span className="hidden sm:inline font-['Monument-Grotesk'] text-[11px] uppercase tracking-wide text-[#C0B9A5]">
                            Members
                        </span>
                    ) : null}
                </div>

                {/* Desktop nav */}
                <div className="hidden lg:flex items-center space-x-8 text-[12px] md:text-[14px] font-['Monument-Grotesk'] font-normal text-[#010101] uppercase text-center">
                    {links.map((l) => (
                        <Link
                            key={l.href}
                            href={l.href}
                            className={`transition-opacity hover:opacity-70 ${portal && isActive(l.href) ? 'underline decoration-[#C0B9A5] underline-offset-[6px]' : ''}`}
                        >
                            {l.label}
                        </Link>
                    ))}
                    {portal ? (
                        <span className="flex items-center gap-5">
                            <Link href="/portal/profile" className="flex items-center gap-2.5 hover:opacity-70 transition-opacity" title={portal.email ?? undefined}>
                                <Avatar name={portal.name} image={portal.image} />
                                {firstName ? (
                                    <span className="font-['Monument-Grotesk'] text-[12px] md:text-[14px] uppercase">{firstName}</span>
                                ) : null}
                            </Link>
                            <form action={portal.signOut}>
                                <Button type="submit" size="sm" className="text-[12px] md:text-[14px] bg-stone-50 border-stone-200 hover:bg-stone-100">SIGN OUT</Button>
                            </form>
                            <Button href="https://luma.com/sundaysinla" variant="dark" size="sm" className="text-[12px] md:text-[14px]" external>JOIN US</Button>
                        </span>
                    ) : (
                        <span className="flex items-center gap-5">
                            <Button href="/portal/login" size="sm" className="text-[12px] md:text-[14px] bg-stone-50 border-stone-200 hover:bg-stone-100">LOGIN</Button>
                            <Button href="/timer" size="sm" className="text-[12px] md:text-[14px] bg-stone-50 border-stone-200 hover:bg-stone-100" external>LIVE TIMER</Button>
                            <Button href="https://luma.com/sundaysinla" variant="dark" size="sm" className="text-[12px] md:text-[14px]" external>JOIN US</Button>
                        </span>
                    )}
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
                    {(portal
                        ? [
                              ...links,
                              { href: '/', label: 'back to site' },
                              { href: 'https://luma.com/sundaysinla', label: 'join us', external: true },
                          ]
                        : [
                              ...siteLinks,
                              { href: '/portal/login', label: 'login' },
                              { href: '/timer', label: 'live timer' },
                              { href: 'https://luma.com/sundaysinla', label: 'join us', external: true },
                          ]
                    ).map((item, i) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            {...('external' in item && item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
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
                    {portal ? (
                        <form action={portal.signOut} style={{ opacity: open ? 1 : 0, transition: `opacity 200ms ease-out ${(links.length + 2) * 80}ms` }}>
                            <button type="submit" className="hover:opacity-70 lowercase">sign out</button>
                        </form>
                    ) : null}
                </BigQuote>
            </div>
        </>
    )
}
