# 🍎 Annonae — Sistema de Gestão de Banco de Alimentos

> **📅 Última atualização:** 22/08/2026
> **🎯 Propósito:** Documento de continuidade oficial. Backup de contexto para retomar o desenvolvimento em qualquer nova conversa (qualquer LLM).
> **👤 Desenvolvedor:** Vitor · São João del-Rei / MG
> **🌐 Produção:** https://annonae.com.br

---

## 🚀 Como usar

Cole este arquivo no primeiro prompt junto com:

> "Estou retomando o desenvolvimento do sistema **Annonae** (Banco de Alimentos). Segue o backup oficial do contexto. Leia tudo e me confirme onde paramos antes de continuarmos."

---

## 📖 1. Visão Geral

- **Nome comercial:** **Annonae** (referência à *Annona*, instituição romana de distribuição de grãos)
- **Tipo:** Aplicação web (PWA) para gestão operacional de uma ONG
- **Escopo:** doações, distribuições a beneficiários, colheita solidária, estoque, eventos e cadastros
- **Status:** em produção, uso real diário pelo Banco de Alimentos de SJDR
- **Fase atual:** 🔥 **Onda 22 — Faxina Técnica (EM ANDAMENTO)**
- **Fase institucional:** expansão — reuniões com **Mesa Brasil, CGESAN e prefeituras**

### 🛠️ Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) · TypeScript |
| Banco | PostgreSQL (Supabase) — **dev = prod** |
| ORM | Prisma v6.19.3 |
| Auth | NextAuth v5 — Credentials + Google + JWT |
| Host | Vercel Free (limite 10s/função) |
| UI | Tailwind CSS · react-hot-toast |
| Gráficos | Recharts (**lazy-loaded**) |
| Export | exceljs · jsPDF · jspdf-autotable |
| PWA | `manifest.json` + `public/sw.js` + workbox |
| Outros | bcryptjs · canvas (assinatura PNG base64) |

---

## 👥 2. Permissões (RBAC)

| Role | Descrição |
|---|---|
| 🛠️ **dev** | Máxima, exclusiva do Vitor. Vê tudo sem máscara (CPF, origem, PDF completo) |
| 👑 **admin** | Operação total + cadastros estruturais + usuários |
| 🧑‍💼 **operador** | Dia-a-dia; trava temporal (só mesmo dia) |
| 👀 **visualizador** | Somente leitura, dados mascarados (LGPD) |

### Matriz resumida

| Funcionalidade | dev | admin | operador | visualizador |
|---|:-:|:-:|:-:|:-:|
| Ver movimentações | ✅ cru | ✅ | ✅ | ✅ mascarado |
| Criar/editar/excluir movimentações | ✅ | ✅ | ✅ mesmo dia | ❌ |
| Finalizar distribuição (comprovante) | ✅ | ✅ | ✅ | ❌ |
| Ver Em Estoque / Estoque de Eventos | ✅ | ✅ | ✅ | ❌ |
| Ver `origem` da distribuição | ✅ | ⚠️ | ⚠️ | ❌ |
| Cadastros (criar/editar/excluir) | ✅ | ✅ | ❌ | ❌ |
| Gerenciar usuários / trocar role | ✅ | ✅ | ❌ | ❌ |
| Audit Log | ✅ | ✅ | ❌ | ❌ |
| Reverter retirada de ingresso | ✅ | ❌ | ❌ | ❌ |
| Deletar folha-resumo | ✅ | ❌ | ❌ | ❌ |
| PDF Arrecadação Extra (c/ CPF) | ✅ | ❌ | ❌ | ❌ |
| Excel Arrecadação Extra (s/ CPF) | ✅ | ✅ | ✅ | ❌ |
| **Export XLSX de ingressos** | ✅ CPF cru | ✅ CPF mascarado | ❌ | ❌ |
| Painel de registros em tempo real | ✅ | ❌ | ❌ | ❌ |
| Confirmação de recebimento por local | ✅ | ❌ | ❌ | ❌ |

> ⚠️ **`origem`:** campo sensível; alvo é leitura crua só para dev. Admin/operador veem o efeito no estoque, não a granularidade.

### 🔐 Princípios

1. **Backend nunca confia no frontend** — toda API valida via helper (`requireView`/`requireEdit`/`requireRole`/`requireAdminOrDev`/`requireDev`)
2. Dados sensíveis **mascarados no servidor** (visualizador recebe JSON já mascarado)
3. Botões ocultos no frontend quando o role não permite
4. Operador tem **trava temporal**
5. Trava de duplo clique · rascunho local
6. Visualizador **redirecionado** de páginas sensíveis
7. **Fail-secure** — sem role válido, trata como visualizador
8. **CPF sempre normalizado para dígitos** no save e na busca
9. 🆕 **Gate de auth só via `auth-helpers`** — proibido `auth()` cru em rota de API

---

## 📦 3. Modelo de Estoque

**Operação real (Cenário A) — vigente**
- Doações chegam **brutas** (pode ter item estragado)
- Colheita Solidária = 100% aproveitada (só `status="realizada"`)
- Câmara Fria = Σ `DailyApproval.approvedQty`
- Distribuições saem da câmara fria

**Fórmulas**
Estoque Geral = Marco + Σ(DailyApproval.approvedQty) − Σ(DistributionItem.qty onde origem = DOACAO_COLHEITA) Estoque Eventos = Σ(Recebido − Refugo) − Σ(Distribuído onde origem = EVENTO) Aproveitamento = Σ(Recebido − refugoKg) / Σ Recebido × 100


- ✅ Fonte única de verdade: `src/lib/stock/calculate-stock.ts`
- ✅ Estoque geral só retorna valor se houver marco (`hasMarker`); senão `null`

---

## 🗺️ 4. Ondas Concluídas *(histórico enxuto)*

| Onda | Entrega | Data |
|---|---|---|
| **1–16.7** | Base: CRUD de cadastros (produtos, doadores, beneficiários, funcionários, produtores), doações, distribuições, colheita solidária, estoque com marcos, comprovante com assinatura digital, PWA, RBAC, exportações | — |
| **17** | Módulo genérico de **Eventos** — schema, CRUD admin, ativar/encerrar, RBAC por registro, refugo (Opção B), tela mobile-first, gate do `/campo`. *(17.8-e swipe descartado)* | 12/07/26 |
| **17-C** | Card **Estoque de Eventos** na `/estoque` + leitura de `origem` no cálculo | — |
| **18** | **Balcão Ingresso→Alimento** em escala (16 tablets): `ShowContador` atômico, teto de 3/CPF global, anti-race (`updateMany where retirado:false`), reversão DEV-only, busca por CPF, Folha Resumo (renda ≤ 810,55 → 422; anti-duplicata → 409), export XLSX. **3 testes de fogo aprovados** | 21/07/26 |
| **19** | Role **dev** consolidada — superior a todas, gate `requireAdminOrDev()` nas rotas de operadores | 22/07/26 |
| **Arrecadação Extra** | Recompensa por doação (nome + CPF + local + números por kg). Excel s/ CPF · PDF c/ CPF (dev). Sorteio presencial, fora do app | — |
| **Expo Del Rei** | Correção em campo: numeração contígua de cupons por show, CPF normalizado, painel tempo real (dev), confirmação por local, cadastro simplificado, integração com MinhaSJ. 🏆 **Maior teste de fogo — evento rodou perfeitamente** | 22/07/26 |
| **20** | **Performance:** Recharts via `next/dynamic({ssr:false})`, `graficos-utils.ts` puro, `revalidate` 15/30 no lugar de `force-dynamic`. 💡 *Lição: medir bundle antes de otimizar SQL* | 05/08/26 |
| **Filtros Colheita** | Filtros na colheita no padrão das Distribuições | — |
| **21** | **Branding Annonae** completo: logo (header/sidebar/login), favicon + ícones PWA, metadados/OG, logo e cabeçalho nos PDFs, cabeçalho/rodapé no Excel, layout e paleta, textos legados substituídos | 21/08/26 |
| **21.1** | Refino do PDF de Arrecadação Extra: retrato A4, card único de destaques em grid, maiores doadores por show, tratamento de empate → sorteio presencial, máscara de sobrenome (LGPD), identidade por CPF>nome | 22/08/26 |

---

## 🔥 5. ONDA ATUAL — Onda 22: Faxina Técnica

**Objetivo:** quitar dívida técnica e padronizar o núcleo. Pré-requisito do multi-tenancy (§7).

| # | Item | Status |
|---|---|:-:|
| 22-a | **Padronizar auth** nas rotas de ingressos | ✅ |
| 22-b | Limpar `auth.ts` (JWT DEBUG + return duplicado) | ✅ *já estava limpo — item era falso positivo do backup* |
| 22-f | `export/route.ts` da Arrecadação Extra via helper | ✅ |
| 22-g | Bug `_count` em `/api/funcionarios` | ✅ |
| 22-h | Rascunho fantasma (`useDraft.ts`) | ⏳ **próximo** |
| 22-c | Limpar raiz (`dev.db`, `fix-*.js`) | ⏳ |
| 22-d | Extrair `checarVinculoEvento()` | ⏳ |
| ~~22-e~~ | ~~Snapshot explícito de evento~~ | ❌ **removido — é feature, foi para o backlog** |

### ✅ 22-a / 22-f — Padronização de auth *(commit: `fix(security): fecha /api/ingressos/export para visualizador e unifica gates em auth-helpers`)*

**🚨 Achado de segurança (LGPD):** `/api/ingressos/export` exigia apenas *estar logado*. Qualquer **visualizador** — o role criado justamente para não ver dado sensível — baixava XLSX com **CPF, nome, data de nascimento, cidade e bairro** de ~18.000 reservas.

| Arquivo | Antes | Depois |
|---|---|---|
| `api/ingressos/export/route.ts` | `auth()` cru, **sem gate de role** | `requireAdminOrDev()` · **CPF cru só dev, mascarado p/ admin** · aba "Sobre" (proveniência) · cabeçalho Annonae · `numFmt '@'` em CPF/protocolo |
| `api/ingressos/buscar/route.ts` | `auth()` cru + check manual duplicado em POST **e** GET | `requireRole(['dev','admin','operador'])` · `any` eliminado · lógica de dedup **intocada** |
| `api/eventos/[id]/arrecadacao-extra/export/route.ts` | `requireAuth()` + check manual de role | `requireAdminOrDev()` |

**Novos helpers em `src/lib/auth-helpers.ts`:**
- `requireRole(roles: readonly UserRole[])` — gate genérico, substitui checks manuais espalhados
- `requireDev()` — ações irreversíveis / dados crus

### ✅ 22-g — `_count` em `/api/funcionarios` *(commit: `fix(funcionarios): consolida _count em totalUsos e remove auth() redundante`)*

**Causa:** `_count` devolvia **9 chaves separadas** (`donationsAsEmployee1..3`, `distributions…`, `harvests…`) e nenhum total → consumidor lia campo inexistente. Além disso a rota chamava **`auth()` de novo** após o `requireView`, gerando 2ª query por request.

**Correção:** função `derivarUsos()` consolida no servidor → `totalUsos` + `usos.{doacoes,distribuicoes,colheitas}`. `_count` mantido no payload para retrocompatibilidade. `auth()` redundante removido (usa `authResult.user.role`). Bônus: validação de `name` obrigatório no POST.

---

## 🔜 6. Próximas Ondas

### 🥇 Onda 23 — Performance: fechar o cerco
- `ExportarEventoPdf` → lazy load (provável jsPDF + html2canvas no bundle)
- Auditar `force-dynamic` em `/campo`, `/arrecadacao-extra`, `/folha-resumo`
- Unificar os **2 loops** sobre `recebimentos` em `eventos/[id]/page.tsx`
- Índices: `Recebimento(eventoId, createdAt)` · `Evento(dataInicio)`
- `npm run build` → registrar chunks como baseline
- Payload `fatos[]` → considerar agregação server-side por dia
- 🆕 **Avaliar o custo do callback `jwt`**: `auth.ts` relê `User` no banco **a cada request**. Correto para segurança (revoga role na hora), mas é custo fixo por chamada — relevante com 16 tablets e limite de 10s da Vercel Free. Decisão de arquitetura, não faxina
- 🆕 Avaliar migração `npm 11 → 12` (adiada de propósito para não misturar variáveis)
- 🆕 Migrar `package.json#prisma` → `prisma.config.ts` (deprecado no Prisma 7)

### 🥈 Onda 24 — Observabilidade & AuditLog
- **Sentry** — hoje estamos cegos em produção
- Ativar o model `AuditLog` (visualização dev-only)
- ⚠️ Criar já pensando em `organizacaoId`

### 🥉 Onda 25 — Relatórios Institucionais
- Relatório mensal consolidado (PDF/CSV) — **usa a identidade da Onda 21, já pronta**
- Agregados por período, doador, beneficiário; formato aceito por órgãos públicos

### 🏅 Onda 26 — Backup & Segurança
- Backup do Supabase **documentado e testado**
- Audit formal das permissões por role
- ⚠️ Pré-requisito obrigatório do multi-tenancy

### 🎖️ Onda 27 — Preparações estruturais
- `DistributionItem.origem`: String → **enum** + backfill + `@@index`
- Estoque Geral → **modelo de pool** (igual Eventos)
- Revisar cada model: global ou por organização?

### 🏛️ Onda 28 — MULTI-TENANCY (última onda) — ver §7

---

## 🏛️ 7. Multi-Tenancy (arquitetura DECIDIDA)

### ✅ Decisão: banco compartilhado + coluna `organizacaoId`
**Rejeitado:** instância por cliente.

| Critério | `organizacaoId` ✅ | Instância/cliente ❌ |
|---|---|---|
| Custo Supabase | 1 projeto | 1 por cliente |
| Migrations | 1 comando | N deploys manuais |
| Deploy Vercel | 1 app | N apps |
| Métricas da rede | `GROUP BY` | Inviável sem ETL |
| Isolamento | Código + RLS | Total por natureza |
| Sustentável p/ 1 dev | ✅ | ❌ |

**Decisivo:** dev único. N bancos = N migrations manuais = trava na terceira prefeitura.
**Bônus:** painel consolidado da rede ("quantos kg MG arrecadou?") vira um `GROUP BY`.

### 🛡️ Três camadas

**1 — Schema**
```prisma
model Organizacao {
  id        String   @id @default(cuid())
  nome      String
  slug      String   @unique   // annonae-sjdr, mesa-brasil-bh
  ativo     Boolean  @default(true)
  createdAt DateTime @default(now())
  users     User[]
  eventos   Evento[]
}

model Evento {
  id            String      @id @default(cuid())
  organizacaoId String
  organizacao   Organizacao @relation(fields: [organizacaoId], references: [id])
  @@index([organizacaoId, dataInicio])
}

2 — Prisma Client Extension (filtro automático — ponto mais crítico)

// src/lib/prisma-tenant.ts
export function prismaForOrg(organizacaoId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query, model }) {
          if (!MODELOS_TENANT.has(model)) return query(args)
          args.where = { ...args.where, organizacaoId }
          return query(args)
        },
      },
    },
  })
}

→ Esquecer o filtro se torna impossível. Fail-secure por padrão.

3 — RLS no Supabase — rede de segurança contra bug de aplicação.

🔑 Tenant: organizacaoId no JWT do NextAuth, nunca do frontend.

⚠️ Riscos: organizacaoId NOT NULL em ~20 models exige backfill (tudo → "Annonae SJDR"). Irreversível na prática. Exige backup verificado, onda dedicada, janela de baixo uso — nunca durante evento ativo.

🔮 8. Backlog
Cards de Resumo All-Time (16.4) · Estoque diferido (16.6b)
Indicadores de evento (17.5, parcialmente absorvido pela aba Gráficos)
Integração plena evento ↔ estoque (17.7)
Snapshot explícito de evento (ex-22-e — é feature, exige desenho)
Aba Tutorial (onboarding) · Notificações + Workflow · Aba Impróprios (Descarte)
Auditoria de Estoque · Estoque negativo / canCalibrateStock / pool

📄 9. Arquivos-Chave
Eventos
src/app/eventos/page.tsx                      → lista (revalidate = 30)
src/app/eventos/EventosListClient.tsx         → filtros + busca + excluir
src/app/eventos/[id]/page.tsx                 → detalhe (revalidate = 15)
src/app/eventos/[id]/EventoDetalheClient.tsx  → abas + dynamic import
src/app/eventos/[id]/GraficosEvento.tsx       → Recharts (lazy)
src/app/eventos/[id]/graficos-utils.ts        → funções puras (SEM Recharts)
src/app/eventos/[id]/ExportarEventoPdf.tsx    → ⏳ lazy load (Onda 23)

Balcão / Ingressos
src/app/eventos/[id]/campo/CampoClient.tsx · CardIngressos.tsx
src/app/api/ingressos/buscar/route.ts    → busca global por CPF (requireRole)
src/app/api/ingressos/retirar/route.ts   → teto atômico
src/app/api/ingressos/reverter/route.ts  → dev-only
src/app/api/ingressos/export/route.ts    → XLSX (requireAdminOrDev)
src/app/api/eventos/[id]/folha-resumo/route.ts
src/app/api/eventos/[id]/arrecadacao-extra/export/route.ts → PDF/XLSX/CSV

Núcleo
src/lib/auth.ts            → NextAuth v5 (jwt relê User a cada request)
src/lib/auth.config.ts
src/lib/auth-helpers.ts    → requireAuth · requireRole · requireView · requireEdit
                             requireEditRecord · requireDeleteRecord · requireAdmin
                             requireAdminOrDev · requireDev · requireRegisterRecebimento
                             requireCalibrateStock
src/lib/permissions.ts     → canEdit / canView / podeRegistrarNoEvento / canCalibrateStock
src/lib/mask.ts            → cpfPorRole
src/lib/mask-by-role.ts    → maskFuncionarioList
src/lib/cpf.ts             → normalizeCpf
src/lib/branding.ts        → BRANDING.name / BRANDING.tagline
src/lib/prisma.ts
src/lib/stock/calculate-stock.ts   → fonte de verdade do estoque geral
src/components/ui/BotaoVoltar.tsx

Branding (Onda 21)
public/logos/annonae-color.png   → usada nos PDFs (base64 via readFileSync)
public/logo-annonae.svg          → arte vetorial
public/manifest.json · src/app/layout.tsx
Paleta: VERDE #14532D · OURO #C9A227 · VINHO #9B2C2C · CINZA #6E6E6E


Abas do detalhe de evento: doacoes · locais · alimentos · operadores (admin) · graficos Rotas de ingresso: /campo (Ingresso→Alimento) · /arrecadacao-extra (Conheça seu Ídolo) · /folha-resumo (Ingresso Social por Família)

Schema Prisma
User · Product · Donor · Beneficiary · Employee · Producer
Donation/DonationItem · Distribution/DistributionItem (origem: String default "DOACAO")
Harvest/HarvestItem · DailyApproval · StockMarker · AuditLog · DeliveryReceipt
Evento · LocalColeta · EventoOperador · EventoAlimento · Recebimento
ReservaIngresso · LoteIngresso · ShowContador · ArrecadacaoExtra (+itens)
enum EventoStatus { RASCUNHO ATIVO ENCERRADO }

⚠️ 21 migrations aplicadas · DistributionItem.origem é String sem índice → Onda 27

🎯 10. Decisões Travadas
4 roles: dev (Vitor), admin, operador, visualizador
Nome Annonae + domínio annonae.com.br; branding concluído (app, PWA, PDFs, Excel)
Teto de ingresso = 3 alimentos, GLOBAL por CPF (ReservaIngresso liga a lote, não a eventoId)
Anti-race via updateMany where retirado:false
Reversão de retirada e DELETE de folha-resumo: dev-only
Estoque de Eventos é card na /estoque (mascarado); estoque geral será pool (Onda 27)
Arrecadação Extra: Excel s/ CPF (admin/operador) · PDF c/ CPF (dev) · sorteio fora do app
Empate no PDF de destaques → sorteio presencial, nomes listados com sobrenome mascarado
CPF sempre normalizado para dígitos
Editar registro deve recalcular totais
Swipe de exclusão descartado — botão comum, só admin
Recharts sempre lazy; páginas de evento usam revalidate, nunca force-dynamic
🆕 Gate de auth exclusivamente via auth-helpers — auth() cru proibido em rota de API
🆕 CPF cru em export é privilégio de dev; admin recebe mascarado
Multi-tenancy = banco compartilhado + organizacaoId + Prisma extension + RLS, última onda

🐛 11. Pendências Técnicas
| ⚠️ | Pendência | Onda |
| --- | --- | --- |
| 🔴 | Sem observabilidade — cegos em produção | 24 |
| 🔴 | ExportarEventoPdf pesado no bundle | 23 |
| 🔴 | Subpáginas de evento possivelmente force-dynamic | 23 |
| 🟡 | jwt callback consulta o banco a cada request | 23 (avaliar) |
| 🟡 | Loop duplicado sobre recebimentos em eventos/[id]/page.tsx | 23 |
| 🟡 | origem é String sem índice | 27 |
| 🟡 | package.json#prisma deprecado (Prisma 7) | 23 |
| 🟢 | Rascunho fantasma (useDraft.ts) | 22-h (atual) |
| 🟢 | Arquivos suspeitos na raiz (dev.db, fix-*.js) | 22-c (atual) |
| 🟢 | Lógica de vínculo de evento duplicada | 22-d (atual) |
| 🟢 | Refatoração do estoque geral p/ pool | 27 |
| ✅ | auth() cru nas rotas de ingresso | resolvido 22-a |
| ✅ | _count em /api/funcionarios | resolvido 22-g |
| ✅ | [JWT DEBUG] em auth.ts | não existia |

⚠️ Riscos operacionais
Vercel Free: 10s por função serverless
Banco único (dev = prod): toda migration afeta produção real
Nunca migrar durante evento ativo
Latência em campo → timeout + fallback manual obrigatórios

🔄 12. Fluxo de Trabalho
Duas máquinas (casa/trabalho), branch único main, ambiente Windows/PowerShell
Ritual: git status → git pull origin main → trabalha → git add . → commit semântico → git push origin main
Sincronização real: git rev-parse HEAD idêntico nas duas máquinas + git status -sb sem ahead/behind
Após pull: npm ci → npx prisma generate → npx prisma migrate status → npm run build
⚠️ .env.local não vem no Git; NEXTAUTH_SECRET deve ser o mesmo valor nas duas máquinas
⚠️ No PowerShell, mensagem de commit sempre entre aspas duplas — fix(x) sem aspas vira erro de sintaxe
Commits semânticos: feat, fix, perf, chore, refactor, style
Planejamento antes de código · arquivo inteiro, não trechos · ondas pequenas e testáveis
Restart do TS Server / Next dev é parte do fluxo (cache engana)

📌 13. Onde Estamos AGORA
Último commit: 1b8ef0f — refactor(pdf): card de destaques em grid alinhado (base da Onda 22) Ambiente: ✅ working tree limpo · 21 migrations aplicadas · schema up to date

Onda 22 — Faxina Técnica, em andamento:

✅ 22-a / 22-b / 22-f / 22-g concluídos (com 1 falha de segurança LGPD corrigida)
⏳ Próximo: 22-h — rascunho fantasma (useDraft.ts)
⏳ Depois: 22-c (raiz) → 22-d (checarVinculoEvento())
Arquivos que faltam enviar:

src/hooks/useDraft.ts + um componente que o consome → 22-h
Saída de git status --ignored --short → 22-c
Rotas que checam vínculo de operador em evento → 22-d
Depois: 23 (performance) → 24 (observabilidade) → 25 (relatórios) → 26 (backup) → 27 (preparações) → 28 (multi-tenancy)

📋 Pendências de input do Vitor
🔎 Saída das queries SQL de origem (para fidelizar calculate-stock.ts)
🏛️ Prazo das reuniões Mesa Brasil / CGESAN (define urgência da Onda 25)
🤝 Existe compromisso firmado de replicação institucional? (define quando disparar a Onda 28)
🩹 Qual a maior dor de uso real da ONG hoje? (dor real bate roadmap teórico)

Fim do backup — 22/08/2026 · Onda 22 em andamento (22-a, 22-b, 22-f, 22-g concluídos)