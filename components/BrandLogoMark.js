import Image from "next/image";

/** Full Azur Camping logo (transparent PNG) for headers. */
export default function BrandLogoMark({ className = "" }) {
  return (
    <Image
      src="/azur-camping-logo.png"
      alt="Azur Camping"
      width={220}
      height={120}
      priority
      sizes="(max-width: 640px) 9rem, (max-width: 1024px) 10rem, 11rem"
      className={`h-14 w-auto max-w-[9rem] shrink-0 object-contain sm:h-16 sm:max-w-[10rem] md:h-[4.75rem] md:max-w-[11rem] ${className}`}
    />
  );
}
