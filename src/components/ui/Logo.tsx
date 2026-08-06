import Image from "next/image";
import { BRANDING } from "@/lib/branding";

type LogoVariant = "color" | "mono" | "gold" | "partner";

interface LogoProps {
  variant?: LogoVariant;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  alt?: string;
}

const LOGO_MAP: Record<LogoVariant, { src: string; defaultAlt: string }> = {
  color: {
    src: BRANDING.assets.logoColor,
    defaultAlt: `${BRANDING.name} — Logo colorida`,
  },
  mono: {
    src: BRANDING.assets.logoMono,
    defaultAlt: `${BRANDING.name} — Logo monocromática`,
  },
  gold: {
    src: BRANDING.assets.logoGold,
    defaultAlt: `${BRANDING.name} — Brasão dourado`,
  },
  partner: {
    src: BRANDING.assets.logoPartner,
    defaultAlt: "Banco de Alimentos de São João del-Rei",
  },
};

/**
 * Componente oficial de logo do Annonae.
 *
 * @example
 * <Logo variant="color" width={180} height={48} />
 * <Logo variant="gold" width={36} height={36} />
 */
export function Logo({
  variant = "color",
  width = 160,
  height = 48,
  className = "",
  priority = false,
  alt,
}: LogoProps) {
  const { src, defaultAlt } = LOGO_MAP[variant];

  return (
    <Image
      src={src}
      alt={alt ?? defaultAlt}
      width={width}
      height={height}
      priority={priority}
      className={className}
    />
  );
}

/**
 * Brasão quadrado do Annonae — otimizado para fundos escuros (sidebar).
 * Usa `fill` dentro de uma caixa de tamanho fixo, garantindo que o
 * brasão nunca distorça independentemente do aspect ratio do SVG.
 */
export function LogoMark({
  size = 36,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={BRANDING.assets.logoGold}
        alt={BRANDING.name}
        fill
        sizes={`${size}px`}
        priority
        className="object-contain"
      />
    </span>
  );
}

/**
 * Brasão + wordmark — usado na sidebar expandida.
 */
export function LogoFull({
  size = 36,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      <LogoMark size={size} />
      <span className="flex flex-col leading-none min-w-0">
        <span className="truncate text-[17px] font-semibold tracking-wide text-amber-200">
          {BRANDING.name}
        </span>
        <span className="truncate text-[9px] uppercase tracking-[0.14em] text-green-300/80">
          Banco de Alimentos
        </span>
      </span>
    </span>
  );
}

/**
 * Bloco de parceria — exibe Annonae + Banco SJDR lado a lado.
 * Ambas as logos ficam em caixas quadradas de mesma altura, com
 * `object-contain`, garantindo equilíbrio visual mesmo com proporções
 * originais diferentes.
 *
 * @param partnerBoost compensa a margem interna maior da logo do Banco.
 */
export function PartnershipLogos({
  className = "",
  logoSize = 96,
  partnerBoost = 1.12,
}: {
  className?: string;
  logoSize?: number;
  partnerBoost?: number;
}) {
  const partnerSize = Math.round(logoSize * partnerBoost);

  return (
    <div className={`flex items-center justify-center gap-5 ${className}`}>
      <span
        className="relative block shrink-0"
        style={{ width: logoSize, height: logoSize }}
      >
        <Image
          src={BRANDING.assets.logoColor}
          alt={`${BRANDING.name} — Logo colorida`}
          fill
          sizes={`${logoSize}px`}
          priority
          className="rounded-xl object-contain"
        />
      </span>

      <span
        className="w-px shrink-0 bg-gray-300"
        style={{ height: logoSize * 0.72 }}
        aria-hidden="true"
      />

      <span
        className="relative block shrink-0"
        style={{ width: partnerSize, height: partnerSize }}
      >
        <Image
          src={BRANDING.assets.logoPartner}
          alt="Banco de Alimentos de São João del-Rei"
          fill
          sizes={`${partnerSize}px`}
          priority
          className="object-contain"
        />
      </span>
    </div>
  );
}
