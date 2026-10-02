import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { useLayout } from '../../kit/layout';
import { ease, enter, riseTransform } from '../../kit/skin';
import { HighlightedText, keepAll, strongLine } from '../../kit/parts';
import { Bar } from '../../kit/media';

/** 영상 제목 카드. data: {kicker, title, highlight, sub}, ev: {title, sub} */
const TitleCard: React.FC<TemplateProps> = ({ data, ev, ink, sub, surf }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const L = useLayout();
  const p = enter(t, frame, ev.title ?? 0, fps);
  const s = enter(t, frame, ev.sub ?? 12, fps);
  const title: string = data.title || '';
  const bar = ease(frame, (ev.title ?? 0) + 6, (ev.title ?? 0) + 22);
  const size = title.length > 12 ? 128 : 150;
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: `0 ${L.padX + 10}px` }}>
      <div style={{ fontFamily: t.mono, fontSize: 30, fontWeight: 700, letterSpacing: '0.24em', color: sub, opacity: p }}>{data.kicker}</div>
      <div style={{ ...keepAll, fontSize: size, fontWeight: 900, color: ink, lineHeight: 1.12, letterSpacing: '-0.03em', marginTop: 18, opacity: p, transform: riseTransform(t, p, 1.4) }}>
        <HighlightedText text={title} highlight={data.highlight} size={size} surf={surf} ink={ink} progress={bar} />
      </div>
      <Bar color={strongLine(t, surf)} radius={5} seed="title-bar" style={{ height: 10, width: `${bar * 14}%`, margin: '40px 0 30px' }} />
      <div style={{ ...keepAll, fontSize: 50, fontWeight: 800, color: ink, opacity: s * 0.75 }}>{data.sub}</div>
    </div>
  );
};

export default TitleCard;
