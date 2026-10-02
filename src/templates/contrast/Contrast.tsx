import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { bounce, ease, enter, highlightStyle, riseTransform } from '../../kit/skin';
import { Mark } from '../../kit/media';

/** 전환점 강조: 화면을 채우는 큰 글자 한 자("但") + 짧은 문장 */
const Contrast: React.FC<TemplateProps> = ({ data, ev, ink, sub, surf }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const impact = t.skin.motion.impact;
  const marker = t.skin.highlight === 'marker';
  const c = bounce(t, frame, ev.char ?? 0, fps, -6);
  const tx = enter(t, frame, ev.text ?? 6, fps);
  const mark = ease(frame, (ev.char ?? 0) + 4, (ev.char ?? 0) + 18);
  const text: string = data.text || '';
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 70 }}>
      <div style={{ position: 'relative', transform: `scale(${impact ? 1.6 - 0.6 * c : 1.1 - 0.1 * c})`, opacity: Math.min(1, c * 2) }}>
        {marker && <Mark style={highlightStyle(t, surf, mark, 560)} seed="contrast" />}
        <div style={{ position: 'relative', zIndex: 1, fontSize: 560, fontWeight: 900, lineHeight: 1, color: marker ? ink : t.primary, textShadow: t.skin.shadow === 'offset' ? `14px 14px 0 ${sub}` : 'none' }}>{data.char}</div>
      </div>
      <div style={{ fontSize: text.length <= 6 ? 130 : text.length <= 9 ? 110 : 92, fontWeight: 900, color: ink, lineHeight: 1.2, maxWidth: 900, textWrap: 'balance', opacity: tx, transform: riseTransform(t, tx, 1.5, 'x') } as React.CSSProperties}>{text}</div>
    </div>
  );
};

export default Contrast;
