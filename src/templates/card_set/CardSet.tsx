import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { ease, enter, riseTransform } from '../../kit/skin';
import { keepAll } from '../../kit/parts';
import { CheckCard } from '../../kit/objects';
import { useLayout } from '../../kit/layout';

/** 조건 카드 세트(체크 가능). data: {label, cards: [title], check: bool}, ev: {label, cards[], checks[]} */
const CardSet: React.FC<TemplateProps> = ({ data, ev, ink, surf }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const cards: string[] = data.cards || [];
  const n = cards.length;
  const L = useLayout();
  // 카드 줄 전체 폭이 무대보다 넓으면 (세로 쇼츠) 줄 전체를 줄인다
  const fit = Math.min(1, (L.W * 0.92) / Math.max(1, (n - 1) * 330 + 340));
  const lab = enter(t, frame, ev.label ?? 0, fps);
  const colors = t.skin.colorful ? [t.primary, surf.card, t.accent, t.accent2, t.danger] : [surf.card];
  const cardInk = t.skin.colorful ? t.skin.onColorInk : surf.cardInk;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {data.label && <div style={{ ...keepAll, position: 'absolute', top: 150, width: '100%', textAlign: 'center', fontSize: 96, fontWeight: 900, color: ink, opacity: lab, transform: riseTransform(t, lab) }}>{data.label}</div>}
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${fit})`, transformOrigin: '50% 60%' }}>
      {cards.map((title, i) => {
        const p = enter(t, frame, (ev.cards || [])[i] ?? 10 + i * 12, fps);
        const chk = data.check ? ease(frame, (ev.checks || [])[i] ?? 999, ((ev.checks || [])[i] ?? 999) + 12) : 0;
        const spread = i - (n - 1) / 2;
        return (
          <div key={i} style={{ position: 'absolute', left: '50%', top: '60%', transform: `translate(-50%, -50%) translate(${spread * 330 * p}px, ${(1 - p) * 260 + Math.abs(spread) * 24 * p}px) rotate(${spread * Math.min(6, 1 + t.skin.motion.tilt) * p}deg)`, zIndex: i, opacity: Math.min(1, p * 2) }}>
            <CheckCard w={300} sw={t.skin.objectStroke} stroke={t.skin.colorful ? undefined : surf.line} ink={cardInk} bg={colors[i % colors.length]} primary={t.accent2} title={title} checked={chk} idx={i} />
          </div>
        );
      })}
      </div>
    </div>
  );
};

export default CardSet;
