'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useEffect, useState } from 'react';

const Logo3D = dynamic(() => import('./Logo3D'), { ssr: false });
const handheldAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
type WordmarkMode = 'handheld' | 'still' | 'model';

export default function SundaysWordmark({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useState<WordmarkMode>('handheld');
  const [modelReady, setModelReady] = useState(false);
  const [modelUnavailable, setModelUnavailable] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handheld = handheldAgent.test(navigator.userAgent);
    function update() {
      const nextMode = handheld || window.innerWidth < 500 ? 'handheld' : motion.matches ? 'still' : 'model';
      setMode(nextMode);
      if (nextMode !== 'model') setModelReady(false);
    }

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    motion.addEventListener('change', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      motion.removeEventListener('change', update);
    };
  }, []);

  const showModel = mode === 'model' && !modelUnavailable;
  const reserveHeroHeight = !compact && mode !== 'handheld';
  return (
    <div
      className={compact ? 'basket-wordmark' : 'relative w-full'}
      style={reserveHeroHeight ? { height: 'clamp(160px, 24vw, 420px)' } : undefined}
    >
      {(!showModel || !modelReady) && (
        <Image
          src="/sundays-mobile.png"
          alt="Sundays"
          width={1528}
          height={490}
          priority
          sizes={compact ? '(min-width: 1023px) 184px, (min-width: 767px) 18vw, 138px' : '85vw'}
          className={compact ? 'basket-wordmark-image' : 'mx-auto h-auto w-[85%] object-contain'}
          style={reserveHeroHeight ? { position: 'absolute', inset: 0, height: '100%' } : undefined}
        />
      )}
      {showModel && (
        <div
          className={compact ? 'absolute inset-0' : 'h-full'}
          role="img"
          aria-label="Sundays"
          aria-hidden={!modelReady}
          style={{ visibility: modelReady ? 'visible' : 'hidden' }}
        >
          <Logo3D
            cameraDistance={compact ? 6 : undefined}
            onReady={() => setModelReady(true)}
            onUnavailable={() => setModelUnavailable(true)}
          />
        </div>
      )}
    </div>
  );
}
