import type React from "react"
import "./globals.css"
import { Inter } from "next/font/google"
import './fonts.css'
import type { Metadata } from 'next'
import AssetPreloader from '@/components/AssetPreloader'

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "sundays in la",
  description: "A home for the passions that excite you. Weekly coworking sessions, every Sunday.",
  icons: {
    icon: '/favicon.ico',
  },
  metadataBase: new URL('https://www.sundays.rsvp'),
  openGraph: {
    title: 'sundays in la',
    description: 'A home for the passions that excite you. Weekly coworking sessions, every Sunday.',
    url: 'https://www.sundays.rsvp',
    siteName: 'Sundays in LA',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Sundays in LA',
        type: 'image/png',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'sundays in la',
    description: 'A home for the passions that excite you. Weekly coworking sessions, every Sunday.',
    images: ['/og-image.png'],
  },
  other: {
    'pinterest-rich-pin': 'true',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        {/* Pre-warm cross-origin connection used by Three.js Draco decoder */}
        <link rel="preconnect" href="https://www.gstatic.com" crossOrigin="anonymous" />
        {/* Kick off downloads for the 3D logo assets in parallel with the JS bundle.
            No crossOrigin attr: matches Three.js loaders' same-origin fetch mode so
            the preload cache hits rather than triggering a double-fetch. */}
        <link
          rel="preload"
          href="/sundays_metallic_logo_only.min.gltf"
          as="fetch"
        />
        <link
          rel="preload"
          href="/environment/modern_bathroom_1k.hdr"
          as="fetch"
        />
      </head>
      <body>
        <AssetPreloader />
        {children}
      </body>
    </html>
  )
}
