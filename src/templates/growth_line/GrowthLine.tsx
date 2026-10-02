import React from 'react';
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { useLayout } from '../../kit/layout';
import { ease, enter } from '../../kit/skin';
import { Title, fmt, keepAll } from '../../kit/parts';
import { Panel, SCircle, SLine, SPath } from '../../kit/media';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

type Pt = { label: string; value: number; note?: string };

/**
 * 성장 곡선: 꺾은선이 점에서 점으로 자라고, 위쪽 큰 숫자가 선 끝의 값을 따라 올라간다.
 * ev.points[i] = 선 끝이 i번째 점에 닿는 프레임, ev.end = 마지막 점 강조
 */
const GrowthLine: React.FC<TemplateProps> = ({ data, ev, ink, sub, surf }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const L = useLayout();
  const pts: Pt[] = data.points || [];
  const n = Math.max(2, pts.length);
  const vals = pts.map((p) => Number(p.value) || 0);
  const at: number[] = ev.points || pts.map((_, i) => 12 + i * 20);
  // 세로축: 최솟값이 크면 바닥을 올려 변화가 보이게 (값은 점마다 숫자로 표시)
  const top = Math.max(1, ...vals), low = Math.min(...vals);
  const floor = low > top * 0.3 ? Math.floor(low * 0.6) : 0;
  const max = top * 1.12;
  const x0 = L.padX + 60, x1 = L.W - L.padX - 80, y0 = L.H * 0.44, y1 = L.H * 0.78;
  const X = (i: number) => x0 + ((x1 - x0) * i) / (n - 1);
  const Y = (v: number) => y1 - ((y1 - y0) * (v - floor)) / (max - floor);

  // 선 끝의 위치 h (0 ~ n-1, 소수 = 두 점 사이)
  let h = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    if (frame >= at[i]) h = interpolate(frame, [at[i], Math.max(at[i] + 1, at[i + 1])], [i, i + 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  }
  const started = ease(frame, at[0] - 2, at[0] + 8);
  const lo = Math.floor(h), hi = Math.min(pts.length - 1, lo + 1), fr = h - lo;
  const cur = vals[lo] + (vals[hi] - vals[lo]) * fr;
  const line: Array<[number, number]> = [];
  for (let i = 0; i <= lo; i++) line.push([X(i), Y(vals[i])]);
  if (fr > 0) line.push([X(h), Y(cur)]);
  const d = line.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = line.length > 1 ? `${d} L${line[line.length - 1][0].toFixed(1)} ${y1} L${x0} ${y1} Z` : '';
  const endP = ev.end !== undefined ? enter(t, frame, ev.end, fps) : 0;
  const last = pts[pts.length - 1];
  const big = enter(t, frame, at[0] - 6, fps);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Title text={data.title} at={ev.title ?? 0} ink={ink} />
      {/* 큰 숫자 = 선 끝의 값 */}
      <div style={{ position: 'absolute', left: L.padX, top: L.titleTop + 110, display: 'flex', alignItems: 'baseline', gap: 14, opacity: big, fontVariantNumeric: 'tabular-nums' }}>
        {data.prefix && <span style={{ fontSize: 72, fontWeight: 900, color: ink }}>{data.prefix}</span>}
        <span style={{ fontSize: 170, fontWeight: 900, color: ink, letterSpacing: '-0.04em', lineHeight: 1 }}>{fmt(started > 0 ? cur : 0)}</span>
        {data.unit && <span style={{ fontSize: 64, fontWeight: 900, color: ink }}>{data.unit}</span>}
        {data.label && <span style={{ ...keepAll, fontSize: 36, fontWeight: 800, color: sub, marginLeft: 20 }}>{data.label}</span>}
      </div>
      <svg width={L.W} height={L.H} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {[0.25, 0.5, 0.75].map((q, i) => (
          <SLine key={i} x1={x0} y1={y1 - (y1 - y0) * q} x2={x1} y2={y1 - (y1 - y0) * q} stroke={surf.line} sw={2} opacity={0.7 * big} seed={`grid${i}`} />
        ))}
        <SLine x1={x0} y1={y1} x2={x1} y2={y1} stroke={ink} sw={3} opacity={0.6 * big} seed="axis" />
        {area && <SPath d={area} fill={t.accent} opacity={0.14} seed="area" />}
        {line.length > 1 && <SPath d={d} stroke={t.accent} sw={6} strokeLinecap="round" strokeLinejoin="round" seed="line" />}
        {pts.map((p, i) => {
          const on = ease(frame, at[i], at[i] + 8);
          if (on <= 0) return null;
          const isLast = i === pts.length - 1;
          return (
            <g key={i} opacity={on}>
              {isLast && endP > 0 && <SCircle cx={X(i)} cy={Y(vals[i])} r={14 + 26 * endP} stroke={t.primary} sw={4} opacity={1 - endP * 0.6} seed="ring" />}
              <SCircle cx={X(i)} cy={Y(vals[i])} r={isLast ? 13 : 9} fill={isLast ? t.primary : surf.bg} stroke={isLast ? t.primary : t.accent} sw={4} seed={`pt${i}`} />
            </g>
          );
        })}
      </svg>
      {/* 점 값 / 아래 이름 */}
      {pts.map((p, i) => {
        const on = ease(frame, at[i], at[i] + 8);
        return (
          <React.Fragment key={i}>
            <div style={{ position: 'absolute', left: X(i) - 120, width: 240, top: Y(vals[i]) - 66, textAlign: 'center', fontSize: 32, fontWeight: 900, color: ink, opacity: on, fontVariantNumeric: 'tabular-nums' }}>
              {fmt(vals[i])}<span style={{ fontSize: 22, opacity: 0.6, marginLeft: 4 }}>{data.unit}</span>
            </div>
            <div style={{ ...keepAll, position: 'absolute', left: X(i) - 120, width: 240, top: y1 + 18, textAlign: 'center', fontSize: 30, fontWeight: 800, color: sub, opacity: Math.max(0.35 * big, on) }}>{p.label}</div>
          </React.Fragment>
        );
      })}
      {last?.note && endP > 0 && (
        <div style={{ position: 'absolute', left: Math.min(X(pts.length - 1) - 40, L.W - L.padX - 320), top: Y(vals[pts.length - 1]) - 140, opacity: endP }}>
          <Panel fill={t.primary} radius={999} seed="peak-note" style={{ ...keepAll, padding: '8px 24px', color: t.skin.onColorInk, fontSize: 34, fontWeight: 900, whiteSpace: 'nowrap' }}>{last.note}</Panel>
        </div>
      )}
    </div>
  );
};

export default GrowthLine;
