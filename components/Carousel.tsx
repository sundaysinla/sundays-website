"use client";

import useEmblaCarousel from "embla-carousel-react";
import Image from "next/image";
import AutoScroll from "embla-carousel-auto-scroll";

const images = [
  "/carousel1.png",
  "/carousel2.png",
  "/carousel3.png",
  "/carousel4.png",
  "/carousel5.png",
  "/carousel6.png",
];

export default function Carousel() {
  const [emblaRef] = useEmblaCarousel(
    {
      loop: true,
      dragFree: false,
      containScroll: false,
    },
    [
      AutoScroll({
        speed: 1,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
      }),
    ]
  );

  return (
    <div ref={emblaRef} className="overflow-hidden w-screen max-w-full mx-auto">
      <div className="flex gap-2"> {/* Added gap-4 for spacing */}
        {[...images, ...images, ...images].map((src, i) => (
          <div
            key={i}
            className="flex-[0_0_22%] min-w-0 relative aspect-[3/4]" // Changed to 20% and removed px-2
          >
            <Image
              src={src}
              alt={`carousel-${i}`}
              fill
              className="object-cover rounded-xl"
              priority={i < 6}
            />
          </div>
        ))}
      </div>
    </div>
  );
}