import { useId } from 'react';

const front = 'M77 238 C88 309 107 369 150 399 C202 432 391 433 449 401 C494 375 517 310 525 238 C470 282 144 286 77 238Z';
const rimBack = 'M77 240 C74 212 164 184 299 183 C429 182 525 205 525 238';
const rimFront = 'M77 238 C96 268 186 284 299 282 C415 281 510 261 525 238';
const handle = 'M124 215 C126 129 180 56 271 43 C388 26 477 98 477 212';

const courses = [
  'M72 248 Q282 329 529 247',
  'M76 268 Q283 353 529 266',
  'M80 288 Q286 374 523 286',
  'M84 308 Q287 396 519 306',
  'M91 328 Q290 416 511 326',
  'M102 348 Q291 435 503 346',
  'M114 369 Q292 449 488 367',
  'M126 389 Q294 463 476 387',
  'M144 406 Q296 469 455 404',
];

const stakes = Array.from({ length: 21 }, (_, index) => {
  const top = 91 + index * 21;
  const bottom = 300 + (top - 300) * 0.67;
  return `M${top} 230 Q${top + (300 - top) * 0.09} 343 ${bottom} 427`;
});

export default function BasketIllustration({ delivery }: { delivery: 'still' | 'animated' | null }) {
  const prefix = `basket${useId().replace(/:/g, '')}`;
  const bodyClip = `${prefix}-body`;
  const grain = `${prefix}-grain`;
  const ground = `${prefix}-ground`;
  const contactShadow = `${prefix}-contact-shadow`;
  const cane = `${prefix}-cane`;
  const lining = `${prefix}-lining`;
  const bodyShade = `${prefix}-body-shade`;
  const slipPaper = `${prefix}-slip-paper`;
  const warmPaper = `${prefix}-warm-paper`;
  const ivoryPaper = `${prefix}-ivory-paper`;
  const sagePaper = `${prefix}-sage-paper`;
  const blushPaper = `${prefix}-blush-paper`;
  const tapeSheen = `${prefix}-tape-sheen`;
  const paperSheen = `${prefix}-paper-sheen`;

  return (
    <figure className="basket-art" data-delivery={delivery ?? 'idle'} aria-hidden="true">
      <svg viewBox="0 0 600 469" focusable="false" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id={bodyClip}><path d={front} /></clipPath>
          <pattern id={grain} width="19" height="13" patternUnits="userSpaceOnUse">
            <path d="M3 4h.5m7 4h.5m5-6h.5m1 10h.5" fill="none" stroke="#52351d" strokeWidth=".7" strokeLinecap="round" />
          </pattern>
          <pattern id={ground} width="8" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
            <path d="M0 0h3m2 3h1" fill="none" stroke="#745b3e" strokeWidth=".7" strokeLinecap="round" />
          </pattern>
          <radialGradient id={contactShadow}>
            <stop stopColor="#645039" stopOpacity=".25" />
            <stop offset=".58" stopColor="#645039" stopOpacity=".1" />
            <stop offset="1" stopColor="#645039" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={cane} x2="100%" y2="100%">
            <stop stopColor="#ecd4ad" />
            <stop offset=".46" stopColor="#d1ae80" />
            <stop offset="1" stopColor="#ad8358" />
          </linearGradient>
          <linearGradient id={lining} x2="0%" y2="100%">
            <stop stopColor="#a58460" />
            <stop offset="1" stopColor="#654b34" />
          </linearGradient>
          <linearGradient id={bodyShade} x1="0%" y1="15%" x2="100%" y2="78%">
            <stop stopColor="#503a28" stopOpacity=".21" />
            <stop offset=".25" stopColor="#fff5e3" stopOpacity=".05" />
            <stop offset=".52" stopColor="#fff5e3" stopOpacity=".17" />
            <stop offset=".81" stopColor="#674930" stopOpacity=".07" />
            <stop offset="1" stopColor="#503a28" stopOpacity=".26" />
          </linearGradient>
          <linearGradient id={slipPaper} x2="0%" y2="100%">
            <stop stopColor="var(--basket-accent-wash)" />
            <stop offset="1" stopColor="var(--basket-accent-paper)" />
          </linearGradient>
          <linearGradient id={warmPaper} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop stopColor="#fffdf8" />
            <stop offset=".55" stopColor="#f8f2e7" />
            <stop offset="1" stopColor="#eee5d5" />
          </linearGradient>
          <linearGradient id={ivoryPaper} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop stopColor="#fffefa" />
            <stop offset=".52" stopColor="#fcf8ef" />
            <stop offset="1" stopColor="#efe8da" />
          </linearGradient>
          <linearGradient id={sagePaper} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop stopColor="#eef2e5" />
            <stop offset=".48" stopColor="var(--basket-accent-paper)" />
            <stop offset="1" stopColor="#cdd9b7" />
          </linearGradient>
          <linearGradient id={blushPaper} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop stopColor="#fcf5ee" />
            <stop offset=".56" stopColor="#f3e7db" />
            <stop offset="1" stopColor="#e8d8ca" />
          </linearGradient>
          <linearGradient id={tapeSheen} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop stopColor="#fffaf0" stopOpacity=".92" />
            <stop offset=".5" stopColor="#d8cbae" stopOpacity=".78" />
            <stop offset="1" stopColor="#f5ecdc" stopOpacity=".84" />
          </linearGradient>
          <linearGradient id={paperSheen} x1="0%" y1="0%" x2="100%" y2="75%">
            <stop stopColor="#fff" stopOpacity=".84" />
            <stop offset=".48" stopColor="#fff" stopOpacity=".28" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>

        <ellipse cx="302" cy="432" rx="232" ry="18" fill={`url(#${ground})`} opacity=".27" />
        <ellipse cx="301" cy="430" rx="221" ry="19" fill={`url(#${contactShadow})`} />

        <g className="basket-wicker" strokeLinecap="round" strokeLinejoin="round">
          <path d={handle} stroke="#624a35" strokeWidth="20" fill="none" />
          <path d={handle} stroke={`url(#${cane})`} strokeWidth="17" fill="none" />
          <path d={handle} stroke="#ecd8b4" strokeWidth="10" opacity=".7" fill="none" />
          <path d={handle} stroke="#8b6746" strokeWidth="16" strokeDasharray="1.1 5.8" strokeLinecap="butt" fill="none" />
          <path d="M127 209 C134 125 190 57 274 47 C385 33 465 105 473 211" stroke="#f4e2c3" strokeWidth="1.4" fill="none" />

          <path d={`${rimBack} C525 275 96 302 77 240Z`} fill="#614730" stroke="#624a35" strokeWidth="2" />
          <path d="M91 238 C126 200 260 192 325 196 C432 197 498 218 509 242 C454 270 145 278 91 238Z" fill={`url(#${lining})`} />
          <path d="M99 242 C166 219 243 213 296 213 C383 212 457 220 503 243 M125 251 C179 231 256 229 307 228 C388 228 446 232 482 248" fill="none" stroke="#c5a681" strokeWidth="1.4" opacity=".62" />
          <path d={rimBack} fill="none" stroke="#624a35" strokeWidth="17" />
          <path d={rimBack} fill="none" stroke={`url(#${cane})`} strokeWidth="13" />
          <path d={rimBack} fill="none" stroke="#8b6746" strokeWidth="13" strokeDasharray="1 5" strokeLinecap="butt" />

          <g className="basket-suggestion-slips" strokeLinecap="round" strokeLinejoin="round">
            <g transform="translate(145 190) rotate(-14)">
              <g className="basket-slip basket-slip--letter">
                <path d="M2 14 91 0 105 111 13 124 0 20Z" transform="translate(2 3)" fill="#55402d" opacity=".16" />
                <path d="M2 14 91 0 105 111 13 124 0 20Z" fill={`url(#${warmPaper})`} stroke="#715d46" strokeWidth="1.4" />
                <path d="M8 18 64 9 81 14 15 28Z" fill={`url(#${paperSheen})`} opacity=".48" />
                <path d="M9 18 67 9" fill="none" stroke="#fffdf7" strokeWidth=".9" opacity=".72" />
                <path d="m72 3 19-3 2 21-18-2Z" fill="#e9deca" stroke="#ad997c" strokeWidth=".8" />
                <path d="m72 3 3 16 18 2" fill="none" stroke="#fffaf1" strokeWidth=".8" />
                <path d="m17 43 59-9m-56 21 47-7m-43 19 54-8" fill="none" stroke="#9c8c72" strokeWidth="1.15" />
                <path d="m17 43 59-9m-56 21 47-7m-43 19 54-8" fill="none" stroke="#fffaf1" strokeWidth=".35" opacity=".75" />
                <path d="M2 14 91 0 105 111 13 124 0 20Z" fill={`url(#${grain})`} opacity=".13" />
              </g>
            </g>
            <g transform="translate(370 177) rotate(12)">
              <g className="basket-slip basket-slip--folded">
                <path d="M1 0 90 9 77 119 0 107Z" transform="translate(2 3)" fill="#55402d" opacity=".14" />
                <path d="M1 0 90 9 77 119 0 107Z" fill={`url(#${ivoryPaper})`} stroke="#715d46" strokeWidth="1.4" />
                <path d="m6 8 59 7-5 13L4 20Z" fill={`url(#${paperSheen})`} opacity=".38" />
                <path d="m69 7 21 2-3 22-20-2Z" fill="#e9deca" stroke="#ad997c" strokeWidth=".8" />
                <path d="m69 7-2 20 20 2" fill="none" stroke="#fffaf1" strokeWidth=".8" />
                <path d="m13 47 57 7m-58 7 43 5m-44 7 50 6" fill="none" stroke="#9c8c72" strokeWidth="1.15" />
                <path d="M1 0 90 9 77 119 0 107Z" fill={`url(#${grain})`} opacity=".13" />
              </g>
            </g>
            <g transform="translate(224 151) rotate(4)">
              <g className="basket-slip basket-slip--sticky">
                <path d="M1 1 100 0 105 126 4 129Z" transform="translate(2 3)" fill="#55402d" opacity=".15" />
                <path d="M1 1 100 0 105 126 4 129Z" fill={`url(#${sagePaper})`} stroke="#68735c" strokeWidth="1.5" />
                <path d="M7 8 73 7Q86 8 94 15L18 29Q10 22 7 8Z" fill={`url(#${paperSheen})`} opacity=".54" />
                <path d="M6 5 96 4 101 122 10 125Z" fill="none" stroke="#fffdf6" strokeWidth=".85" opacity=".48" />
                <path d="m31-3 38 1 2 15-38-1Z" fill={`url(#${tapeSheen})`} stroke="#9c8f70" strokeWidth=".8" opacity=".78" />
                <path d="m35-1 32 1" fill="none" stroke="#fffdf6" strokeWidth="1.1" opacity=".92" />
                <path d="M88 25C89 29 90 30 94 31 90 32 89 33 88 37 87 33 86 32 82 31 86 30 87 29 88 25Z" fill="#fffdf6" stroke="#93a07e" strokeWidth=".45" opacity=".88" />
                <path d="M16 37h68m-66 12h55m-54 12h61m-59 12h43" fill="none" stroke="#839071" strokeWidth="1.2" />
                <path d="M16 37h68m-66 12h55m-54 12h61m-59 12h43" fill="none" stroke="#f8f6e8" strokeWidth=".35" opacity=".75" />
                <path d="M1 1 100 0 105 126 4 129Z" fill={`url(#${grain})`} opacity=".12" />
              </g>
            </g>
            <g transform="translate(283 190) rotate(-3)">
              <g className="basket-slip basket-slip--blush">
                <path d="M0 5 73 0 78 93 4 98Z" transform="translate(2 3)" fill="#55402d" opacity=".15" />
                <path d="M0 5 73 0 78 93 4 98Z" fill={`url(#${blushPaper})`} stroke="#80694f" strokeWidth="1.3" />
                <path d="M5 11 48 6 57 12 11 22Z" fill={`url(#${paperSheen})`} opacity=".42" />
                <path d="m55 1 18-1 2 20-19-1Z" fill="#ead5c6" stroke="#ad8d77" strokeWidth=".8" />
                <path d="M14 34h48m-47 11h37m-36 11h42" fill="none" stroke="#a88973" strokeWidth="1.1" />
                <path d="M0 5 73 0 78 93 4 98Z" fill={`url(#${grain})`} opacity=".13" />
              </g>
            </g>
          </g>

          {delivery && (
            <g className="basket-settled-slip">
              <g transform="translate(299 190) rotate(-9)">
                <path d="M0 0h67l3 75H2Z" fill={`url(#${slipPaper})`} stroke="#645940" strokeWidth="1.4" />
                <path d="M0 0h67l1 18-67 1Z" fill="var(--basket-accent-wash)" />
                <path d="M2 19l65-1" stroke="var(--basket-accent-edge)" strokeWidth="1" />
              </g>
            </g>
          )}

          {delivery === 'animated' && (
            <g className="basket-flight">
              <g transform="translate(290 112)">
                <path d="M0 1 73 0 75 65 2 67Z" fill={`url(#${slipPaper})`} stroke="#645940" strokeWidth="1.4" />
                <path d="M12 31h50m-49 9h37m-37 9h42" stroke="var(--basket-accent-edge)" strokeWidth="1.15" />
                <path className="basket-fold" d="M0 1 73 0 74 23 1 24Z" fill="var(--basket-accent-wash)" stroke="var(--basket-accent-edge)" strokeWidth="1" />
              </g>
            </g>
          )}

          <path d={front} fill="#a77e57" stroke="#624a35" strokeWidth="2.2" />
          <g clipPath={`url(#${bodyClip})`} fill="none">
            {stakes.map((d, index) => (
              <path key={d} d={d} stroke={index % 3 === 0 ? '#74563d' : '#8c694a'} strokeWidth="7" />
            ))}
            {courses.map((d, index) => (
              <g key={d}>
                <path d={d} stroke="#7e5b3d" strokeWidth="17" />
                <path d={d} stroke={index % 2 ? '#c29c72' : '#d2b187'} strokeWidth="14" />
                <path d={d} transform="translate(0 -3)" stroke="#edd7b4" strokeWidth="1.35" opacity=".82" />
                <path d={d} transform="translate(0 3)" stroke="#896548" strokeWidth="1.1" opacity=".59" />
              </g>
            ))}
            {stakes.map((d, index) => (
              <g key={d} strokeDasharray="15 26" strokeDashoffset={index % 2 ? '4' : '24'} strokeLinecap="butt">
                <path d={d} stroke="#7e5b3d" strokeWidth="8" />
                <path d={d} stroke="#dfbe95" strokeWidth="5" />
                <path d={d} transform="translate(-1 0)" stroke="#f4dfbd" strokeWidth=".85" />
              </g>
            ))}
            <path d={front} fill={`url(#${bodyShade})`} />
            <path d={front} fill={`url(#${grain})`} opacity=".4" />
          </g>
          <path d="M147 398 C215 433 384 434 451 399" fill="none" stroke="#624a35" strokeWidth="7" />
          <path d="M147 397 C218 430 379 431 451 398" fill="none" stroke="#c9a578" strokeWidth="4" />
          <path d={rimFront} fill="none" stroke="#624a35" strokeWidth="19" />
          <path d={rimFront} fill="none" stroke={`url(#${cane})`} strokeWidth="15" />
          <path d={rimFront} fill="none" stroke="#8b6746" strokeWidth="14" strokeDasharray="1.1 5.5" strokeLinecap="butt" />
          <path d="M81 236 C104 262 189 277 298 276 C412 275 501 256 520 235" fill="none" stroke="#f1d9b5" strokeWidth="2.1" />
        </g>
      </svg>
    </figure>
  );
}
