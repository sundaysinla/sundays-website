"use client";
import React from "react";

export default function Projects() {
  return (
    <section className="text-[#3A372F] py-24 px-6 md:px-20 lg:px-40 relative">
      <div className="text-center mb-8">
        <p className="text-sm uppercase text-[#C0B9A5] font-['ABC Monument Grotesk Unlicensed Trial']">
          Projects
        </p>
      </div>

      <h2 className="text-2xl md:text-3xl ml-8 font-['Office-Times-Sharp-Regular'] text-[#C0B9A5] mb-4 text-left">
        what have we been jamming on?
      </h2>

      {/* Divider */}
      <div className="w-[85%] ml-8 border-t border-dashed border-[#C0B9A5] my-8" />

      {/* Project List */}
      <ul className="space-y-4 ml-8 md:space-y-6 text-[#2A2A24] text-left">
        <li className="text-[22px] font-['Office-Times-Sharp-Regular']">
          (01) music production
        </li>
        <li className="text-[22px] font-['Office-Times-Sharp-Regular']">
          (02) font making
        </li>
        <li className="text-[22px] font-['Office-Times-Sharp-Regular']">
          (03) educational tools
        </li>
        <li className="text-[22px] font-['Office-Times-Sharp-Regular']">
          (04) website design
        </li>
        <li className="text-[22px] font-['Office-Times-Sharp-Regular']">
          (05) magic tricks
        </li>
        <li className="text-[22px] font-['Office-Times-Sharp-Regular']">
          (06) reading fiction
        </li>
        <li className="text-[22px] font-['Office-Times-Sharp-Regular']">
          (07) making matcha
        </li>
        <li className="text-[22px] font-['Office-Times-Sharp-Regular']">
          (08) 3d modeling
        </li>
      </ul>
    </section>
  );
}
