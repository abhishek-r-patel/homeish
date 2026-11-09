// Shared Homeish wordmark and selected roof-and-entry logo.
import Image from 'next/image';

export function Brand() {
  return (
    <Image
      alt="Homeish"
      className="h-auto w-60"
      height={84}
      priority
      src="/homeish-logo.svg"
      width={300}
    />
  );
}
