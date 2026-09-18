import {
  type AuthAction,
  SignOutButtonContainer,
} from '@/features/auth/auth.index';
import { ThemeSwitchContainer } from '@/features/theme/theme.index';
import { Header } from './Header.component';
export function HeaderContainer({
  signOutAction,
}: {
  signOutAction: AuthAction;
}) {
  return (
    <Header
      themeSwitch={<ThemeSwitchContainer />}
      signOut={<SignOutButtonContainer action={signOutAction} />}
    />
  );
}
