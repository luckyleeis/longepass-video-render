import React from 'react';
import { TemplateProps } from '../../kit/types';
import { KineticLines, kineticSize } from '../../kit/kinetic';

/** 한 줄 핵심 메시지를 화면 가운데 큰 글자로. 줄마다 내레이션에 맞춰 떠오른다 */
const Headline: React.FC<TemplateProps> = ({ data, ev, ink, sub, surf }) => {
  const lines: string[] = data.lines || [];
  return (
    <KineticLines lines={lines} highlight={data.highlight} strike={data.strike} kicker={data.kicker}
      size={kineticSize(lines, 180)} align="center" at={ev.lines || []} strikeAt={ev.strike} ink={ink} sub={sub} surf={surf} />
  );
};

export default Headline;
