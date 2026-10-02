import React, { createContext, useContext } from 'react';
import { MotionTheme } from './types';

const Ctx = createContext<MotionTheme | null>(null);

export const MotionThemeProvider: React.FC<{ theme: MotionTheme; children: React.ReactNode }> = ({ theme, children }) => (
  <Ctx.Provider value={theme}>{children}</Ctx.Provider>
);

export const useMotionTheme = () => {
  const t = useContext(Ctx);
  if (!t) throw new Error('MotionThemeProvider missing');
  return t;
};
