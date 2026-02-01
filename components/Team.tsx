"use client";
import React from "react";

export default function Team() {
  return (
    <section className="bg-[#FCFAF5] text-[#3A372F] py-20 px-6 md:px-20 lg:px-40">
      <div className="text-center mb-8">
        <p className="text-sm text-[#C0B9A5] font-['ABC Monument Grotesk Unlicensed Trial'] tracking-wide uppercase">
          Meet the Team
        </p>
        <p className="text-base font-medium font-['ABC Monument Grotesk Medium'] text-[#C0B9A5]">
          Season 5: 2025–26
        </p>
      </div>

      <div className="mx-auto w-[85%] border-t border-dashed border-[#C0B9A5] my-10" />

      <div className="grid grid-cols-3 gap-16 text-center">
        {/* USC Hosts */}
        <div>
          <div className="text-3xl mb-2 translate-y-[2px]">✌</div>
          <h2 className="text-4xl font-['Office-Times-Sharp-Regular'] text-[#C0B9A5] mb-4">
            usc hosts
          </h2>
          <ul className="space-y-1 text-[15px] font-['Office-Times-Sharp-Regular']">
            <li>
              <a
                href="https://www.linkedin.com/in/amanda-nepo-7830152b1/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline underline-offset-4 transition-all duration-200"
              >
                Amanda Nepo
              </a>
            </li>
            <li>
              <a
                href="https://www.linkedin.com/in/richardshizhang/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline underline-offset-4 transition-all duration-200"
              >
                Richard Zhang
              </a>
            </li>
            <li>
              <a
                href="https://www.linkedin.com/in/sarah-fan-70400a241/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline underline-offset-4 transition-all duration-200"
              >
                Sarah Fan
              </a>
            </li>
            <li>
              <a
                href="https://www.linkedin.com/in/snama/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline underline-offset-4 transition-all duration-200"
              >
                Sinchana Nama
              </a>
            </li>
          </ul>
        </div>

        {/* UCLA Hosts */}
        <div>
          <div className="text-3xl mb-2">🐻</div>
          <h2 className="text-4xl font-['Office-Times-Sharp-Regular'] text-[#C0B9A5] mb-4">
            ucla hosts
          </h2>
          <ul className="space-y-1 text-[15px] font-['Office-Times-Sharp-Regular']">
            <li>
              <a
                href="https://www.linkedin.com/in/1arushigupta/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline underline-offset-4 transition-all duration-200"
              >
                Arushi Gupta
              </a>
            </li>
            <li>
              <a
                href="https://www.linkedin.com/in/emilyshenucla/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline underline-offset-4 transition-all duration-200"
              >
                Emily Shen
              </a>
            </li>
            <li>
              <a
                href="https://www.linkedin.com/in/jaysontian/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline underline-offset-4 transition-all duration-200"
              >
                Jayson Tian
              </a>
            </li>
            <li>
              <a
                href="https://www.linkedin.com/in/kyle-jeong/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline underline-offset-4 transition-all duration-200"
              >
                Kyle Jeong
              </a>
            </li>
            <li>
              <a
                href="https://www.linkedin.com/in/michelletliu/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline underline-offset-4 transition-all duration-200"
              >
                Michelle Liu
              </a>
            </li>
          </ul>
        </div>

        {/* Media Team */}
        <div>
          <div className="text-3xl mb-2">🎥</div>
          <h2 className="text-4xl font-['Office-Times-Sharp-Regular'] text-[#C0B9A5] mb-4">
            media team
          </h2>
          <ul className="space-y-1 text-[15px] font-['Office-Times-Sharp-Regular']">
            <li>
              <a
                href="https://www.linkedin.com/in/brandonbbao/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline underline-offset-4 transition-all duration-200"
              >
                Brandon Bao
              </a>
            </li>
            <li>
              <a
                href="https://www.linkedin.com/in/fiorilee/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline underline-offset-4 transition-all duration-200"
              >
                Fiori Lee
              </a>
            </li>
            <li>
              <a
                href="https://www.linkedin.com/in/janrebolledo/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline underline-offset-4 transition-all duration-200"
              >
                Jan Rebolledo
              </a>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
