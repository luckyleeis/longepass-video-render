import React from 'react';
import { Easing, interpolate, random, useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { ease, enter, riseTransform } from '../../kit/skin';
import { fmt } from '../../kit/parts';
import { Bill, Coin } from '../../kit/objects';
import { Bar } from '../../kit/media';
import { useLayout } from '../../kit/layout';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 큰 숫자가 0에서 목표값까지 올라간다 (선택: 끝에서 지폐/동전이 퍼짐) */
const Counter: React.FC<TemplateProps> = ({ data, ev, ink }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const L = useLayout();
  const sw = t.skin.objectStroke;
  // 좁은 무대(세로 쇼츠)에서는 숫자 줄이 폭에 맞게 줄어든다 (가로 1920에서는 그대로)
  const estW = fmt(data.value || 0).length * 330 * 0.56 + (data.prefix ? String(data.prefix).length * 120 * 0.62 + 18 : 0)
    + (data.suffix ? String(data.suffix).length * 120 + 14 : 0);
  const fit = Math.min(1, (L.W * 0.88) / Math.max(1, estW));
  const impact = t.skin.motion.impact;
  const start = ev.start ?? 0, end = ev.end ?? 20;
  const p = interpolate(frame, [start, end], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const slam = impact ? interpolate(frame, [end, end + 3, end + 9], [1, 1.12, 1], clamp) : 1;
  const shake = impact && frame >= end && frame < end + 8 ? Math.sin(frame * 3.1) * (8 - (frame - end)) : 0;
  const labelIn = enter(t, frame, start - 4, fps);
  // 차분한 스킨: 다 세고 나면 숫자 밑에 밑줄이 그어진다
  const underline = impact ? 0 : ease(frame, end, end + 14);
  const burst = frame - end;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {burst >= 0 && data.burst === true && Array.from({ length: impact ? 16 : 8 }).map((_, i) => {
        const ang = random(`b-a-${i}`) * Math.PI * 2;
        const dist = (impact ? 380 : 520) + random(`b-d-${i}`) * (impact ? 520 : 260);
        const life = Math.min(1, burst / (impact ? 22 : 40));
        const x = Math.cos(ang) * dist * Easing.out(Easing.cubic)(life);
        const y = Math.sin(ang) * dist * Easing.out(Easing.cubic)(life) + (impact ? burst * burst * 0.25 : 0);
        const rot = random(`b-r-${i}`) * (impact ? 720 : 90) * life;
        return (
          <div key={i} style={{ position: 'absolute', left: '50%', top: '52%', transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rot}deg) scale(${0.5 + random(`b-s-${i}`) * 0.6})`, opacity: impact ? 1 - Math.max(0, (burst - 30) / 15) : Math.min(1, burst / 8) * 0.9 }}>
            {i % 3 !== 0 ? <Bill w={220} sw={sw} color={t.accent2} ink={ink} /> : <Coin d={110} sw={sw} color={t.primary} ink={ink} />}
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) translate(${shake}px, ${shake * 0.5}px)`, textAlign: 'center' }}>
        <div style={{ fontSize: 64, fontWeight: 900, color: ink, opacity: labelIn, transform: riseTransform(t, labelIn, 0.5) }}>{data.label}</div>
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'baseline', justifyContent: 'center', transform: `scale(${slam * fit})`, fontVariantNumeric: 'tabular-nums' }}>
          {data.prefix && <span style={{ fontSize: 120, fontWeight: 900, color: ink, marginRight: 18 }}>{data.prefix}</span>}
          <span style={{ fontSize: 330, fontWeight: 900, color: ink, letterSpacing: '-0.05em', lineHeight: 1 }}>{fmt((data.value || 0) * p)}</span>
          {data.suffix && <span style={{ fontSize: 120, fontWeight: 900, color: ink, marginLeft: 14 }}>{data.suffix}</span>}
          {!impact && <Bar color={ink} radius={7} seed="underline" style={{ position: 'absolute', left: 0, bottom: -18, height: 14, width: `${underline * 100}%` }} />}
        </div>
      </div>
    </div>
  );
};

export default Counter;
