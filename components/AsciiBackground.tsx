"use client";
import { useEffect, useRef } from "react";

const TILE_COLS = 50;
const TILE_ROWS = 22;
const CHAR_W = 7.2;
const LINE_HEIGHT = 13;
const TILE_W = TILE_COLS * CHAR_W;
const TILE_H = TILE_ROWS * LINE_HEIGHT;
const FIELD_OVERSAMPLE = 2;
const FIELD_COLS = TILE_COLS * FIELD_OVERSAMPLE;
const FIELD_ROWS = TILE_ROWS * FIELD_OVERSAMPLE;
const SCALE_X = FIELD_COLS / TILE_W;
const SCALE_Y = FIELD_ROWS / TILE_H;
const PARTICLE_N = 180;
const SPRITE_R = 28;
const LARGE_R = 50;
const SMALL_R = 22;
const FIELD_DECAY = 0.86;
const MONO_RAMP = " .`-_:,;^=+/|)\\!?0oOQ#%@";

type Particle = { x: number; y: number; vx: number; vy: number };

function spriteAlpha(d: number): number {
  if (d >= 1) return 0;
  if (d <= 0.3) return 0.5 + (0.2 - 0.5) * (d / 0.3);
  return 0.2 * (1 - (d - 0.3) / 0.7);
}

function makeStamp(r: number) {
  const rx = Math.ceil(r * SCALE_X);
  const ry = Math.ceil(r * SCALE_Y);
  const frx = r * SCALE_X;
  const fry = r * SCALE_Y;
  const sx = rx * 2 + 1;
  const v = new Float32Array(sx * (ry * 2 + 1));
  for (let y = -ry; y <= ry; y++)
    for (let x = -rx; x <= rx; x++)
      v[(y + ry) * sx + x + rx] = spriteAlpha(Math.sqrt((x / frx) ** 2 + (y / fry) ** 2));
  return { rx, ry, sx, v };
}

function splat(field: Float32Array, cx: number, cy: number, stamp: ReturnType<typeof makeStamp>) {
  const gcx = Math.round(cx * SCALE_X);
  const gcy = Math.round(cy * SCALE_Y);
  for (let y = -stamp.ry; y <= stamp.ry; y++) {
    const gy = gcy + y;
    if (gy < 0 || gy >= FIELD_ROWS) continue;
    const fro = gy * FIELD_COLS;
    const sro = (y + stamp.ry) * stamp.sx;
    for (let x = -stamp.rx; x <= stamp.rx; x++) {
      const gx = gcx + x;
      if (gx < 0 || gx >= FIELD_COLS) continue;
      const sv = stamp.v[sro + x + stamp.rx]!;
      if (sv === 0) continue;
      const fi = fro + gx;
      field[fi] = Math.min(1, field[fi]! + sv);
    }
  }
}

export default function AsciiBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const tilesX = Math.ceil(rect.width / TILE_W) + 1;
    const tilesY = Math.ceil(rect.height / TILE_H) + 1;

    type TileSim = {
      el: HTMLDivElement;
      particles: Particle[];
      field: Float32Array;
      timeOffset: number;
    };

    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = `repeat(${tilesX}, ${TILE_W}px)`;
    grid.style.gridTemplateRows = `repeat(${tilesY}, ${TILE_H}px)`;
    grid.style.position = "absolute";
    grid.style.inset = "0";
    grid.style.overflow = "hidden";
    container.appendChild(grid);

    const pStamp = makeStamp(SPRITE_R);
    const lgStamp = makeStamp(LARGE_R);
    const smStamp = makeStamp(SMALL_R);

    const tiles: TileSim[] = [];
    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        const tile = document.createElement("div");
        tile.style.width = `${TILE_W}px`;
        tile.style.height = `${TILE_H}px`;
        tile.style.overflow = "hidden";
        grid.appendChild(tile);

        const inner = document.createElement("div");
        inner.style.whiteSpace = "pre";
        inner.style.fontFamily = '"Courier New", Courier, monospace';
        inner.style.fontSize = "11px";
        inner.style.lineHeight = `${LINE_HEIGHT}px`;
        inner.style.letterSpacing = "0px";
        tile.appendChild(inner);

        const particles: Particle[] = [];
        for (let i = 0; i < PARTICLE_N; i++) {
          particles.push({
            x: Math.random() * TILE_W,
            y: Math.random() * TILE_H,
            vx: (Math.random() - 0.5) * 1.2,
            vy: (Math.random() - 0.5) * 1.2,
          });
        }

        tiles.push({
          el: inner,
          particles,
          field: new Float32Array(FIELD_COLS * FIELD_ROWS),
          timeOffset: (ty * tilesX + tx) * 12000 + Math.random() * 8000,
        });
      }
    }

    let raf = 0;

    function simTile(t: TileSim, now: number) {
      const n = now + t.timeOffset;
      const a1x = Math.cos(n * 0.0006) * TILE_W * 0.3 + TILE_W / 2;
      const a1y = Math.sin(n * 0.0009) * TILE_H * 0.35 + TILE_H / 2;
      const a2x = Math.cos(n * 0.001 + 2) * TILE_W * 0.25 + TILE_W / 2;
      const a2y = Math.sin(n * 0.0007 + 2) * TILE_H * 0.3 + TILE_H / 2;
      const a3x = Math.cos(n * 0.0008 + 4) * TILE_W * 0.35 + TILE_W / 2;
      const a3y = Math.sin(n * 0.0005 + 4) * TILE_H * 0.3 + TILE_H / 2;

      const atts = [
        { x: a1x, y: a1y, f: 0.15 },
        { x: a2x, y: a2y, f: 0.06 },
        { x: a3x, y: a3y, f: 0.10 },
      ];

      for (const p of t.particles) {
        let best = Infinity, bx = 0, by = 0, bf = 0.06;
        for (const a of atts) {
          const dx = a.x - p.x, dy = a.y - p.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < best) { best = d2; bx = dx; by = dy; bf = a.f; }
        }
        const d = Math.sqrt(best) + 1;
        p.vx += (bx / d) * bf + (Math.random() - 0.5) * 0.4;
        p.vy += (by / d) * bf + (Math.random() - 0.5) * 0.4;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x += TILE_W;
        if (p.x > TILE_W) p.x -= TILE_W;
        if (p.y < 0) p.y += TILE_H;
        if (p.y > TILE_H) p.y -= TILE_H;
      }

      const { field } = t;
      for (let i = 0; i < field.length; i++) field[i] = field[i]! * FIELD_DECAY;
      for (const p of t.particles) splat(field, p.x, p.y, pStamp);
      splat(field, a1x, a1y, lgStamp);
      splat(field, a2x, a2y, smStamp);
      splat(field, a3x, a3y, lgStamp);

      const lines: string[] = [];
      for (let row = 0; row < TILE_ROWS; row++) {
        let text = "";
        const frs = row * FIELD_OVERSAMPLE * FIELD_COLS;
        for (let col = 0; col < TILE_COLS; col++) {
          const fcs = col * FIELD_OVERSAMPLE;
          let b = 0;
          for (let sy = 0; sy < FIELD_OVERSAMPLE; sy++) {
            const off = frs + sy * FIELD_COLS + fcs;
            for (let sx = 0; sx < FIELD_OVERSAMPLE; sx++) b += field[off + sx]!;
          }
          const byte = Math.min(255, ((b / (FIELD_OVERSAMPLE * FIELD_OVERSAMPLE)) * 255) | 0);
          text += MONO_RAMP[Math.min(MONO_RAMP.length - 1, ((byte / 255) * MONO_RAMP.length) | 0)];
        }
        lines.push(text);
      }
      t.el.textContent = lines.join("\n");
    }

    function render(now: number) {
      for (const t of tiles) simTile(t, now);
      raf = requestAnimationFrame(render);
    }

    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      while (container.firstChild) container.removeChild(container.firstChild);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden text-stone-300 pointer-events-none select-none opacity-50"
      aria-hidden="true"
    />
  );
}
