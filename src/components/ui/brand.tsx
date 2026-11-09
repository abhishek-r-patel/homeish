// Shared Dwello wordmark and selected roof-and-entry logo.
import Image from 'next/image';

export function Brand() {
  return (
    <Image
      alt="Dwello"
      className="h-auto w-60"
      height={84}
      priority
      src="/dwello-logo.svg"
      width={300}
    />
  );
}
