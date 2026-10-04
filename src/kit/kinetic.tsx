import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { Surface } from './types';
import { useMotionTheme } from './theme';
import { useLayout } from './layout';
import { ease, enter, highlightInk, highlightStyle, riseTransform } from './skin';
import { tokenize } from './parts';
import { Bar, Mark } from './media';

/** 줄 길이에 맞춘 큰 글자 크기 (가장 긴 줄 기준) */
export const kineticSize = (lines: string[], max: number) => {
  const longest = Math.max(4, ...lines.map((x) => x.length));
  return Math.round(Math.max(110, Math.min(max, 210 - longest * 13)));
};

/**
 * 줄 단위로 떠오르는 큰 글자. 강조 구절은 형광펜, 취소 구절은 빨간 줄.
 * at[i] = i번째 줄이 나타나는 프레임, strikeAt = 취소선 프레임
 */
export const KineticLines: React.FC<{
  lines: string[]; highlight?: string; strike?: string; kicker?: string;
  size: number; align: 'left' | 'center'; at: number[]; strikeAt?: number; ink: string; sub: string; surf: Surface;
}> = ({ lines, highlight, strike, kicker, size: want, align, at, strikeAt, ink, sub, surf }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const L = useLayout();
  // 가장 긴 줄이 무대 폭을 넘지 않게 (좁은 세로 쇼츠 무대에서만 실제로 줄어든다)
  const longest = Math.max(1, ...lines.map((x) => x.length));
  const size = Math.min(want, Math.floor((align === 'left' ? L.contentW : L.W * 0.9) / longest / 0.97));
  const first = at[0] ?? 0;
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: align === 'left' ? 'flex-start' : 'center', padding: align === 'left' ? `0 ${L.padX}px` : 0 }}>
      {lines.map((line, li) => {
        const lineAt = at[li] ?? first + li * 8;
        const p = enter(t, frame, lineAt, fps);
        return (
          <div key={li} style={{ display: 'flex', alignItems: 'baseline', lineHeight: 1.12, opacity: Math.min(1, p * 1.4), transform: riseTransform(t, p, size / 150) }}>
            {tokenize(line, highlight, strike).map((tok, ti) => {
              const hl = tok.hl ? ease(frame, lineAt + 3, lineAt + 14) : 0;
              const st = tok.strike && strikeAt !== undefined ? ease(frame, strikeAt, strikeAt + 10) : 0;
              return (
                <span key={ti} style={{ position: 'relative', display: 'inline-block', whiteSpace: 'pre' }}>
                  {tok.hl && <Mark style={highlightStyle(t, surf, hl, size)} seed={`hl${li}`} />}
                  <span style={{ position: 'relative', zIndex: 1, fontSize: size, fontWeight: 900, color: tok.hl ? highlightInk(t, surf, ink) : ink, letterSpacing: '-0.03em' }}>{tok.t}</span>
                  {tok.strike && <Bar color={t.danger} radius={size * 0.05} seed={`strike${li}`} style={{ position: 'absolute', left: -size * 0.05, top: '55%', height: size * 0.1, width: `${st * 110}%`, zIndex: 2, transform: 'rotate(-4deg)' }} />}
                </span>
              );
            })}
          </div>
        );
      })}
      {kicker && (
        <div style={{ marginTop: size * 0.35, fontFamily: t.mono, fontSize: size * 0.17, fontWeight: 700, letterSpacing: '0.2em', color: sub, opacity: ease(frame, first + 6, first + 16) }}>
          {kicker}
        </div>
      )}
    </div>
  );
};
