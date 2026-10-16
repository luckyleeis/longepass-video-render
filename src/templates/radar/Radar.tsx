import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { useLayout } from '../../kit/layout';
import { ease, enter } from '../../kit/skin';
import { keepAll } from '../../kit/parts';
import { KineticLines, kineticSize } from '../../kit/kinetic';
import { Bar, SCircle, SLine, SPath } from '../../kit/media';

type Axis = { label: string; value: number; base?: number };

/**
 * 레이더 차트: 왼쪽 큰 글자, 오른쪽에 축이 하나씩 생기고 마지막에 값 다각형이 가운데서 퍼진다.
 * base가 있으면 비교 기준(점선)을 함께 그린다.
 */
const Radar: React.FC<TemplateProps> = ({ data, ev, ink, sub, surf }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const L = useLayout();
  const lines: string[] = data.lines || [];
  const axes: Axis[] = data.axes || [];
  const n = Math.max(3, axes.length);
  const cx = L.W * 0.72, cy = L.H * 0.56, R = 290;
  const ang = (k: number) => -Math.PI / 2 + (k * 2 * Math.PI) / n;
  const pt = (k: number, r: number): [number, number] => [cx + Math.cos(ang(k)) * r, cy + Math.sin(ang(k)) * r];
  const axAt: number[] = ev.axes || axes.map((_, k) => 10 + k * 10);
  const gridIn = ease(frame, (axAt[0] ?? 0) - 12, (axAt[0] ?? 0) + 6);
  const shape = ev.shape !== undefined ? ease(frame, ev.shape, ev.shape + 22) : 0;
  const poly = (vals: number[], g: number) => vals.map((v, k) => pt(k, (R * Math.max(0, Math.min(100, v)) / 100) * g))
    .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + ' Z';
  const hasBase = axes.some((a) => a.base !== undefined && a.base !== null);
  const legend: string[] = data.legend || [];

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '52%' }}>
        <KineticLines lines={lines} highlight={data.highlight} size={kineticSize(lines, 140)} align="left" at={ev.lines || []} ink={ink} sub={sub} surf={surf} box={0.52} />
      </div>
      <svg width={L.W} height={L.H} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {[0.25, 0.5, 0.75, 1].map((q, i) => (
          <SPath key={i} d={poly(Array(n).fill(100 * q), 1)} stroke={surf.line} sw={2} opacity={gridIn * (i === 3 ? 1 : 0.7)} subtle seed={`ring${i}`} />
        ))}
        {axes.map((_, k) => {
          const on = ease(frame, axAt[k] - 4, axAt[k] + 8);
          const [x, y] = pt(k, R);
          return <SLine key={k} x1={cx} y1={cy} x2={cx + (x - cx) * on} y2={cy + (y - cy) * on} stroke={surf.line} sw={2} seed={`spoke${k}`} />;
        })}
        {hasBase && shape > 0 && <SPath d={poly(axes.map((a) => a.base ?? 0), shape)} stroke={sub} sw={3} strokeDasharray="10 8" opacity={0.8} subtle seed="base" />}
        {shape > 0 && <SPath d={poly(axes.map((a) => a.value), shape)} fill={t.primary} opacity={0.35} seed="shape-fill" />}
        {shape > 0 && <SPath d={poly(axes.map((a) => a.value), shape)} stroke={t.primary} sw={5} strokeLinejoin="round" seed="shape" />}
        {shape > 0.95 && axes.map((a, k) => {
          const [x, y] = pt(k, (R * Math.max(0, Math.min(100, a.value))) / 100);
          return <SCircle key={k} cx={x} cy={y} r={9} fill={surf.bg} stroke={t.primary} sw={4} seed={`v${k}`} />;
        })}
      </svg>
      {axes.map((a, k) => {
        const p = enter(t, frame, axAt[k], fps);
        const [x, y] = pt(k, R + 64);
        return (
          <div key={k} style={{ ...keepAll, position: 'absolute', left: x - 130, top: y - 28, width: 260, textAlign: 'center', fontSize: 36, fontWeight: 900, color: ink, opacity: p, transform: `scale(${0.85 + 0.15 * p})` }}>
            {a.label}
            {shape > 0.5 && <div style={{ fontSize: 26, fontWeight: 800, color: sub, opacity: shape }}>{Math.round(a.value)}</div>}
          </div>
        );
      })}
      {legend.length > 0 && shape > 0 && (
        <div style={{ position: 'absolute', right: L.padX, bottom: L.H * 0.06, display: 'flex', gap: 28, opacity: shape, fontSize: 28, fontWeight: 800, color: sub }}>
          {legend.slice(0, 2).map((lb, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Bar color={i ? sub : t.primary} radius={3} seed={`lg${i}`} style={{ width: 36, height: 6 }} />{lb}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Radar;
