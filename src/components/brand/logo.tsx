import Image from "next/image";

type BrandLogoProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

/**
 * Official Cyber Alert DRC mark — white disc + thin circle, symbole sur fond blanc.
 */
export function BrandLogo({ size = 44, className = "", priority = false }: BrandLogoProps) {
  const inner = Math.round(size * 0.82);

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-[0_8px_22px_-12px_rgba(11,16,32,0.45)] ring-1 ring-[rgba(15,35,70,0.18)] ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src="/brand/logo-mark.png"
        alt="Cyber Alert DRC"
        width={inner}
        height={inner}
        priority={priority}
        unoptimized
        className="object-contain object-center"
        style={{ width: inner, height: inner }}
      />
    </span>
  );
}
