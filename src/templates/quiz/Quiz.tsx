import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { useLayout } from '../../kit/layout';
import { cardPanel, ease, enter, riseTransform } from '../../kit/skin';
import { Bar, Dot, Panel } from '../../kit/media';
import { CheckMark, keepAll } from '../../kit/parts';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/**
 * 맞혀 보기. 문제 → 보기가 하나씩 → 생각할 시간 막대가 줄어듦 → 정답 공개(정답 체크, 나머지 흐리게 + 줄) → 한 줄 설명.
 * data: {question, options[], answer(1부터), note}, ev: {question, options[], reveal, note}
 */
const Quiz: React.FC<TemplateProps> = ({ data, ev, ink, surf }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const L = useLayout();
  const options: string[] = data.options || [];
  const n = Math.max(1, options.length);
  const ans = Math.min(Math.max(1, Number(data.answer) || 1), n) - 1;
  const narrow = L.W < 1500;
  const qAt = ev.question ?? 0;
  const optAt = (i: number) => (ev.options || [])[i] ?? qAt + 12 + i * 8;
  const rev = ev.reveal ?? optAt(n - 1) + 40;
  const think = interpolate(frame, [optAt(n - 1) + 6, rev], [1, 0], clamp);
  const r = enter(t, frame, rev, fps);
  const revealed = frame >= rev;
  const qp = enter(t, frame, qAt, fps);
  const noteP = enter(t, frame, ev.note ?? rev + 12, fps);
  const qSize = narrow ? 60 : 66;
  const oSize = narrow ? 46 : 50;
  const letters = ['A', 'B', 'C', 'D'];
  // 보기 3개: 가로 무대는 한 줄에 셋, 좁은 무대는 한 줄에 하나 (2x2에 빈칸이 생기지 않게)
  const cols = n === 3 ? (narrow ? 1 : 3) : n === 1 ? 1 : 2;
  return (
    <div style={{ position: 'absolute', top: 0, bottom: narrow ? 40 : 120, left: L.padX, right: L.padX, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 34 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28, opacity: qp, transform: riseTransform(t, qp, 0.8) }}>
        <Dot size={qSize * 1.6} fill={t.primary} seed="quiz-q" style={{ flexShrink: 0, fontSize: qSize, fontWeight: 900, color: t.skin.onColorInk }}>Q</Dot>
        <div style={{ ...keepAll, fontSize: qSize, fontWeight: 900, color: ink, lineHeight: 1.25, letterSpacing: '-0.02em' }}>{data.question}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 24 }}>
        {options.map((o, i) => {
          const p = enter(t, frame, optAt(i), fps);
          const right = i === ans;
          const base = cardPanel(t, surf);
          return (
            <Panel key={i} {...base} draw={p} seed={`quiz-opt${i}`}
              fill={revealed && right ? t.accent2 : base.fill} stroke={revealed && right ? t.accent2 : base.stroke}
              style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 22, padding: '24px 28px', opacity: p * (revealed && !right ? 1 - 0.6 * r : 1),
                transform: `${riseTransform(t, p, 1.2)} scale(${revealed && right ? 1 + 0.05 * Math.sin(Math.min(1, r) * Math.PI) : 1})` }}>
              {revealed && right
                ? <CheckMark size={oSize * 1.2} color={t.skin.onColorInk} ink={t.accent2} progress={ease(frame, rev, rev + 12)} />
                : <Dot size={oSize * 1.2} fill={surf.fill} seed={`quiz-l${i}`} style={{ flexShrink: 0, fontSize: oSize * 0.6, fontWeight: 900, color: surf.cardInk }}>{letters[i]}</Dot>}
              <div style={{ ...keepAll, position: 'relative', fontSize: oSize, fontWeight: 900, color: revealed && right ? t.skin.onColorInk : surf.cardInk }}>
                {o}
                {revealed && !right && <Bar color={t.danger} radius={4} seed={`quiz-x${i}`} style={{ position: 'absolute', left: -6, top: '52%', height: 6, width: `${ease(frame, rev + 4, rev + 14) * 106}%` }} />}
              </div>
            </Panel>
          );
        })}
      </div>
      {/* 생각할 시간 (정답 공개 전까지 줄어든다) */}
      <div style={{ position: 'relative', height: 14, opacity: revealed ? 0 : ease(frame, optAt(n - 1), optAt(n - 1) + 8) }}>
        <Bar color={surf.line} radius={7} seed="quiz-track" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 14 }} />
        <Bar color={t.primary} radius={7} seed="quiz-time" style={{ position: 'absolute', left: 0, top: 0, width: `${think * 100}%`, height: 14 }} />
      </div>
      {data.note && (
        <div style={{ display: 'flex', marginTop: -30, opacity: revealed ? noteP : 0, transform: riseTransform(t, noteP, 0.8) }}>
          <Panel {...cardPanel(t, surf)} edge={{ side: 'left', color: t.accent2, width: 10 }} seed="quiz-note"
            style={{ ...keepAll, color: surf.cardInk, padding: '16px 30px', fontSize: narrow ? 40 : 42, fontWeight: 800 }}>{data.note}</Panel>
        </div>
      )}
    </div>
  );
};

export default Quiz;
