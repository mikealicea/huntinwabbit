import { HeaderContainer } from '@/features/header/header.index';
import { HomePage } from '@/features/home/home.index';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <HeaderContainer />
      <HomePage />
    </div>
  );
}
