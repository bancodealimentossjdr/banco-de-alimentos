import Image from "next/image";
import { BRANDING } from "@/lib/branding";

interface AnnonaeLoaderProps {
  size?: number;
  label?: string;
  showLabel?: boolean;
  className?: string;
}

/**
 * Loader institucional do Annonae.
 *
 * Duas camadas da MESMA imagem sobrepostas — garante alinhamento
 * pixel-perfect. A camada de baixo fica dessaturada; a de cima é
 * revelada de baixo para cima via `clip-path` (classe `.annonae-fill`).
 */
export default function AnnonaeLoader({
  size = 96,
  label = "Carregando…",
  showLabel = true,
  className = "",
}: AnnonaeLoaderProps) {
  return (
    <div
      className={`flex flex-col items-center gap-3 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="relative" style={{ width: size, height: size }}>
        {/* Camada base — apagada */}
        <Image
          src={BRANDING.assets.logoColor}
          alt=""
          fill
          sizes={`${size}px`}
          priority
          aria-hidden="true"
          className="object-contain opacity-20 grayscale"
        />

        {/* Camada colorida — revelada progressivamente */}
        <div className="annonae-fill absolute inset-0">
          <Image
            src={BRANDING.assets.logoColor}
            alt=""
            fill
            sizes={`${size}px`}
            priority
            aria-hidden="true"
            className="object-contain"
          />
        </div>
      </div>

      {showLabel && (
        <span className="text-xs font-medium tracking-wide text-green-800/70">
          {label}
        </span>
      )}
    </div>
  );
}
