import type React from "react"
import "./globals.css"
import { Inter } from "next/font/google"
import './fonts.css'
import type { Metadata } from 'next'

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
      <body>
        {children}
      </body>
    </html>
  )
}
