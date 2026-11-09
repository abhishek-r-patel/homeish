// Minimal root route used to verify the app shell before product screens are built.
import { Brand } from '@/components/ui/brand';

export default function HomePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-space-4">
      <h1>
        <Brand />
      </h1>
    </main>
  );
}
