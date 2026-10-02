import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { useLayout } from '../../kit/layout';
import { enter } from '../../kit/skin';
import { keepAll } from '../../kit/parts';
import { Bar, Icon, SPath } from '../../kit/media';

type Item = { title: string; sub?: string; icon: string };

/** 아이콘 프레임 네 귀퉁이 (ㄱ 모양 괄호) */
const Corners: React.FC<{ size: number; color: string; sw: number; draw: number }> = ({ size, color, sw, draw }) => {
  const c = size * 0.18;
  const paths = [`M0 ${c} V0 H${c}`, `M${size - c} 0 H${size} V${c}`, `M${size} ${size - c} V${size} H${size - c}`, `M${c} ${size} H0 V${size - c}`];
  return (
    <svg width={size} height={size} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      {paths.map((d, i) => <SPath key={i} d={d} stroke={color} sw={sw} strokeLinecap="round" reveal={draw} seed={`corner${i}`} />)}
    </svg>
  );
};

/**
 * 아이콘 시리즈: 큰 키워드 + 선 아이콘 카드가 한 장씩 넘어간다. 아래 페이지 점이 지금 몇 번째인지 보여준다.
 * ev.items[i] = i번째 카드가 나타나는 프레임
 */
const IconSeries: React.FC<TemplateProps> = ({ data, ev, ink, sub, surf }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const L = useLayout();
  const items: Item[] = data.items || [];
  const at: number[] = ev.items || items.map((_, i) => 6 + i * 30);
  let cur = 0;
  at.forEach((f, i) => { if (frame >= f) cur = i; });
  const box = 380;
  const dist = t.skin.motion.distance * 2.5;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {data.kicker && (
        <div style={{ ...keepAll, position: 'absolute', left: L.padX, top: L.titleTop + 10, fontFamily: t.mono, fontSize: 30, fontWeight: 700, letterSpacing: '0.2em', color: sub, opacity: enter(t, frame, at[0] - 6, fps) }}>{data.kicker}</div>
      )}
      {items.map((it, i) => {
        if (i < cur - 1 || i > cur) return null;
        const pin = enter(t, frame, at[i], fps);
        const pout = i < cur ? enter(t, frame, at[cur], fps) : 0;
        const o = Math.min(1, pin * 1.4) * (1 - pout);
        if (o <= 0.001) return null;
        const y = (1 - pin) * dist - pout * dist;
        return (
          <React.Fragment key={i}>
            <div style={{ position: 'absolute', left: L.padX, top: L.H * 0.34, width: L.W - L.padX * 2 - box - 80, opacity: o, transform: `translateY(${y}px)` }}>
              <div style={{ ...keepAll, fontSize: it.title.length > 6 ? 120 : 150, fontWeight: 900, color: ink, lineHeight: 1.1, letterSpacing: '-0.03em' }}>{it.title}</div>
              <Bar color={t.primary} radius={4} seed={`rule${i}`} style={{ width: 120 * pin, height: 8, margin: '30px 0 26px' }} />
              {it.sub && <div style={{ ...keepAll, fontSize: 44, fontWeight: 700, color: sub, lineHeight: 1.4 }}>{it.sub}</div>}
            </div>
            <div style={{ position: 'absolute', left: L.W - L.padX - box, top: L.H * 0.53 - box / 2, width: box, height: box, opacity: o,
              transform: `translateY(${y * 0.6}px) scale(${0.92 + 0.08 * pin})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Corners size={box} color={ink} sw={Math.max(4, t.skin.objectStroke + 2)} draw={pin} />
              <Icon name={it.icon} size={box * 0.56} color={t.accent} sw={1.6} draw={pin} />
            </div>
          </React.Fragment>
        );
      })}
      {/* 페이지 점 */}
      <div style={{ position: 'absolute', left: L.padX, bottom: L.H * 0.17, display: 'flex', gap: 12, alignItems: 'center', opacity: enter(t, frame, at[0], fps) }}>
        {items.map((_, i) => {
          const on = i === cur ? enter(t, frame, at[i], fps) : 0;
          return <Bar key={i} color={i <= cur ? t.primary : surf.line} radius={6} seed={`pg${i}`} style={{ width: 14 + 30 * on, height: 14 }} />;
        })}
      </div>
    </div>
  );
};

export default IconSeries;
