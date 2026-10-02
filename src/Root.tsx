import React from 'react';
import { Composition, getInputProps } from 'remotion';
import './fonts.css';
import { MotionVideo } from './motion/MotionVideo';

export const RemotionRoot = () => {
  const input = getInputProps() as any;
  return (
    <Composition
      id="Motion"
      component={MotionVideo as any}
      defaultProps={input}
      calculateMetadata={async ({ props }: { props: any }) => ({
        durationInFrames: Math.max(1, props.total_frames || 30),
        width: props.width || 1920,
        height: props.height || 1080,
        fps: props.fps || 30,
      })}
    />
  );
};
