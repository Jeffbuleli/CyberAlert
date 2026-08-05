import Image from "next/image";

type BrandLogoProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

/**
 * Official Cyber Alert DRC mark on a white disc.
 * Scale ≤ ~0.70 so the square mark (shield corners + right wings) stays inside
 * the circle — larger than 1/√2 clips; much smaller (~0.62) looked broken on mobile.
 */
export function BrandLogo({ size = 44, className = "", priority = false }: BrandLogoProps) {
  const inner = Math.max(18, Math.round(size * 0.7));

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-[0_8px_22px_-12px_rgba(11,16,32,0.45)] ring-1 ring-[rgba(15,35,70,0.18)] ${className}`}
      style={{ width: size, height: size }}
      aria-hidden={false}
    >
      <Image
        src="/brand/logo-mark.png"
        alt="Cyber Alert DRC"
        width={inner}
        height={inner}
        priority={priority}
        unoptimized
        draggable={false}
        className="select-none object-contain object-center"
        style={{ width: inner, height: inner, maxWidth: "70%", maxHeight: "70%" }}
      />
    </span>
  );
}
