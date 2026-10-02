import React from 'react';
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { useLayout } from '../../kit/layout';
import { ease, enter, riseTransform } from '../../kit/skin';
import { HighlightedText } from '../../kit/parts';
import { StampMark } from '../../kit/objects';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 끝 화면: 큰 제목 + 도장 (행동 유도) */
const Outro: React.FC<TemplateProps> = ({ data, ev, ink, sub, surf }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const L = useLayout();
  const impact = t.skin.motion.impact;
  const ti = enter(t, frame, ev.title ?? 0, fps);
  const st = ev.stamp ?? 20;
  const stampP = impact
    ? interpolate(frame, [st - 6, st], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) })
    : ease(frame, st - 6, st + 8);
  const stampScale = impact ? 2.2 - 1.2 * stampP : 1.15 - 0.15 * stampP;
  const subIn = enter(t, frame, ev.sub ?? st + 8, fps);
  const hlP = ease(frame, (ev.title ?? 0) + 8, (ev.title ?? 0) + 22);
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: `0 ${L.padX + 10}px` }}>
      <div style={{ fontFamily: t.mono, fontSize: 30, fontWeight: 700, letterSpacing: '0.24em', color: sub, opacity: ti }}>{data.kicker}</div>
      <div style={{ fontSize: 150, fontWeight: 900, color: ink, lineHeight: 1.1, letterSpacing: '-0.03em', opacity: ti, transform: riseTransform(t, ti, 1.5), marginTop: 20 }}>
        <HighlightedText text={data.title || ''} highlight={data.highlight} size={150} surf={surf} ink={ink} progress={hlP} />
      </div>
      <div style={{ marginTop: 40, fontSize: 52, fontWeight: 800, color: ink, opacity: subIn * 0.8 }}>{data.sub}</div>
      {frame >= st - 6 && (
        <div style={{ position: 'absolute', right: L.padX + 30, top: Math.round(L.H * 0.16), transform: `scale(${stampScale}) rotate(-14deg)`, opacity: Math.min(1, stampP * 1.4) }}>
          <StampMark d={300} sw={t.skin.objectStroke} color={t.danger} text={data.stamp} sub={data.stamp_sub} />
        </div>
      )}
    </div>
  );
};

export default Outro;
