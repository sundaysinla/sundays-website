"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphEdge, GraphNode } from "@/lib/attendance";

type Pos = { x: number; y: number; vx: number; vy: number };

/**
 * A small force-directed graph: you in the middle, everyone you've met around
 * you, and lines between people who have met each other. Runs a few hundred
 * ticks of a spring simulation in the browser; no library.
 */
export default function MetGraph({ nodes, edges, size = 420 }: { nodes: GraphNode[]; edges: GraphEdge[]; size?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(size);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.min(size, e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [size]);
  const h = Math.round(w * 0.8);

  const layout = useMemo(() => {
    const idx = new Map(nodes.map((n, i) => [n.id, i]));
    const pos: Pos[] = nodes.map((n, i) => {
      if (n.me) return { x: w / 2, y: h / 2, vx: 0, vy: 0 };
      const a = (i / Math.max(1, nodes.length - 1)) * Math.PI * 2;
      const r = Math.min(w, h) * 0.32;
      return { x: w / 2 + Math.cos(a) * r, y: h / 2 + Math.sin(a) * r, vx: 0, vy: 0 };
    });
    const links = edges.map((e) => [idx.get(e.a)!, idx.get(e.b)!] as const).filter(([a, b]) => a != null && b != null);
    const rest = Math.min(w, h) * (nodes.length > 12 ? 0.22 : 0.3);
    for (let t = 0; t < 300; t++) {
      // repulsion
      for (let i = 0; i < pos.length; i++) {
        for (let j = i + 1; j < pos.length; j++) {
          const dx = pos[j].x - pos[i].x;
          const dy = pos[j].y - pos[i].y;
          const d2 = Math.max(100, dx * dx + dy * dy);
          const f = 2200 / d2;
          const fx = (dx / Math.sqrt(d2)) * f;
          const fy = (dy / Math.sqrt(d2)) * f;
          pos[i].vx -= fx; pos[i].vy -= fy;
          pos[j].vx += fx; pos[j].vy += fy;
        }
      }
      // springs
      for (const [a, b] of links) {
        const dx = pos[b].x - pos[a].x;
        const dy = pos[b].y - pos[a].y;
        const d = Math.max(1, Math.hypot(dx, dy));
        const f = (d - rest) * 0.02;
        pos[a].vx += (dx / d) * f; pos[a].vy += (dy / d) * f;
        pos[b].vx -= (dx / d) * f; pos[b].vy -= (dy / d) * f;
      }
      // gravity to centre + damping
      for (let i = 0; i < pos.length; i++) {
        if (nodes[i].me) { pos[i].x = w / 2; pos[i].y = h / 2; pos[i].vx = 0; pos[i].vy = 0; continue; }
        pos[i].vx += (w / 2 - pos[i].x) * 0.004;
        pos[i].vy += (h / 2 - pos[i].y) * 0.004;
        pos[i].vx *= 0.82; pos[i].vy *= 0.82;
        pos[i].x = Math.max(28, Math.min(w - 28, pos[i].x + pos[i].vx));
        pos[i].y = Math.max(28, Math.min(h - 28, pos[i].y + pos[i].vy));
      }
    }
    // Node and the browser disagree in the last float digit, which React reports as a hydration mismatch.
    for (const p of pos) { p.x = Math.round(p.x * 10) / 10; p.y = Math.round(p.y * 10) / 10; }
    return { pos, links };
  }, [nodes, edges, w, h]);

  if (nodes.length <= 1) return null;

  return (
    <div ref={ref} className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="block max-w-full" role="img" aria-label={`${nodes.length - 1} people you've met`}>
        {layout.links.map(([a, b], i) => {
          const e = edges[i];
          const toMe = nodes[a].me || nodes[b].me;
          return (
            <line
              key={i}
              x1={layout.pos[a].x} y1={layout.pos[a].y} x2={layout.pos[b].x} y2={layout.pos[b].y}
              stroke={toMe ? "#010101" : "#3600CF"}
              strokeOpacity={toMe ? 0.35 : 0.35}
              strokeWidth={Math.min(3, 1 + (e?.times ?? 1) * 0.5)}
              strokeDasharray={toMe ? undefined : "3 3"}
            />
          );
        })}
        {nodes.map((n, i) => {
          const p = layout.pos[i];
          const r = n.me ? 22 : 16 + Math.min(6, n.times * 2);
          return (
            <g key={n.id} transform={`translate(${p.x},${p.y})`}>
              <title>{`${n.name}${n.me ? " (you)" : ` · ${n.times} Sunday${n.times === 1 ? "" : "s"}`}`}</title>
              {n.avatarUrl ? (
                <>
                  <clipPath id={`clip-${i}`}><circle r={r} /></clipPath>
                  <image href={n.avatarUrl} x={-r} y={-r} width={r * 2} height={r * 2} clipPath={`url(#clip-${i})`} preserveAspectRatio="xMidYMid slice" />
                  <circle r={r} fill="none" stroke={n.me ? "#CBFF36" : "#FCFAF7"} strokeWidth={n.me ? 3 : 2} />
                </>
              ) : (
                <>
                  <circle r={r} fill={n.me ? "#010101" : "#C3B3F1"} stroke={n.me ? "#CBFF36" : "#FCFAF7"} strokeWidth={2} />
                  <text textAnchor="middle" dominantBaseline="central" fontFamily="'PP Neue Montreal','Monument-Grotesk',sans-serif" fontSize={n.me ? 13 : 11} fill={n.me ? "#CBFF36" : "#010101"}>
                    {n.me ? "me" : n.firstName.slice(0, 1).toUpperCase()}
                  </text>
                </>
              )}
              {!n.me ? (
                <text y={r + 12} textAnchor="middle" fontFamily="'Office-Times-Sharp-Regular',Georgia,serif" fontSize={11} fill="#010101" fillOpacity={0.75}>
                  {n.firstName}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
