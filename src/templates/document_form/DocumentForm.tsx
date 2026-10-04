import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { useLayout } from '../../kit/layout';
import { cardPanel, ease, enter, highlightInk, highlightStyle, riseTransform } from '../../kit/skin';
import { Bar, Icon, Mark, Panel } from '../../kit/media';
import { keepAll } from '../../kit/parts';
import { StampMark } from '../../kit/objects';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/**
 * 서류(신청서·증명서) 목업. 칸마다 값이 써지고, highlight 칸에 형광펜, 마지막에 도장(선택).
 * 신청서에 무엇을 적는지, 서류에서 꼭 확인할 칸(발효일·금액·기한)을 보여줄 때.
 * data: {doc_title, fields: [{label, value}], highlight(1부터), stamp, note}, ev: {doc, fields[], stamp, note}
 */
const DocumentForm: React.FC<TemplateProps> = ({ data, ev, surf }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const L = useLayout();
  const fields: Array<{ label: string; value: string }> = data.fields || [];
  const hl = Number(data.highlight) > 0 ? Math.min(Number(data.highlight), fields.length) - 1 : -1;
  const narrow = L.W < 1500;
  const withNote = !!data.note;
  const paperW = narrow ? L.contentW * 0.92 : 900;
  const docP = enter(t, frame, ev.doc ?? 0, fps);
  const stampAt = ev.stamp ?? 9999;
  const stampP = interpolate(frame, [stampAt, stampAt + 6], [0, 1], clamp);
  const stampScale = interpolate(frame, [stampAt, stampAt + 6, stampAt + 10], [1.8, 0.95, 1], clamp);
  const noteP = enter(t, frame, ev.note ?? 9999, fps);
  const rowH = fields.length >= 5 ? 92 : 108;
  const paperH = 150 + fields.length * rowH + 60;
  const top = narrow ? (withNote ? L.titleTop - 20 : (L.H - paperH) / 2 - 20) : (L.H - paperH) / 2 - 40;
  const noteW = 520;   // 가로 무대에서 서류 + 메모를 한 덩어리로 가운데에
  const left = narrow || !withNote ? (L.W - paperW) / 2 : Math.max(L.padX, (L.W - paperW - 80 - noteW) / 2);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left, top, width: paperW, height: paperH, opacity: docP, transform: `translateY(${(1 - docP) * 60}px) rotate(${-1.5 + (1 - docP) * 3}deg)` }}>
        <Panel {...cardPanel(t, surf)} radius={10} seed="doc-paper" style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'absolute', inset: 0, padding: '40px 56px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <Icon name="pencil" size={46} color={t.primary} sw={2.2} />
            <div style={{ ...keepAll, fontSize: 52, fontWeight: 900, color: surf.cardInk, letterSpacing: '0.04em' }}>{data.doc_title}</div>
          </div>
          <Bar color={surf.cardInk} radius={2} seed="doc-rule" style={{ marginTop: 22, width: '100%', height: 4, opacity: 0.8 }} />
          {fields.map((f, i) => {
            const at = (ev.fields || [])[i] ?? 10 + i * 12;
            const p = enter(t, frame, at, fps);
            const write = ease(frame, at, at + 14);   // 값이 왼쪽부터 써진다
            const mark = i === hl ? ease(frame, at + 14, at + 26) : 0;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-end', gap: 26, height: rowH, opacity: 0.35 + 0.65 * p }}>
                <div style={{ ...keepAll, width: '30%', flexShrink: 0, fontSize: 32, fontWeight: 800, color: surf.cardInk, opacity: 0.55, paddingBottom: 14 }}>{f.label}</div>
                <div style={{ position: 'relative', flex: 1, paddingBottom: 12 }}>
                  <Bar color={surf.line} radius={2} seed={`doc-line${i}`} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3 }} />
                  <div style={{ position: 'relative', display: 'inline-block', clipPath: `inset(0 ${(1 - write) * 100}% 0 0)` }}>
                    {mark > 0 && <Mark style={highlightStyle(t, surf, mark, 44)} seed={`doc-hl${i}`} />}
                    <span style={{ ...keepAll, position: 'relative', zIndex: 1, fontSize: 44, fontWeight: 900, color: mark > 0 ? highlightInk(t, surf, surf.cardInk) : surf.cardInk }}>{f.value}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {data.stamp && (
          <div style={{ position: 'absolute', right: -30, bottom: -40, opacity: stampP, transform: `scale(${stampScale}) rotate(-12deg)` }}>
            <StampMark d={220} sw={t.skin.objectStroke} color={t.danger} text={data.stamp} />
          </div>
        )}
      </div>
      {withNote && (
        <div style={{ position: 'absolute', ...(narrow ? { left: L.padX, right: L.padX, top: top + paperH + 60, justifyContent: 'center' } : { left: left + paperW + 80, width: noteW, top: 0, bottom: 0, alignItems: 'center' }),
          display: 'flex', opacity: noteP, transform: riseTransform(t, noteP, 1, narrow ? 'y' : 'x') }}>
          <Panel {...cardPanel(t, surf)} edge={{ side: 'left', color: t.primary, width: 10 }} seed="doc-note"
            style={{ ...keepAll, color: surf.cardInk, padding: '22px 30px', fontSize: narrow ? 40 : 46, fontWeight: 900, lineHeight: 1.35 }}>{data.note}</Panel>
        </div>
      )}
    </div>
  );
};

export default DocumentForm;
