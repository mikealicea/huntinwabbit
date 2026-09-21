import type { ComponentProps } from 'react';
import { ThemeSwitchContainer } from '@/features/theme/theme.index';
import { AuthFrame } from './AuthFrame.component';
export function AuthFrameContainer(
  props: Omit<ComponentProps<typeof AuthFrame>, 'themeSwitch'>,
) {
  return <AuthFrame {...props} themeSwitch={<ThemeSwitchContainer />} />;
}
