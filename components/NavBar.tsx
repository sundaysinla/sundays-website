"use client";

import Link from "next/link";
import Image from "next/image";

export default function NavBar() {
  return (
    <nav className="flex items-center justify-between pr-16 px-8 py-5 bg-[#FEFDFB]">
      {/* left logo */}
      <div className="flex items-center space-x-4 pl-16">
        <Image
          src="/smiley.png" // 👈 replace with your logo path
          alt="Logo"
          width={32}
          height={32}
          className="opacity-80 hover:opacity-100 transition-opacity"
        />
      </div>

      <div className="flex items-center space-x-8 text-[12px] md:text-[14px] font-['Monument-Grotesk'] font-normal tracking-[-0.02em] text-[#010101] uppercase text-center">
        <Link href="#about" className="hover:opacity-70 transition-opacity">
          ABOUT
        </Link>
        <Link href="#projects" className="hover:opacity-70 transition-opacity">
          PROJECTS
        </Link>
        <Link href="#team" className="hover:opacity-70 transition-opacity">
          TEAM
        </Link>{" "}
        <Link
          href="/timer"
          className="bg-[#E6E6E666] border border-[#EBEAE0] rounded-xl px-3 py-1 hover:bg-[#E6E6E999] transition-all"
        >
          LIVE TIMER
        </Link>
        <Link
          href="https://lu.ma/sundaysinla"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#C0B9A5] border border-[#EBEAE0] text-white rounded-xl px-3 py-1 hover:opacity-90 transition-all"
        >
          JOIN US
        </Link>
      </div>
    </nav>
  );
}
