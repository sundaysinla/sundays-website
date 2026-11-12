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
        </defs>

        <ellipse cx="302" cy="430" rx="234" ry="21" fill={`url(#${ground})`} opacity=".52" />
        <ellipse cx="301" cy="431" rx="154" ry="11" fill="#a48762" opacity=".2" />

        <g className="basket-wicker" strokeLinecap="round" strokeLinejoin="round">
          <path d={handle} stroke="#59402b" strokeWidth="20" fill="none" />
          <path d={handle} stroke="#bb8b52" strokeWidth="17" fill="none" />
          <path d={handle} stroke="#efd4a4" strokeWidth="11" fill="none" />
          <path d={handle} stroke="#986737" strokeWidth="17" strokeDasharray="1.2 5.7" strokeLinecap="butt" fill="none" />
          <path d="M127 209 C134 125 190 57 274 47 C385 33 465 105 473 211" stroke="#fae1b5" strokeWidth="1.4" fill="none" />

          <path d={`${rimBack} C525 275 96 302 77 240Z`} fill="#66462d" stroke="#513622" strokeWidth="2" />
          <path d="M91 238 C126 200 260 192 325 196 C432 197 498 218 509 242 C454 270 145 278 91 238Z" fill="#88603d" />
          <path d="M99 242 C166 219 243 213 296 213 C383 212 457 220 503 243 M125 251 C179 231 256 229 307 228 C388 228 446 232 482 248" fill="none" stroke="#b48b5c" strokeWidth="1.4" />
          <path d={rimBack} fill="none" stroke="#593c26" strokeWidth="17" />
          <path d={rimBack} fill="none" stroke="#d3a66a" strokeWidth="13" />
          <path d={rimBack} fill="none" stroke="#986737" strokeWidth="13" strokeDasharray="1 5" strokeLinecap="butt" />

          <g transform="translate(142 189) rotate(-16)">
            <path d="M1 2 120 0 123 93 4 99Z" fill="#f2e3be" stroke="#60452d" strokeWidth="1.5" />
            <path d="M15 22 96 20 M15 33 104 31 M16 44 75 42 M18 55 97 53" fill="none" stroke="#9b7e53" strokeWidth=".9" opacity=".76" />
            <path d="M4 91 122 86 123 93 4 99Z" fill="#d0af79" />
            <path d="M1 2 120 0 123 93 4 99Z" fill={`url(#${grain})`} opacity=".25" />
          </g>
          <g transform="translate(238 155) rotate(7)">
            <path d="M0 2 105 0 108 110 3 112Z" fill="var(--basket-accent-paper)" stroke="#55472d" strokeWidth="1.5" />
            <path d="M0 2 105 0 106 14 1 16Z" fill="var(--basket-accent-band)" />
            <path d="M18 36h67m-65 13h57m-57 13h36" fill="none" stroke="var(--basket-accent-edge)" strokeWidth=".9" />
            <path d="M0 2 105 0 108 110 3 112Z" fill={`url(#${grain})`} opacity=".23" />
          </g>
          <g transform="translate(364 174) rotate(13)">
            <path d="M1 1 102 0 105 107 1 110Z" fill="#fff8e7" stroke="#60452d" strokeWidth="1.5" />
            <path d="m80 .5 22-.5.7 21Z" fill="#e7d7b7" stroke="#a38761" strokeWidth=".8" />
            <image href="/smiley.png" x="27" y="27" width="32" height="32" />
            <path d="M1 1 102 0 105 107 1 110Z" fill={`url(#${grain})`} opacity=".18" />
          </g>

          {delivery && (
            <g className="basket-settled-slip">
              <g transform="translate(299 190) rotate(-9)">
                <path d="M0 0h67l3 75H2Z" fill="var(--basket-accent-paper)" stroke="#5c522d" strokeWidth="1.5" />
                <path d="M0 0h67l1 18-67 1Z" fill="var(--basket-accent-wash)" />
                <path d="M2 19l65-1" stroke="var(--basket-accent-edge)" strokeWidth="1" />
              </g>
            </g>
          )}

          {delivery === 'animated' && (
            <g className="basket-flight">
              <g transform="translate(290 112)">
                <path d="M0 1 73 0 75 65 2 67Z" fill="var(--basket-accent-paper)" stroke="#51482b" strokeWidth="1.4" />
                <path d="M12 31h50m-49 9h37m-37 9h42" stroke="var(--basket-accent-edge)" strokeWidth="1.15" />
                <path className="basket-fold" d="M0 1 73 0 74 23 1 24Z" fill="var(--basket-accent-wash)" stroke="var(--basket-accent-edge)" strokeWidth="1" />
              </g>
            </g>
          )}

          <path d={front} fill="#a67643" stroke="#513622" strokeWidth="2.2" />
          <g clipPath={`url(#${bodyClip})`} fill="none">
            {stakes.map((d, index) => (
              <path key={d} d={d} stroke={index % 3 === 0 ? '#6f4c2f' : '#865b37'} strokeWidth="7" />
            ))}
            {courses.map((d, index) => (
              <g key={d}>
                <path d={d} stroke="#76502f" strokeWidth="17" />
                <path d={d} stroke={index % 2 ? '#bc8c51' : '#d1a266'} strokeWidth="14" />
                <path d={d} transform="translate(0 -3)" stroke="#ead0a0" strokeWidth="1.35" opacity=".88" />
                <path d={d} transform="translate(0 3)" stroke="#8a5e38" strokeWidth="1.1" opacity=".63" />
              </g>
            ))}
            {stakes.map((d, index) => (
              <g key={d} strokeDasharray="15 26" strokeDashoffset={index % 2 ? '4' : '24'} strokeLinecap="butt">
                <path d={d} stroke="#765033" strokeWidth="8" />
                <path d={d} stroke="#e1b781" strokeWidth="5" />
                <path d={d} transform="translate(-1 0)" stroke="#f4d7a6" strokeWidth=".85" />
              </g>
            ))}
            <path d={front} fill={`url(#${grain})`} opacity=".55" />
            <path d="M76 260 C89 367 116 402 159 414 M521 268 C506 368 486 399 438 419" stroke="#67472e" strokeWidth="11" opacity=".27" />
          </g>
          <path d="M147 398 C215 433 384 434 451 399" fill="none" stroke="#5e412a" strokeWidth="7" />
          <path d="M147 397 C218 430 379 431 451 398" fill="none" stroke="#cf9e67" strokeWidth="4" />
          <path d={rimFront} fill="none" stroke="#563a25" strokeWidth="19" />
          <path d={rimFront} fill="none" stroke="#c59961" strokeWidth="15" />
          <path d={rimFront} fill="none" stroke="#8b5d35" strokeWidth="14" strokeDasharray="1.2 5.4" strokeLinecap="butt" />
          <path d="M81 236 C104 262 189 277 298 276 C412 275 501 256 520 235" fill="none" stroke="#eed5aa" strokeWidth="2.1" />
        </g>
      </svg>
    </figure>
  );
}
