import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { MotionTheme, TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { enter } from '../../kit/skin';
import { KineticLines, kineticSize } from '../../kit/kinetic';
import { useLayout } from '../../kit/layout';
import { Bill, CalendarPage, Certificate, DocumentSheet, IdCard, Passbook } from '../../kit/objects';

const OBJECTS: Record<string, (ink: string, t: MotionTheme, data: any) => React.ReactNode> = {
  certificate: (ink, t, d) => <Certificate w={560} sw={t.skin.objectStroke} primary={t.primary} ink={ink} title={d.object_label || '技術士證'} />,
  cash: (ink, t) => <Bill w={520} sw={t.skin.objectStroke} color={t.accent2} ink={ink} />,
  document: (ink, t, d) => <DocumentSheet w={400} sw={t.skin.objectStroke} ink={ink} accent={t.primary} title={d.object_label || '申請書'} />,
  calendar: (ink, t, d) => <CalendarPage w={420} sw={t.skin.objectStroke} ink={ink} accent={t.danger} big={d.object_label || '90'} />,
  idcard: (ink, t) => <IdCard w={540} sw={t.skin.objectStroke} ink={ink} accent={t.accent} />,
  passbook: (ink, t) => <Passbook w={380} sw={t.skin.objectStroke} ink={ink} accent={t.accent2} />,
};

/** 왼쪽 큰 글자 + 오른쪽 사물 그림. 정사각형 무대(세로 쇼츠)에서는 위 그림 + 아래 글자 */
const HeadlineObject: React.FC<TemplateProps> = ({ data, ev, ink, sub, surf }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const L = useLayout();
  const stacked = L.W / L.H < 1.5;
  const lines: string[] = data.lines || [];
  const p = enter(t, frame, ev.object ?? 4, fps);
  const make = OBJECTS[data.object] || OBJECTS.certificate;
  const float = Math.sin(frame / 26) * 8;
  // 사물 선은 어두운 배경에서도 진한 색으로: 사물 몸통이 흰색이라 대비가 산다
  const objInk = surf.dark && t.skin.cardBorderColor === 'line' ? t.skin.onColorInk : ink;
  const objStyle = (left: string, top: string, scale: number): React.CSSProperties => ({
    position: 'absolute', left, top,
    transform: `translate(-50%, -50%) translateY(${(1 - p) * t.skin.motion.distance * 4 + float}px) rotate(${6 - (1 - p) * t.skin.motion.tilt * 3}deg) scale(${(0.88 + 0.12 * p) * scale})`,
    opacity: Math.min(1, p * 1.5),
  });
  if (stacked) {
    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        <div style={objStyle('50%', '29%', 0.78)}>{make(objInk, t, data)}</div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', bottom: '2%' }}>
          <KineticLines lines={lines} highlight={data.highlight} size={kineticSize(lines, 150)} align="center" at={ev.lines || []} ink={ink} sub={sub} surf={surf} />
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '62%' }}>
        <KineticLines lines={lines} highlight={data.highlight} size={kineticSize(lines, 150)} align="left" at={ev.lines || []} ink={ink} sub={sub} surf={surf} />
      </div>
      <div style={objStyle('73%', '50%', 1)}>
        {make(objInk, t, data)}
      </div>
    </div>
  );
};

export default HeadlineObject;
