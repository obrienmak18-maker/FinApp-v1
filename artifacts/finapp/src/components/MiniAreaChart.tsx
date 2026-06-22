/**
 * MiniAreaChart — Pure SVG area chart
 * Replaces recharts (~400 KB) with zero dependencies.
 * Features: smooth catmull-rom curves, gradient fills, hover tooltip, animated draw.
 */
import React, { useRef, useState, useCallback } from 'react';

export interface ChartDataPoint {
  name: string;
  value1: number; // revenus
  value2: number; // dépenses
}

interface MiniAreaChartProps {
  data: ChartDataPoint[];
  currency?: string;
  height?: number;
  label1?: string;
  label2?: string;
  color1?: string; // hex
  color2?: string; // hex
}

const PAD = { top: 10, right: 8, bottom: 28, left: 44 };

/** Catmull-Rom spline → SVG cubic bezier path */
function smoothLine(pts: [number, number][]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0][0]},${pts[0][1]}`;
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}

function areaPath(linePath: string, pts: [number, number][], bottom: number): string {
  if (pts.length === 0) return '';
  return `${linePath} L ${pts[pts.length - 1][0].toFixed(2)},${bottom} L ${pts[0][0].toFixed(2)},${bottom} Z`;
}

function fmtValue(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return String(Math.round(v));
}

export default function MiniAreaChart({
  data,
  currency = 'EUR',
  height = 170,
  label1 = 'Revenus',
  label2 = 'Dépenses',
  color1 = '#34d399',
  color2 = '#f87171',
}: MiniAreaChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; name: string; v1: number; v2: number;
  } | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [svgWidth, setSvgWidth] = useState(300);

  // Observe container width
  const containerRef = useCallback((node: SVGSVGElement | null) => {
    if (!node) return;
    (svgRef as React.MutableRefObject<SVGSVGElement | null>).current = node;
    const ro = new ResizeObserver(entries => {
      setSvgWidth(entries[0].contentRect.width || 300);
    });
    ro.observe(node.parentElement!);
    setSvgWidth(node.parentElement?.clientWidth || 300);
    return () => ro.disconnect();
  }, []);

  if (data.length === 0) return null;

  const W = svgWidth;
  const H = height;
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const bottom = PAD.top + chartH;

  const allVals = data.flatMap(d => [d.value1, d.value2]);
  const maxVal = Math.max(...allVals, 1);

  const stepX = data.length > 1 ? chartW / (data.length - 1) : chartW;
  const toX = (i: number) => PAD.left + i * stepX;
  const toY = (v: number) => PAD.top + chartH * (1 - v / maxVal);

  const pts1: [number, number][] = data.map((d, i) => [toX(i), toY(d.value1)]);
  const pts2: [number, number][] = data.map((d, i) => [toX(i), toY(d.value2)]);

  const line1 = smoothLine(pts1);
  const line2 = smoothLine(pts2);
  const area1 = areaPath(line1, pts1, bottom);
  const area2 = areaPath(line2, pts2, bottom);

  // Y axis ticks
  const yTicks = [0, maxVal / 2, maxVal];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left - PAD.left;
    const idx = Math.max(0, Math.min(data.length - 1, Math.round(mouseX / stepX)));
    const d = data[idx];
    setHoverIdx(idx);
    setTooltip({
      x: toX(idx),
      y: Math.min(toY(d.value1), toY(d.value2)) - 8,
      name: d.name,
      v1: d.value1,
      v2: d.value2,
    });
  };

  const handleMouseLeave = () => {
    setHoverIdx(null);
    setTooltip(null);
  };

  return (
    <div className="relative w-full select-none">
      <svg
        ref={containerRef}
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="mcg1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color1} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color1} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="mcg2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color2} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color2} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y grid lines + labels */}
        {yTicks.map((v, i) => {
          const y = toY(v);
          return (
            <g key={i}>
              <line
                x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                stroke="hsl(230 18% 25%)" strokeWidth="1" strokeDasharray="3 4"
              />
              <text x={PAD.left - 5} y={y + 3.5}
                fill="hsl(230 18% 52%)" fontSize="9" textAnchor="end"
              >
                {fmtValue(v)}
              </text>
            </g>
          );
        })}

        {/* Area fills */}
        <path d={area1} fill="url(#mcg1)" />
        <path d={area2} fill="url(#mcg2)" />

        {/* Lines */}
        <path d={line1} fill="none" stroke={color1} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d={line2} fill="none" stroke={color2} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* X axis labels */}
        {data.map((d, i) => (
          <text
            key={d.name + i}
            x={toX(i)} y={H - 6}
            fill="hsl(230 18% 52%)" fontSize="10" textAnchor="middle"
          >
            {d.name}
          </text>
        ))}

        {/* Hover vertical line */}
        {hoverIdx !== null && (
          <line
            x1={toX(hoverIdx)} y1={PAD.top}
            x2={toX(hoverIdx)} y2={bottom}
            stroke="hsl(230 18% 45%)" strokeWidth="1" strokeDasharray="3 3"
          />
        )}

        {/* Hover dots */}
        {hoverIdx !== null && (
          <>
            <circle cx={pts1[hoverIdx][0]} cy={pts1[hoverIdx][1]} r="4" fill={color1} />
            <circle cx={pts2[hoverIdx][0]} cy={pts2[hoverIdx][1]} r="4" fill={color2} />
          </>
        )}
      </svg>

      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 px-3 py-2 rounded-xl text-xs shadow-xl"
          style={{
            background: 'hsl(230 20% 12% / 0.95)',
            border: '1px solid hsl(230 18% 22%)',
            backdropFilter: 'blur(12px)',
            left: Math.min(tooltip.x - 60, W - PAD.right - 130),
            top: Math.max(0, tooltip.y - 68),
            minWidth: 120,
          }}
        >
          <p className="font-semibold text-foreground mb-1.5">{tooltip.name}</p>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="w-2 h-2 rounded-full" style={{ background: color1 }} />
            <span className="text-muted-foreground">{label1}</span>
            <span className="ml-auto font-semibold text-foreground">{tooltip.v1.toFixed(0)} {currency}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: color2 }} />
            <span className="text-muted-foreground">{label2}</span>
            <span className="ml-auto font-semibold text-foreground">{tooltip.v2.toFixed(0)} {currency}</span>
          </div>
        </div>
      )}
    </div>
  );
}
