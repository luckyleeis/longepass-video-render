import { useLayoutEffect, useState } from 'react';
import { cancelRender, continueRender, delayRender } from 'remotion';

/** 스타일 글꼴이 다 불러와질 때까지 렌더링을 기다린다 (영상·썸네일 공용) */
export const useFontsReady = (font: string) => {
  const [handle] = useState(() => delayRender('Loading fonts'));
  useLayoutEffect(() => {
    const family = font.split(',')[0].replace(/['"]/g, '').trim();
    Promise.all([700, 900].map((w) => document.fonts.load(`${w} 40px "${family}"`, '字')))
      .then(() => document.fonts.ready)
      .then(() => continueRender(handle))
      .catch((e) => cancelRender(e));
  }, [font, handle]);
};
