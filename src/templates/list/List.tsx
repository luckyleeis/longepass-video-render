import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { useLayout } from '../../kit/layout';
import { cardPanel, ease, enter, riseTransform } from '../../kit/skin';
import { Dot, Panel } from '../../kit/media';
import { Badge, CheckMark, Title, keepAll } from '../../kit/parts';

/** 목록. data: {title, style: check|number|doc|bullet, items: [{text, sub}]}, ev: {title, items[]} */
const List: React.FC<TemplateProps> = ({ data, ev, ink, surf }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const L = useLayout();
  const items: Array<{ text: string; sub?: string }> = data.items || [];
  const n = items.length;
  const withSub = items.some((it) => it.sub);
  const dense = n >= 5 || (n >= 4 && withSub);
  const size = dense ? 46 : 58;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Title text={data.title} at={ev.title ?? 0} ink={ink} />
      <div style={{ position: 'absolute', top: dense ? L.contentTop - 20 : L.contentTop, left: L.padX, right: L.padX, display: 'flex', flexDirection: 'column', gap: dense ? 14 : 24 }}>
        {items.map((it, i) => {
          const at = (ev.items || [])[i] ?? 10 + i * 15;
          const p = enter(t, frame, at, fps);
          const mark = data.style === 'check'
            ? <CheckMark size={64} color={t.accent2} ink={t.skin.onColorInk} progress={ease(frame, at + 4, at + 16)} />
            : data.style === 'number'
              ? <Badge color={t.primary} ink={t.skin.onColorInk}>{i + 1}</Badge>
              : data.style === 'doc'
                ? <Badge color={t.accent} ink={t.skin.onAccentInk}>▤</Badge>
                : <Dot size={22} fill={t.primary} seed={`bullet${i}`} style={{ margin: 21 }} />;
          return (
            <Panel key={i} {...cardPanel(t, surf)} draw={p} seed={`row${i}`} style={{ color: surf.cardInk, display: 'flex', alignItems: 'center', gap: 30, padding: dense ? '14px 30px' : '22px 34px', opacity: p, transform: riseTransform(t, p, 1.5, 'x') }}>
              {mark}
              <div>
                <div style={{ ...keepAll, fontSize: size, fontWeight: 900, color: surf.cardInk }}>{it.text}</div>
                {it.sub && <div style={{ ...keepAll, fontSize: dense ? 28 : 34, fontWeight: 700, color: surf.cardInk, opacity: 0.6, marginTop: 2 }}>{it.sub}</div>}
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
};

export default List;
