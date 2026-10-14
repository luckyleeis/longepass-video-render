import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { useLayout } from '../../kit/layout';
import { bounce, ease } from '../../kit/skin';
import { Panel } from '../../kit/media';
import { keepAll } from '../../kit/parts';

/**
 * 단어 하나씩 화면을 가득 채우며 쾅 (키네틱 타이포). 단어마다 바탕색이 통째로 바뀐다.
 * 카드·제목줄 없는 화면이라 정보 장면 사이의 쉼표, 영상의 리듬을 바꾸는 장면으로 쓴다.
 * data: {words[], tail}, ev: {words[], tail}
 */
const WordSlam: React.FC<TemplateProps> = ({ data, ev }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const L = useLayout();
  const words: string[] = data.words || [];
  const at: number[] = ev.words || [];
  const S = t.surfaces;
  // 바탕 / 글자색 순환: 강조색 → 어두운 면 → 깊은 면 → 기본 면
  const looks = [
    { bg: t.primary, ink: t.skin.onColorInk },
    { bg: S.alt?.bg || S.base.bg, ink: S.alt?.ink || S.base.ink },
    { bg: S.deep?.bg || t.accent, ink: S.deep?.ink || t.skin.onAccentInk },
    { bg: S.base.bg, ink: S.base.ink },
  ];
  let cur = 0;
  at.forEach((f, i) => { if (frame >= f) cur = i; });
  const look = looks[cur % looks.length];
  const word = words[cur] || '';
  const start = at[cur] ?? 0;
  const p = bounce(t, frame, start, fps, -6);
  const chars = Math.max(1, Array.from(word).length);
  const size = Math.round(Math.min(L.H * 0.56, (L.W * 0.86) / chars));
  const wipe = ease(frame, start, start + 6);
  const prev = cur > 0 ? looks[(cur - 1) % looks.length] : look;
  const last = cur === words.length - 1;
  const tailP = ease(frame, ev.tail ?? start + 14, (ev.tail ?? start + 14) + 12);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <Panel fill={prev.bg} fillStyle="solid" style={{ position: 'absolute', inset: 0 }} />
      <Panel fill={look.bg} fillStyle="solid" style={{ position: 'absolute', inset: 0, clipPath: cur > 0 ? `circle(${wipe * 120}% at 50% 50%)` : 'none' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div key={cur} style={{ ...keepAll, whiteSpace: 'nowrap', fontSize: size, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.04em', color: look.ink,
          opacity: Math.min(1, p * 2), transform: `scale(${t.skin.motion.impact ? 1.5 - 0.5 * p : 1.15 - 0.15 * p}) rotate(${(1 - p) * (cur % 2 ? 4 : -4)}deg)` }}>
          {word}
        </div>
        {last && data.tail && (
          <div style={{ ...keepAll, marginTop: Math.round(size * 0.12), fontSize: Math.max(44, Math.round(size * 0.18)), fontWeight: 800, color: look.ink, opacity: tailP * 0.85, transform: `translateY(${(1 - tailP) * 20}px)` }}>
            {data.tail}
          </div>
        )}
      </div>
    </div>
  );
};

export default WordSlam;
