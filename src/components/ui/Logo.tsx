import Image from "next/image";
import { BRANDING } from "@/lib/branding";

type LogoVariant = "color" | "mono" | "partner";

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
 * <Logo variant="mono" width={140} height={40} />
 * <Logo variant="partner" width={120} height={120} />
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
 * Bloco de parceria — exibe Annonae + Banco SJDR lado a lado.
 * Usado na tela de login e em PDFs institucionais.
 */
export function PartnershipLogos({
  className = "",
  logoSize = 80,
}: {
  className?: string;
  logoSize?: number;
}) {
  return (
    <div className={`flex items-center justify-center gap-6 ${className}`}>
      <Logo
        variant="color"
        width={logoSize * 2.5}
        height={logoSize}
        priority
      />
      <div className="h-12 w-px bg-gray-300" aria-hidden="true" />
      <Logo
        variant="partner"
        width={logoSize}
        height={logoSize}
        priority
      />
    </div>
  );
}
