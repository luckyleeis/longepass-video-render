import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { ease, enter, riseTransform } from '../../kit/skin';
import { keepAll } from '../../kit/parts';

/** 챕터 카드 (무음). data: {index, title}, ev: {in} */
const ChapterCard: React.FC<TemplateProps> = ({ data, ev, ink }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const p = enter(t, frame, ev.in ?? 0, fps);
  const num = String(data.index ?? 1).padStart(2, '0');
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 60 }}>
      <div style={{ fontSize: 380, fontWeight: 900, lineHeight: 1, color: 'transparent', WebkitTextStroke: `${Math.max(3, t.skin.objectStroke)}px ${t.primary}`, transform: `scale(${0.92 + 0.08 * p})`, opacity: p }}>{num}</div>
      <div>
        <div style={{ fontFamily: t.mono, fontSize: 30, fontWeight: 700, letterSpacing: '0.24em', color: t.primary, opacity: p }}>CHAPTER {num}</div>
        <div style={{ ...keepAll, fontSize: 110, fontWeight: 900, color: ink, lineHeight: 1.15, maxWidth: 1000, opacity: ease(frame, (ev.in ?? 0) + 6, (ev.in ?? 0) + 18), transform: riseTransform(t, p, 1.2, 'x') }}>{data.title}</div>
      </div>
    </div>
  );
};

export default ChapterCard;
