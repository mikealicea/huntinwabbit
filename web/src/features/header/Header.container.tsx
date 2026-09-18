import Link from 'next/link';
import {
  type AuthAction,
  SignOutButtonContainer,
} from '@/features/auth/auth.index';
import { ThemeSwitchContainer } from '@/features/theme/theme.index';
import { Header } from './Header.component';
export function HeaderContainer({
  signOutAction,
}: {
  signOutAction?: AuthAction;
}) {
  return (
    <Header
      themeSwitch={<ThemeSwitchContainer />}
      actions={
        signOutAction ? (
          <SignOutButtonContainer action={signOutAction} />
        ) : (
          <Link href="/app" className="btn btn-primary min-h-11">
            Open app
          </Link>
        )
      }
    />
  );
}
