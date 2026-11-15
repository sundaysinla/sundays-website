'use client';

import { LayoutGroup, MotionConfig, motion } from 'framer-motion';
import { useState, type ReactNode } from 'react';

const paperSpring = { type: 'spring', duration: 0.28, bounce: 0.16 } as const;
const instantLayout = { duration: 0 };

export default function BasketPostList({ children }: { children: ReactNode }) {
  const [pointerLayout, setPointerLayout] = useState(false);

  return (
    <MotionConfig reducedMotion="user" transition={{ layout: pointerLayout ? paperSpring : instantLayout }}>
      <LayoutGroup>
        <div className="basket-post-list" data-pointer-layout={pointerLayout || undefined}
          onClickCapture={event => setPointerLayout(event.detail > 0)}>
          {children}
        </div>
      </LayoutGroup>
    </MotionConfig>
  );
}

export function BasketTile({ className, id, children }: { className: string; id?: string; children: ReactNode }) {
  return (
    <motion.article className={className} id={id} layout>
      <motion.div layout="position">{children}</motion.div>
    </motion.article>
  );
}
