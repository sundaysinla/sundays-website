import type React from "react"
import "./globals.css"
import { Inter } from "next/font/google"
import './fonts.css'

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "Sundays at USC",
  description: "A home to work on the passions that excite you",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-white`}>{children}</body>
    </html>
  )
}



import './globals.css'