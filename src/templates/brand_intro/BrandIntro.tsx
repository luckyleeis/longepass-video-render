import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { ease, enter } from '../../kit/skin';
import { Bar, Dot } from '../../kit/media';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/**
 * 채널 인트로 (무음, 훅 바로 뒤에 자동으로). 브랜드 글자가 한 자씩 튀어나오고 밑줄이 그어진 뒤 부제·태그라인.
 * data: {tagline}, ev: {in}. 글자와 색은 스타일 theme.brand 에서.
 */
const BrandIntro: React.FC<TemplateProps> = ({ data, ev, ink, sub }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const at = ev.in ?? 0;
  const letters = t.brand.parts.flatMap((p) => Array.from(p.text).map((ch) => ({ ch, accent: !!p.accent })));
  const step = 2;
  const done = at + letters.length * step + 6;
  const line = ease(frame, done - 4, done + 10);
  const tail = enter(t, frame, done + 2, fps);
  const ring = interpolate(frame, [at, at + 24], [0, 1], clamp);
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -450, marginTop: -450, transform: `scale(${0.3 + 0.9 * ring})`, opacity: 0.5 * (1 - ring) }}>
        <Dot size={900} fill="transparent" stroke={t.primary} sw={6} seed="brand-ring" />
      </div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline' }}>
        {letters.map((l, i) => {
          const p = enter(t, frame, at + i * step, fps);
          const pop = interpolate(frame, [at + i * step, at + i * step + 5, at + i * step + 10], [0.4, 1.12, 1], clamp);
          return (
            <span key={i} style={{ display: 'inline-block', fontSize: 210, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1,
              color: l.accent ? t.primary : ink, opacity: p, transform: `translateY(${(1 - p) * 60}px) scale(${pop})` }}>{l.ch}</span>
          );
        })}
        <Bar color={t.primary} radius={8} seed="brand-line" style={{ position: 'absolute', left: 0, bottom: -26, height: 16, width: `${line * 100}%` }} />
      </div>
      {t.brand.suffix && (
        <div style={{ marginTop: 64, fontSize: 76, fontWeight: 900, color: ink, letterSpacing: '0.12em', opacity: tail, transform: `translateY(${(1 - tail) * 24}px)` }}>{t.brand.suffix}</div>
      )}
      {data.tagline && (
        <div style={{ marginTop: 20, fontFamily: t.mono, fontSize: 30, fontWeight: 700, letterSpacing: '0.3em', color: sub, opacity: ease(frame, done + 8, done + 20) }}>{data.tagline}</div>
      )}
    </div>
  );
};

export default BrandIntro;
