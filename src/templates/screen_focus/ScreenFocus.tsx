import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { useLayout } from '../../kit/layout';
import { cardPanel, ease, enter, riseTransform } from '../../kit/skin';
import { Bar, Dot, Panel } from '../../kit/media';
import { Title, keepAll } from '../../kit/parts';
import { Credit, Picture, aspectOf, assetOf } from '../../kit/picture';

type Region = { x?: number; y?: number; w?: number; h?: number };

const clamp01 = (v: number | undefined, d: number) => Math.min(1, Math.max(0, typeof v === 'number' && isFinite(v) ? v : d));

/**
 * 화면 캡처(웹페이지·앱·공문서) 확대: 브라우저/휴대폰 틀 안에 캡처를 보여 주고,
 * 말이 그 부분에 오면 틀 안에서 그 영역으로 다가가 테두리를 긋고 설명을 단다 ("관련 자료"를 보여 주는 장면).
 * 자료가 없으면 회색 줄로 된 가짜 페이지에 그 영역만 강조색 블록으로 그린다.
 * 출처(자료의 credit, 없으면 data.source)는 틀 오른쪽 옆에 세워 둔다 (정부 공고·언론 기사 인용 — CHANNEL.md 「소재」).
 * data: {image, device: browser|phone|plain, title, url, focus: {x,y,w,h 0~1}, note, source}, ev: {screen, zoom, note}
 */
const ScreenFocus: React.FC<TemplateProps> = ({ data, ev, dur, ink, surf }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const L = useLayout();
  const asset = assetOf(data.image);
  const device: 'browser' | 'phone' | 'plain' = data.device || 'browser';
  const phone = device === 'phone';
  const ar = aspectOf(asset, phone ? 9 / 19.5 : 16 / 10);
  const r: Region = data.focus || {};
  const rx = clamp01(r.x, 0.1), ry = clamp01(r.y, 0.4), rw = Math.max(0.05, Math.min(1 - rx, clamp01(r.w, 0.5))), rh = Math.max(0.03, Math.min(1 - ry, clamp01(r.h, 0.15)));

  // 틀과 보이는 창(viewport) 크기
  const top = data.title ? L.contentTop - 10 : Math.round(L.H * 0.1);
  const maxH = L.H - top - Math.round(L.H * 0.2);   // 아래 20%는 자막 자리
  const bar = device === 'browser' ? 58 : 0;
  const border = phone ? 18 : t.skin.cardBorder;
  const vh = Math.round(maxH - bar - border * 2);
  // 출처는 틀 오른쪽 옆 세로 칸 (그만큼 틀 폭을 줄이고, 틀 + 출처를 한 덩어리로 가운데에)
  const source: string = asset?.credit || data.source || '';
  const sideGap = 40, sideW = source ? Math.min(400, Math.round(L.contentW * 0.26)) : 0;
  const maxVw = L.contentW - (source ? sideGap + sideW : 0) - border * 2;
  const vw = Math.round(Math.min(maxVw, phone ? Math.min(vh * 0.5, 620) : Math.min(L.contentW * 0.82, (vh) * Math.max(ar, 1.3))));
  const imgH = vw / ar;                       // 캡처를 창 폭에 맞춘 높이 (창보다 길면 위부터 보인다)
  const frameW = vw + border * 2;
  const frameX = (L.W - frameW - (source ? sideGap + sideW : 0)) / 2;
  const frameH = vh + bar + border * 2;

  // 다가가기: 영역이 창의 80% 폭 / 70% 높이에 들어오게
  const zs = Math.max(1, Math.min(3.2, (vw * 0.8) / (rw * vw), (vh * 0.7) / (rh * imgH)));
  const tx1 = Math.min(0, Math.max(vw - vw * zs, vw / 2 - (rx + rw / 2) * vw * zs));
  const ty1 = Math.min(0, Math.max(vh - imgH * zs, vh / 2 - (ry + rh / 2) * imgH * zs));
  const zAt = ev.zoom ?? Math.round(dur * 0.35);
  const z = ease(frame, zAt, zAt + 22);
  const s = 1 + (zs - 1) * z, tx = tx1 * z, ty = ty1 * z;

  const inP = enter(t, frame, ev.screen ?? 0, fps);
  const mark = ease(frame, zAt + 16, zAt + 30);
  const noteAt = ev.note ?? zAt + 24;
  const noteP = enter(t, frame, noteAt, fps);
  // 영역 테두리 (창 좌표)
  const bx = tx + rx * vw * s, by = ty + ry * imgH * s, bw = rw * vw * s, bh = rh * imgH * s;
  const noteBelow = by + bh + 110 < vh;
  const noteW = Math.min(560, vw - 32);

  const page = asset ? (
    <Picture asset={asset} w={vw} h={imgH} dur={dur} style={{ position: 'absolute', left: 0, top: 0 }} />
  ) : (
    // 가짜 페이지: 회색 줄 + 강조 영역 블록
    <div style={{ position: 'absolute', left: 0, top: 0, width: vw, height: imgH }}>
      <Panel fill={surf.card} style={{ position: 'absolute', inset: 0 }} />
      <Bar color={t.accent} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: imgH * 0.09 }} />
      {[0.16, 0.22, 0.28, 0.62, 0.68, 0.74, 0.8, 0.86].map((yy, i) => (
        <Bar key={i} color={surf.fill} radius={8} style={{ position: 'absolute', left: vw * 0.06, top: imgH * yy, width: vw * (0.5 + ((i * 37) % 40) / 100), height: Math.max(10, imgH * 0.022) }} />
      ))}
      <Panel fill={t.primary} radius={10} seed="screen-fake-block" style={{ ...keepAll, position: 'absolute', left: rx * vw, top: ry * imgH, width: rw * vw, height: rh * imgH, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.skin.onColorInk, fontSize: Math.max(18, Math.min(rh * imgH * 0.45, (rw * vw) / Math.max(4, (data.note || '').length + 1))), fontWeight: 900 }}>
        {data.note || ''}
      </Panel>
    </div>
  );

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Title text={data.title} at={ev.screen ?? 0} ink={ink} />
      <div style={{ position: 'absolute', left: frameX, top, opacity: inP, transform: riseTransform(t, inP, 1.2) }}>
        <Panel {...cardPanel(t, surf)} radius={phone ? 64 : Math.min(18, t.skin.radius)} sw={border} stroke={phone ? surf.ink : cardPanel(t, surf).stroke}
          fill={phone ? surf.ink : surf.card} seed="screen-frame" style={{ width: frameW, overflow: 'hidden' }}>
          {device === 'browser' && (
            <div style={{ height: bar, display: 'flex', alignItems: 'center', gap: 12, padding: '0 22px' }}>
              {[t.danger, t.primary, t.accent2].map((c, i) => <Dot key={i} size={18} fill={c} seed={`screen-dot${i}`} />)}
              <Panel fill={surf.fill} radius={999} seed="screen-url" style={{ ...keepAll, marginLeft: 16, flex: 1, height: 34, display: 'flex', alignItems: 'center', padding: '0 18px', fontSize: 20, fontWeight: 700, color: surf.cardInk, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {data.url || ''}
              </Panel>
            </div>
          )}
          <div style={{ position: 'relative', width: vw, height: vh, margin: phone ? border : 0, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, width: vw, height: imgH, transform: `translate(${tx}px, ${ty}px) scale(${s})`, transformOrigin: '0 0' }}>
              {page}
            </div>
            <Panel stroke={t.danger} sw={6} radius={12} draw={mark} seed="screen-mark"
              style={{ position: 'absolute', left: bx - 10, top: by - 10, width: bw + 20, height: bh + 20, opacity: Math.min(1, mark * 2), transform: `scale(${1.08 - 0.08 * mark})` }} />
            {data.note && asset && (   // 자료가 없으면 가짜 페이지의 강조 블록에 이미 쓰여 있다
              <div style={{ position: 'absolute', left: Math.max(16, Math.min(vw - 16 - noteW, bx)), top: noteBelow ? by + bh + 26 : Math.max(16, by - 96), opacity: noteP, transform: riseTransform(t, noteP, 0.5) }}>
                <Panel fill={t.danger} radius={12} seed="screen-note" style={{ ...keepAll, padding: '10px 24px', color: t.skin.onAccentInk, fontSize: phone ? 32 : 40, fontWeight: 900, maxWidth: noteW }}>{data.note}</Panel>
              </div>
            )}
          </div>
        </Panel>
      </div>
      {source && (
        <div style={{ position: 'absolute', left: frameX + frameW + sideGap, width: sideW, top, height: frameH, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 14, paddingBottom: 8,
          opacity: ease(frame, (ev.screen ?? 0) + 8, (ev.screen ?? 0) + 20), transform: riseTransform(t, ease(frame, (ev.screen ?? 0) + 8, (ev.screen ?? 0) + 20), 0.5, 'x') }}>
          <Bar color={t.primary} radius={4} style={{ width: 56, height: 8 }} />
          <div style={{ display: 'flex' }}>
            <Panel fill={ink} radius={8} seed="screen-source-tag" fillStyle="solid" style={{ ...keepAll, padding: '4px 14px', color: surf.bg, fontSize: 24, fontWeight: 900 }}>資料來源</Panel>
          </div>
          <div style={{ ...keepAll, fontSize: source.length > 24 ? 28 : 34, fontWeight: 800, lineHeight: 1.35, color: ink }}>{source.replace(/^(資料來源|畫面截圖)[：:]\s*/, '')}</div>
        </div>
      )}
      {!source && <Credit asset={asset} />}
    </div>
  );
};

export default ScreenFocus;
