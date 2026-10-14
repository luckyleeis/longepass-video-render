import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { useLayout } from '../../kit/layout';
import { cardPanel, ease, enter, riseTransform } from '../../kit/skin';
import { Bar, Panel } from '../../kit/media';
import { HighlightedText, keepAll } from '../../kit/parts';
import { Credit, Picture, assetOf } from '../../kit/picture';

/**
 * 인용·출처 카드: 큰 따옴표 + 인용문 + 출처(기관·기사·법 조항). 카드 없이 잡지 지면처럼 글자만 크게.
 * 관련 자료(공문, 기사, 전문가 말)를 근거로 보여 줄 때. image가 있으면 오른쪽에 사진(인물·기관·문서)을 세워 둔다.
 * data: {label, quote, highlight, source, source_sub, image}, ev: {quote, highlight, source}
 */
const QuoteCard: React.FC<TemplateProps> = ({ data, ev, dur, ink, sub, surf }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const L = useLayout();
  const asset = assetOf(data.image);
  const quote: string = data.quote || '';
  const len = Array.from(quote).length;
  const textW = asset ? Math.round(L.contentW * 0.6) : Math.round(L.contentW * 0.86);
  const want = len <= 16 ? 96 : len <= 30 ? 80 : len <= 44 ? 68 : 58;
  const lines = Math.ceil((len * want) / textW);
  const size = lines > 4 ? Math.floor(want * 0.88) : want;
  const qAt = ev.quote ?? 0;
  const qp = enter(t, frame, qAt, fps);
  const mark = enter(t, frame, Math.max(0, qAt - 4), fps, -4);
  const hl = ease(frame, ev.highlight ?? qAt + 14, (ev.highlight ?? qAt + 14) + 14);
  const sp = enter(t, frame, ev.source ?? qAt + 20, fps);
  const imgP = enter(t, frame, qAt + 6, fps);
  const imgW = Math.round(L.contentW * 0.3), imgH = Math.round(imgW * 1.25);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: L.padX - 20, top: Math.round(L.H * 0.06), fontSize: 420, lineHeight: 1, fontWeight: 900, color: t.primary, opacity: Math.min(1, mark * 1.5), transform: `scale(${0.6 + 0.4 * mark}) rotate(${(1 - mark) * -12}deg)`, transformOrigin: '20% 40%' }}>“</div>
      <div style={{ position: 'absolute', left: L.padX, width: textW, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 44 }}>
        {data.label && (
          <div style={{ display: 'flex', opacity: qp }}>
            <Panel fill={ink} radius={8} seed="quote-label" fillStyle="solid" style={{ ...keepAll, padding: '6px 18px', color: surf.bg, fontSize: 30, fontWeight: 900 }}>{data.label}</Panel>
          </div>
        )}
        <div style={{ ...keepAll, fontSize: size, fontWeight: 900, lineHeight: 1.3, letterSpacing: '-0.02em', color: ink, opacity: qp, transform: riseTransform(t, qp, 0.8), textWrap: 'pretty' } as React.CSSProperties}>
          <HighlightedText text={quote} highlight={data.highlight} size={size} surf={surf} ink={ink} progress={hl} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, opacity: sp, transform: riseTransform(t, sp, 0.6, 'x') }}>
          <Bar color={t.primary} radius={4} style={{ width: 64, height: 8 }} />
          <div>
            <div style={{ ...keepAll, fontSize: 42, fontWeight: 900, color: ink }}>{data.source}</div>
            {data.source_sub && <div style={{ ...keepAll, fontSize: 30, fontWeight: 700, color: sub, marginTop: 4 }}>{data.source_sub}</div>}
          </div>
        </div>
      </div>
      {asset && (
        <div style={{ position: 'absolute', right: L.padX, top: (L.H - imgH) / 2, opacity: imgP, transform: `${riseTransform(t, imgP, 1)} rotate(3deg)` }}>
          <Panel {...cardPanel(t, surf)} radius={Math.min(16, t.skin.radius)} seed="quote-photo" style={{ padding: 14 }}>
            <Picture asset={asset} w={imgW} h={imgH} radius={Math.min(10, t.skin.radius)} dur={dur} zoom={interpolate(frame, [0, Math.max(1, dur)], [1, 1.06])} />
          </Panel>
        </div>
      )}
      <Credit asset={asset} />
    </div>
  );
};

export default QuoteCard;
