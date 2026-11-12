import { useId } from 'react';

const front = 'M77 238 C88 309 107 369 150 399 C202 432 391 433 449 401 C494 375 517 310 525 238 C470 282 144 286 77 238Z';
const rimBack = 'M77 240 C74 212 164 184 299 183 C429 182 525 205 525 238';
const rimFront = 'M77 238 C96 268 186 284 299 282 C415 281 510 261 525 238';
const handle = 'M124 215 C126 129 180 56 271 43 C388 26 477 98 477 212';
const paintTin = 'M10 23H105Q111 23 112 29L116 51Q117 57 111 58H7Q1 58 2 52L5 30Q6 23 10 23Z';
const paintColors = ['#cfab6b', '#bf8a77', '#92a278', '#9a8fae'];
const stampedSlip = 'M1 1 102 0 105 107 1 110Z';

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

          <g transform="translate(245 247) rotate(-18)">
            <image href="/maker-paintbrush.png" x="-36" y="-136" width="180" height="180" />
          </g>
          <image href="/polaroid4.png" width="110" height="163" transform="translate(144 160) rotate(-14)" />
          <g transform="translate(235 192) rotate(7)">
            <path d={paintTin} transform="translate(2 3)" fill="#523d29" opacity=".26" />
            <path d="M8 24 15 6Q16 2 21 2H96Q102 2 103 8L108 24Z" fill="#e5e8db" stroke="#68735c" strokeWidth="1.4" />
            <path d="M22 8H96L99 20H18Z" fill="#f6f3e8" stroke="#aab19a" strokeWidth=".9" />
            <path d="m45 8-2 12m27-12 1 12" fill="none" stroke="#c9cbbb" strokeWidth=".9" />
            <path d={paintTin} fill="#bbc5ab" stroke="#68735c" strokeWidth="1.4" />
            <path d="M12 28H104L109 49H8Z" fill="#f5f1e4" stroke="#929b83" strokeWidth="1" />
            {paintColors.map((color, index) => (
              <rect key={color} x={14 + index * 23} y="32" width="18" height="13" rx="2.6"
                fill={color} stroke="#6b6452" strokeOpacity=".4" strokeWidth=".8" />
            ))}
            <path d="M7 53H111M17 34h10m13 0h10m13 0h10m13 0h10" fill="none" stroke="#fff9e8" strokeWidth="1" opacity=".68" />
            <path d={paintTin} fill={`url(#${grain})`} opacity=".16" />
          </g>
          <g transform="translate(364 174) rotate(13)">
            <path d={stampedSlip} transform="translate(2 2)" fill="#523d29" opacity=".18" />
            <path d={stampedSlip} fill="#fcf8ef" stroke="#715d46" strokeWidth="1.4" />
            <path d="m80 .5 22-.5.7 21Z" fill="#e9deca" stroke="#ad997c" strokeWidth=".8" />
            <path d="m81 1.5 20 18" fill="none" stroke="#fffcf6" strokeWidth=".75" />
            <image href="/smiley.png" x="27" y="27" width="32" height="32" />
            <path d={stampedSlip} fill={`url(#${grain})`} opacity=".18" />
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
