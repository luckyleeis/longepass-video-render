import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { bounce, ease, enter, highlightStyle, riseTransform } from '../../kit/skin';
import { Mark } from '../../kit/media';
import { useLayout } from '../../kit/layout';

/**
 * 전환점 강조: 화면을 채우는 큰 글자 한 자("但") + 짧은 문장.
 * 큰 글자 + 간격 + 문장이 무대의 좌우 여백 안에 들어오게 크기를 정한다 (쇼츠 정사각형 무대 1200 에서 잘리지 않게).
 * 문장 상자 폭은 줄바꿈된 실제 폭으로 잡는다 — 한 줄 폭으로 잡으면 상자가 넓어져 전체가 무대 밖으로 밀린다
 */
const Contrast: React.FC<TemplateProps> = ({ data, ev, ink, sub, surf }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const L = useLayout();
  const impact = t.skin.motion.impact;
  const marker = t.skin.highlight === 'marker';
  const c = bounce(t, frame, ev.char ?? 0, fps, -6);
  const tx = enter(t, frame, ev.text ?? 6, fps);
  const mark = ease(frame, (ev.char ?? 0) + 4, (ev.char ?? 0) + 18);
  const text: string = data.text || '';
  const chars = Math.max(1, Array.from(data.char || '').length);
  const avail = L.W - L.padX * 2;
  const charSize = Math.min(560, Math.round((avail * 0.42) / chars));
  const gap = Math.round(charSize * chars * 0.125);
  const textW = Math.min(900, avail - charSize * chars - gap);
  const len = Math.max(1, Array.from(text).length);
  const want = len <= 6 ? 130 : len <= 9 ? 110 : 92;
  const lines = Math.min(3, Math.ceil((len * want) / textW));
  const perLine = Math.ceil(len / lines);
  const size = Math.min(want, Math.floor(textW / perLine));
  const shadow = Math.round(charSize * 0.025);
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap }}>
      <div style={{ position: 'relative', transform: `scale(${impact ? 1.6 - 0.6 * c : 1.1 - 0.1 * c})`, opacity: Math.min(1, c * 2) }}>
        {marker && <Mark style={highlightStyle(t, surf, mark, charSize)} seed="contrast" />}
        <div style={{ position: 'relative', zIndex: 1, fontSize: charSize, fontWeight: 900, lineHeight: 1, color: marker ? ink : t.primary, textShadow: t.skin.shadow === 'offset' ? `${shadow}px ${shadow}px 0 ${surf.shade || sub}` : 'none' }}>{data.char}</div>
      </div>
      <div style={{ fontSize: size, fontWeight: 900, color: ink, lineHeight: 1.2, width: perLine * size, flexShrink: 0, textWrap: 'balance', opacity: tx, transform: riseTransform(t, tx, 1.5, 'x') } as React.CSSProperties}>{text}</div>
    </div>
  );
};

export default Contrast;
