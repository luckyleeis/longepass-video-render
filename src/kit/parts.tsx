import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { MotionTheme, Surface } from './types';
import { useMotionTheme } from './theme';
import { useLayout } from './layout';
import { enter, highlightInk, highlightStyle, riseTransform } from './skin';
import { Bar, Mark, Panel, SCircle, SPath } from './media';

/** 한중일 글자를 단어 중간에서 끊지 않는 줄바꿈 */
export const keepAll: React.CSSProperties = { wordBreak: 'keep-all', overflowWrap: 'anywhere' };

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** 진행선/연결선처럼 "눈에 띄어야 하는 선" 색: 굵은 테두리 스킨은 글자색, 아니면 강조색 */
export const strongLine = (t: MotionTheme, surf: Surface) => (t.skin.cardBorderColor === 'ink' ? surf.ink : t.primary);

/** 화면 위쪽 제목 줄 (강조색 막대 + 제목) */
export const Title: React.FC<{ text?: string; at: number; ink: string; size?: number }> = ({ text, at, ink, size = 76 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const L = useLayout();
  if (!text) return null;
  const p = enter(t, frame, at, fps);
  return (
    <div style={{ position: 'absolute', top: L.titleTop, left: L.padX, right: L.padX, display: 'flex', alignItems: 'center', gap: 26, opacity: p, transform: riseTransform(t, p, 0.6) }}>
      <Bar vertical color={t.primary} radius={7} style={{ width: 14, height: size * 0.9 }} />
      <div style={{ ...keepAll, fontSize: size, fontWeight: 900, color: ink, letterSpacing: '-0.02em' }}>{text}</div>
    </div>
  );
};

/** 문장 속 한 구절에 강조(형광펜/알약)를 입힌다. progress 0→1로 강조가 그어진다 */
export const HighlightedText: React.FC<{ text: string; highlight?: string; size: number; surf: Surface; ink: string; progress: number }> = ({
  text, highlight, size, surf, ink, progress,
}) => {
  const t = useMotionTheme();
  if (!highlight || !text.includes(highlight)) return <>{text}</>;
  const parts = text.split(highlight);
  return (
    <>
      {parts[0]}
      <span style={{ position: 'relative', display: 'inline-block' }}>
        <Mark style={highlightStyle(t, surf, progress, size)} />
        <span style={{ position: 'relative', zIndex: 1, color: highlightInk(t, surf, ink) }}>{highlight}</span>
      </span>
      {parts.slice(1).join(highlight)}
    </>
  );
};

/** 둥근 사각 배지 (번호/아이콘) */
export const Badge: React.FC<{ color: string; ink: string; size?: number; children: React.ReactNode }> = ({ color, ink, size = 64, children }) => (
  <Panel fill={color} radius={size * 0.28} style={{ width: size, height: size, flexShrink: 0, color: ink, fontSize: size * 0.56, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</Panel>
);

/** 원 + 그려지는 체크 표시 */
export const CheckMark: React.FC<{ size: number; color: string; ink: string; progress: number }> = ({ size, color, ink, progress }) => (
  <svg width={size} height={size} viewBox="0 0 40 40">
    <SCircle cx={20} cy={20} r={18} fill={color} seed="checkmark" />
    <SPath d="M11 21 l6 6 l12 -13" stroke={ink} sw={4.5} fill="none" strokeLinecap="round" strokeLinejoin="round" reveal={progress} seed="checkmark-v" />
  </svg>
);

/** 줄을 강조/취소선 조각으로 나눈다: "把握 90 天" + highlight "90 天" → [{t:"把握 "}, {t:"90 天", hl:true}] */
export type Token = { t: string; hl?: boolean; strike?: boolean };
export const tokenize = (line: string, highlight?: string, strike?: string): Token[] => {
  let toks: Token[] = [{ t: line }];
  for (const [key, flag] of [[highlight, 'hl'], [strike, 'strike']] as const) {
    if (!key || !line.includes(key)) continue;
    const next: Token[] = [];
    for (const tk of toks) {
      if (tk.hl || tk.strike || !tk.t.includes(key)) { next.push(tk); continue; }
      const i = tk.t.indexOf(key);
      const pre = tk.t.slice(0, i), post = tk.t.slice(i + key.length);
      if (pre) next.push({ t: pre });
      next.push({ t: key, [flag]: true });
      if (post) next.push({ t: post });
    }
    toks = next;
  }
  return toks;
};
