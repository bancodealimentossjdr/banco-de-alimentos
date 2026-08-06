/**
 * Constantes de branding institucional do Annonae.
 * Fonte única de verdade para nome, tagline, parceiros e assets.
 */

export const BRANDING = {
  // Identidade principal
  name: "Annonae",
  fullName: "Annonae — Sistema de Gestão de Bancos de Alimentos",
  tagline: "Gestão inteligente para combater a fome.",
  description:
    "Plataforma de gestão operacional para bancos de alimentos, ONGs e políticas públicas de segurança alimentar.",

  // Etimologia (uso institucional/marketing)
  etymology:
    "Do latim Annōna — deusa romana do suprimento de grãos e nome do sistema público de distribuição de alimentos no Império Romano.",

  // URLs
  productionUrl: "https://banco-de-alimentos-green.vercel.app",

  // Contato institucional
  contact: {
    city: "São João del-Rei",
    state: "MG",
    country: "Brasil",
  },

  // Paleta institucional (usada em PDFs e SVGs inline)
  colors: {
    green: "#14532D",
    greenLight: "#166534",
    gold: "#C9A227",
    goldLight: "#E3C766",
  },

  // Assets (caminhos públicos)
  assets: {
    logoColor: "/logos/annonae-color.png",
    logoMono: "/logos/annonae-mono.png",
    /** Brasão dourado com fundo transparente — usado sobre fundos escuros */
    logoGold: "/logos/annonae-gold.svg",
    logoPartner: "/logos/banco-alimentos-sjdr.png",
    favicon: "/favicon.ico",
  },
} as const;

/**
 * Parceiros institucionais ativos.
 * Adicionar novos parceiros aqui à medida que a expansão avançar.
 */
export const PARTNERS = [
  {
    id: "banco-sjdr",
    name: "Banco de Alimentos de São João del-Rei",
    shortName: "Banco SJDR",
    logo: "/logos/banco-alimentos-sjdr.png",
    active: true,
    role: "Operação principal",
  },
] as const;

export type Partner = (typeof PARTNERS)[number];
