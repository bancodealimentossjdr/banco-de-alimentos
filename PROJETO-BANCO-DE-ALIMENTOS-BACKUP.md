# 🍎 Annonae — Sistema de Gestão de Banco de Alimentos

> **📅 Última atualização:** 02/06/2026
> **🎯 Propósito:** Documento de continuidade oficial. Backup completo de contexto para retomar o desenvolvimento em qualquer nova conversa (qualquer plataforma de LLM).
> **👤 Desenvolvedor:** Vitor
> **🌐 URL de produção:** https://banco-de-alimentos-green.vercel.app/
> **📍 Localização:** São João del-Rei / MG, Brasil

---

## 🚀 Como usar este documento em uma nova conversa

Cole este arquivo inteiro no primeiro prompt junto com:

> "Estou retomando o desenvolvimento do sistema **Annonae** (Banco de Alimentos). Segue o backup oficial do contexto. Por favor, leia tudo e me confirme onde paramos antes de continuarmos."

---

## 📖 1. Visão Geral do Projeto

- **Nome comercial:** **Annonae** ✅ (referência à *Annona*, instituição romana de distribuição de grãos)
- **Nome interno técnico:** Sistema de Gestão do Banco de Alimentos de São João del-Rei (SJDR)
- **Tipo:** Aplicação web (PWA) para gestão operacional de uma ONG
- **Objetivo:** Controlar doações recebidas, distribuições a beneficiários, colheita solidária, estoque e cadastros relacionados.
- **Status:** App em produção, em uso real pelo Banco de Alimentos de SJDR.
- **Fase atual:** Expansão institucional (reuniões com Mesa Brasil, CGESAN, prefeituras já em andamento).

### 🛠️ Stack Tecnológica

- **Framework:** Next.js 16 (App Router)
- **Linguagem:** TypeScript
- **Banco de dados:** PostgreSQL (Supabase) — dev = prod
- **ORM:** Prisma v6.19.3
- **Autenticação:** NextAuth v5 (Auth.js) com Credentials + JWT
- **Hospedagem:** Vercel (plano Free — limite de 10s/função serverless)
- **Estilização:** Tailwind CSS
- **Hash de senha:** bcryptjs
- **Toasts:** react-hot-toast
- **PWA:** ✅ `manifest.json` já configurado (app instalável na tela inicial)
- **Exportação:** exceljs + jsPDF + jspdf-autotable (client-side)

---

## 👥 2. Sistema de Permissões (RBAC)

### Roles definidas

| Role | Descrição |
|------|-----------|
| 👑 **admin** | Acesso total à operação; gerencia cadastros estruturais e usuários |
| 🧑‍💼 **operador** | Dia-a-dia (doações, distribuições, colheitas); trava temporal no mesmo dia |
| 👀 **visualizador** | Somente leitura — vê dados mascarados (LGPD-friendly) |

> 🗑️ **Removida do escopo:** a role `desenvolvedor` e os painéis `/dev/*` (antiga Onda 14.8) foram retirados do roadmap. Funcionalidade técnica equivalente poderá ser incorporada em onda futura, se necessário.

### 📋 Matriz de Permissões

| Funcionalidade | 👑 Admin | 🧑‍💼 Operador | 👀 Visualizador |
|----------------|:-------:|:-----------:|:--------------:|
| Ver movimentações | ✅ | ✅ | ✅ (mascarado) |
| Criar/Editar/Excluir movimentações | ✅ | ✅ (só no mesmo dia) | ❌ |
| Ver cadastros de produtos/estoque | ✅ | ✅ | ✅ (mascarado) |
| Ver páginas de Produtor/Funcionário/Instituição | ✅ | ✅ | ❌ (redirect → Dashboard) |
| Criar/Editar/Excluir cadastros | ✅ | ❌ | ❌ |
| Gerenciar usuários | ✅ | ❌ | ❌ |
| Ver Audit Log | ✅ (próprio escopo) | ❌ | ❌ |
| Exportar relatórios (PDF/Excel/CSV) | ✅ (opção censura) | ✅ | ✅ (mascarado) |
| Acessar aba Tutorial | ✅ | ✅ | ✅ |

### 🔐 Princípios aplicados

1. **Backend nunca confia no frontend** — toda API valida via `requireView`/`requireEdit`.
2. **Dados sensíveis são mascarados no servidor** — visualizador recebe JSON já mascarado.
3. **Botões de ação são ocultos** no frontend quando o role não tem permissão (UX).
4. **Operador tem trava temporal** — só edita/exclui movimentações do mesmo dia.
5. **Trava de duplo clique** — botões de submit desabilitam durante o envio.
6. **Rascunho local** — formulários críticos preservam dados em caso de queda.
7. **Visualizador é redirecionado** para Dashboard ao tentar acessar páginas sensíveis.
8. **Criptografia em camadas** — dados pessoais protegidos.
9. **Fail-secure** — na ausência de role válido, trata como visualizador e mascara.

---

## 📦 3. Modelo de Estoque (regra atual, SOB AUDITORIA na Onda 16.1)

### Operação real (Cenário A)

- 🏪 **Doações** chegam ao banco em estado **bruto** (pode ter coisa estragada)
- 🌾 **Colheita Solidária** é cadastrada em aba separada, considerada **100% aproveitada** — controle à parte, entra na fórmula de estoque
- 🧊 **Câmara Fria** = soma de `DailyApproval.approvedQty` (operador lança o que sobrou após triagem, ela é o nosso estoque)
- 📤 **Distribuições** saem da câmara fria pros beneficiários

### Fórmulas atuais (Onda 10 — sob auditoria na 16.1)

Aproveitado = câmaraFria + distribuído (das DOAÇÕES que passaram na triagem) Em Estoque = câmaraFria (físico guardado AGORA)


### ⚠️ Suspeita ativa (Onda 16.1 — PRÓXIMA)

Vitor suspeita que o estoque atual **não está descontando saídas** dinamicamente. A Onda 16.1 fará auditoria do código atual e correção pra modelo **dinâmico**:

Em Estoque (novo) = Σ(DailyApproval.approvedQty) − Σ(DistributionItem.qty)


### Exemplo numérico (modelo atual)

| Métrica | Valor |
|---|---|
| 🏪 Doações | 3.489,6 kg |
| 🌾 Colheita | 0 kg |
| 🧊 Câmara Fria | 589,8 kg |
| 📤 Distribuído | 928,9 kg |
| ✅ Aproveitado | 589,8 + 928,9 = **1.518,7 kg** |
| 📦 Em Estoque | **589,8 kg** |

---

## 🗺️ 4. Roadmap — Histórico de Ondas Concluídas

### ✅ Fase 1 — Fundação (Ondas 1–11)

| # | Onda | Status |
|---|------|--------|
| 1–3 | Setup, CRUDs, sistema de permissões base | ✅ |
| 3A | Calculadora de peso líquido (campo `boxes` em DonationItem) | ✅ |
| 4.0 | Role visualizador adicionada | ✅ |
| 4.1 | Página de Usuários (CRUD + soft delete) | ✅ |
| 4.2 | RBAC nas APIs (`requireView`/`requireEdit`) | ✅ |
| 4.3 | Proteção de UI por role + Mascaramento LGPD no servidor (inicial) | ✅ |
| 5 | Hotfix: restauração de handlers POST + rotação de credenciais Supabase | ✅ |
| 6 | Desconto automático de caixas (`<CalculadoraPeso />` reutilizável) | ✅ |
| 7 | Múltiplos funcionários (até 3) em doações, distribuições e colheitas | ✅ |
| 8 | Trava de duplo clique em formulários (`useFormSubmit`) | ✅ |
| 9 | Rascunho local com auto-save (`useDraft` + `DraftBanner` + `DraftSavedIndicator`) | ✅ |
| 10 | Correção do cálculo de Estoque (modelo mental travado) | ✅ |
| 11 | Performance Geral (queries Prisma, Promise.all, cache estratégico) | ✅ |

### ✅ Fase 2 — Indicadores (Onda 12)

**Onda 12 — Aba Indicadores** ✅
- Dashboard com filtros (período, produto, doador, beneficiário)
- Gráficos (barras, linhas, pizza) com `recharts`
- Totais, médias, top 10
- APIs: `/api/indicadores/macro`, `/tendencias`, `/rankings`, `/produtos`
- 5 componentes de visualização
- Respeita RBAC (visualizador vê mascarado)

### ✅ Fase 3 — LGPD Completa (Onda 13)

**Onda 13 — LGPD Completa** ✅
Blindagem total de dados pessoais com mascaramento, auditoria e consentimento formal.

- **13.1** — Lib de Máscaras (`src/lib/mask.ts`): `maskCPF`, `maskRG`, `maskEmail`, `maskPhone`, `maskCEP`, `maskAddress`, `maskContactName`
- **13.2** — Permissões de Visualização (`permissions.ts`, `mask-by-role.ts`): `canViewSensitiveData`, `applyDataMask`, `shouldMaskPersonalData` (fail-secure), helpers por entidade
- **13.3** — Máscaras aplicadas em TODAS as APIs (beneficiarios, doadores, funcionarios, produtores, usuarios, doacoes, distribuicoes, colheita-solidaria) + **bug crítico corrigido:** `GET /api/doacoes` estava público
- **13.4** — Audit Log (modelo `AuditLog` + middleware automático + tela `/audit-log`)
- **13.5** — Termo de Consentimento + Política de Privacidade + Termos de Uso + campo `consentimentoLGPD`

### ✅ Fase 4 — Exportação (Onda 15) 🎉 CONCLUÍDA EM 01–02/06/2026

> ⏪ Era originalmente a Onda 18. Antecipada por necessidade institucional urgente.

**Onda 15 — Exportação PDF/Excel/CSV** ✅ **COMPLETA**

- **15.1 — Exportação Excel dos Indicadores** ✅
  - Arquivo `.xlsx` multi-aba (Resumo, Tendências, Rankings, Produtos)
  - Lib: `exceljs` (client-side)
  - Respeita máscara LGPD

- **15.2 — Exportação PDF dos Indicadores** ✅
  - Relatório institucional com header Annonae, período, data de emissão
  - Tabelas (não gráficos) — mais profissional e estável
  - Rodapé "Emitido por [usuário] em [data]"
  - Lib: `jsPDF` + `jspdf-autotable`

- **15.2.5 — Filtros de Indicadores (refinamento)** ✅ 🆕
  - Período padrão de 30 dias
  - Presets rápidos de período
  - Exibição de datas no formato **DD-MM-YYYY**
  - ✅ **Resolveu de fato o antigo BUG-001** (filtro de data)

- **15.3 — Exportação CSV de Listagens** ✅
  - CSV para Doações, Distribuições, Colheita Solidária
  - Respeita máscara LGPD
  - Nome padronizado: `annonae-[modulo]-YYYY-MM-DD.csv`

**🏗️ Arquitetura final (divergiu do plano original — pasta dedicada):**
- `src/lib/export/indicadores-data.ts` — coleta unificada de dados + censura por role
- `src/lib/export/indicadores-pdf.ts`
- `src/lib/export/indicadores-excel.ts`
- `src/app/api/indicadores/export/route.ts` — endpoint de export
- `src/components/BotoesExportacao.tsx` — botões com opção de censura para admin
- `src/components/FiltrosIndicadores.tsx` — filtros refinados

**Itens movidos para Onda futura (Relatórios Avançados):**
- ❌ Relatório mensal automatizado
- ❌ Agendamento de relatórios por email

---

### ✅ Fase 5 — Estoque Dinâmico (Ondas 16.1 + 16.2) — CONCLUÍDA 03/06/2026

**Onda 16.1 — Estoque Dinâmico (Auditoria + Correção)** ✅
- Auditoria do cálculo antigo de estoque
- Migração para modelo dinâmico
- Script de diagnóstico: scripts/diagnostico-aproveitamento.ts
- Confirmado: cobertura DailyApproval parcial (33,3%) — dias sem registro tratados como descarte total (decisão 04/06)

**Onda 16.2 — Marcos de Estoque (StockMarker)** ✅
- Modelo StockMarker (ZERO + ADJUSTMENT) + enum StockMarkerType
- Lib src/lib/stock/calculate-stock.ts (fonte única de cálculo)
- APIs: /api/stock-markers + /api/stock-markers/[id]
- Refatoração de /api/estoque/resumo/route.ts
- Cutoff de fim-de-dia (movimentação do dia do marco = embutida)
- 2 migrations aplicadas (add_stock_markers + onda_16_2_stock_markers)
- Defesa: snapshot vazio se prisma.stockMarker indisponível (cache velho)

> ⚠️ **Aprendizado da Onda 10 reforçado:** alinhar modelo mental ANTES de codar. Auditar antes de corrigir.

---

## 🔜 6. Roadmap — Próximas Ondas

### 🗑️ Onda 16.3 — Filtros Dinâmicos Multi-Select [ABSORVIDA pela Onda 16.5]
> ⚠️ DESCONTINUADA como onda independente (04/06/2026).
> Todo o escopo (filtros multi-select de Doador, Instituição, Produtor e
> Funcionário) foi incorporado à Onda 16.5. Manter este registro apenas
> como histórico — NÃO executar separadamente.

### 🌊 Onda 16.4 — Cards de Resumo All-Time
🎴 Card de resumo all-time em KG total em cada aba de cadastro:

| Aba | Métrica exibida |
|---|---|
| Doadores | "Quanto cada doador doou" |
| Beneficiários | "Quanto cada instituição recebeu" |
| Produtores | "Quanto cada produtor doou" |
| Funcionários | "Quanto cada funcionário arrecadou" |

### 🌊 Onda 16.5 — Indicadores de Aproveitamento 🆕
> 🔗 Continuidade direta das Ondas 16.1 + 16.2 (Estoque Dinâmico/Marcos)
> 🧩 ABSORVE a antiga Onda 16.3 (Filtros Multi-Select)
> 📌 Documento-base ativo: CHECKPOINT-ONDA-16.5-APROVEITAMENTO.md

**Objetivo:** Exibir indicadores de aproveitamento e destinação em GRÁFICOS
na aba Indicadores existente (NÃO na aba /estoque), com filtros multi-select.

**Fórmulas oficiais:**
- Taxa de Aproveitamento (%) = (Aproveitamento + Colheita) / (Doação bruta + Colheita) × 100
- Taxa de Destinação (%) = Distribuído / (Aproveitamento + Colheita) × 100
- Perda (derivada) = Doação bruta − Aproveitamento

**Escopo — gráficos (recharts) na aba Indicadores:**
- 📊 Taxa de Aproveitamento (%) — TOGGLE de tipo (pizza/gauge/barra) no app
- 📊 Taxa de Destinação (%) — TOGGLE de tipo (pizza/gauge/barra) no app
- 📈 Tendência temporal de aproveitamento (kg no período filtrado)
- 📊 Composição: Entrada vs. Aproveitado vs. Perda
- 🔢 Cards de apoio: total doado geral + total estoque dinâmico

**Filtros (absorvidos da antiga 16.3) — multi-select na aba Indicadores:**
- 📅 Período (reusa FiltrosIndicadores.tsx: 30d default + 7/15d + 6m + 1a)
- 👤 Doador
- 🏢 Instituição beneficiária
- 🌾 Produtor
- 👷 Funcionário

**Exportação:**
- 📄 PDF / Excel em TABELA (padrão Onda 15) — gráficos só na tela
- ♻️ Reusa pipeline src/lib/export/ (herda máscara LGPD)

**Decisões confirmadas (04/06/2026):**
- ✅ Gráficos na aba Indicadores; /estoque permanece operacional
- ✅ Toggle de tipo de gráfico no app; export sempre em tabela
- ✅ Cálculo AGREGADO em kg (DailyApproval não possui productId)
- ✅ Dias sem aproveitamento tratados como descarte total

**A criar:**
- src/lib/stock/calculate-utilization.ts
- /api/indicadores/aproveitamento (período + 4 filtros)
- Componentes de gráfico com toggle (recharts)
- Extensão de FiltrosIndicadores.tsx (4 filtros multi-select)

### 🌊 Onda 17 — Expo Del-Rei (CRUD novo + Sub-aba Indicadores + Offline-first)

**Objetivo:** CRUD operacional para o evento Expo Del-Rei (~15.000 registros estimados em 8 locais simultâneos, vários dias). Funciona **offline** (crucial).

- **17.1** — Modelos Prisma: `ExpoLocation`, `ExpoFoodItem`, `ExpoRecord`, `ExpoRecordItem`
- **17.2** — CRUDs Administrativos (Locais + Alimentos; Leite usa **Litros**, demais **KG**)
- **17.3** — Tela Operacional Mobile-first (botões grandes `+`/`−`, salvamento rápido em lote)
- **17.4** — Funcionamento Offline avançado (service worker + IndexedDB + sync automático)
- **17.5** — Indicadores Expo Del-Rei (dropdown Geral/Expo, rankings, refugo TBD)

### 🌊 Onda 18 — Aba Tutorial 🆕

**Objetivo:** Aba de ajuda interna, acessível a **todos os roles logados**, ensinando uso do app e instalação como PWA.

**Escopo:**
- 🔐 Acesso: **apenas usuários logados**, **todas as roles** veem a mesma aba
- 📱 **Como instalar o app na tela inicial:**
  - Passo a passo Android (Chrome → "Adicionar à tela inicial")
  - Passo a passo iOS (Safari → Compartilhar → "Adicionar à Tela de Início")
  - ✅ App já é PWA com `manifest.json` configurado
- 📝 **Passo a passo dos registros do operador:**
  - Como registrar uma Doação
  - Como registrar uma Distribuição
  - Como registrar uma Colheita Solidária
  - (a confirmar: Aprovação Diária / Câmara Fria)
- 📋 Formato de conteúdo (texto vs. texto+prints) a definir com Vitor na execução

### 🌊 Onda 19 — Cache e Otimização de Indicadores
- ⚡ Cache de 5min nos endpoints de indicadores
- 🔍 Revalidação inteligente quando dados mudam

---

## 🔮 7. Roadmap — Ondas Futuras

### 🌊 Onda 20 — Branding Annonae
- 🏷️ Identidade visual (logo, paleta, tipografia)
- 🎨 Tela "Sobre o Sistema" com história da Annonae
- 🖼️ Favicon + Open Graph (preview no WhatsApp/LinkedIn)
- 📄 Landing institucional pública (opcional)

### 🌊 Onda 21 — Multi-Tenant (Replicação Institucional)
- 🏢 Modelo `Organization` no Prisma
- 🔗 Vincular `User`, `Donation`, `Distribution`, etc. a `organizationId`
- 🎯 Middleware de scoping por organização
- ⚙️ Tela de configuração por org
- 🔐 Super-admin (Vitor) vê tudo; admin de org só vê a sua

### 🌊 Onda 22 — Relatórios Avançados + Automação
> Recebe os itens removidos do MVP da Onda 15.
- 📈 Relatório mensal automatizado (PDF)
- 📅 Agendamento de relatórios por email
- 📧 SMTP configurável por organização

### 🌊 Onda 23 — Notificações + Workflow
- 🔔 Email/WhatsApp para doadores agendados
- ⚠️ Alerta de estoque mínimo
- 📅 Agenda integrada (próximas coletas/distribuições)

### 🌊 Onda 24 — Aba Impróprios (Descarte)
- Cálculo: total recebido − total distribuído + colheita do dia
- Registro diário (automático ou manual)
- Campo "motivo" (vencido, estragado, etc.)

---

## 📄 8. Arquivos-Chave do Projeto

src/ ├── app/ │ ├── api/ │ │ ├── auth/[...nextauth]/ │ │ ├── doacoes/ ← ✅ máscara + auth + export CSV │ │ ├── distribuicoes/ ← ✅ máscara + export CSV │ │ ├── colheita-solidaria/ ← ✅ máscara + export CSV │ │ ├── estoque/ │ │ │ ├── resumo/ ← 🚨 fórmula atual — SOB AUDITORIA (Onda 16.1) │ │ │ └── aproveitamentos/ ← preview + POST DailyApproval │ │ ├── indicadores/ │ │ │ ├── macro / tendencias / rankings / produtos │ │ │ └── export/ ← ✅ Onda 15 (endpoint de export) │ │ ├── produtos/ │ │ ├── doadores/ ← ✅ Onda 13.3 │ │ ├── beneficiarios/ ← ✅ Onda 13.3 │ │ ├── funcionarios/ ← ⚠️ BUG: _count incompleto (pendente) │ │ ├── produtores/ ← ✅ Onda 13.3 │ │ ├── usuarios/ ← só admin │ │ └── audit-log/ ← ✅ Onda 13.4 │ ├── audit-log/ ← ✅ tela de consulta │ ├── politica-de-privacidade/ ← ✅ Onda 13.5 │ ├── termos-de-uso/ ← ✅ Onda 13.5 │ ├── estoque/ ← 🚨 SOB AUDITORIA (Onda 16.1) │ ├── indicadores/ ← gráficos (Onda 12) + exports (Onda 15) │ ├── tutorial/ ← 🆕 Onda 18 (a criar) │ └── login/ ├── lib/ │ ├── auth.ts / auth.config.ts / auth-helpers.ts │ ├── permissions.ts │ ├── mask.ts ← (Onda 13.1) │ ├── mask-by-role.ts ← (Onda 13.2 + fail-secure) │ ├── audit.ts ← (Onda 13.4) │ ├── export/ ← ✅ Onda 15 (pasta dedicada) │ │ ├── indicadores-data.ts ← coleta + censura por role │ │ ├── indicadores-pdf.ts │ │ └── indicadores-excel.ts │ └── prisma.ts ├── hooks/ │ ├── usePermissions.ts │ ├── useFormSubmit.ts ← (Onda 8) │ └── useDraft.ts ← (Onda 9) ├── components/ │ ├── AccessDeniedToast.tsx │ ├── CalculadoraPeso.tsx ← (Onda 6) │ ├── DraftBanner.tsx / DraftSavedIndicator.tsx ← (Onda 9) │ ├── ConsentimentoLGPD.tsx ← (Onda 13.5) │ ├── BotoesExportacao.tsx ← ✅ Onda 15 │ ├── FiltrosIndicadores.tsx ← ✅ Onda 15.2.5 │ └── [componentes de indicadores] ├── types/next-auth.d.ts ├── manifest.json ← ✅ PWA já configurado └── proxy.ts ← antigo middleware.ts (Next.js 16)


### Schema Prisma — Modelos principais

- **User** — id, email, password (hash), name, role, active
- **Product** — produtos cadastrados
- **Donor** — doadores (PF/PJ)
- **Beneficiary** — beneficiários (com `consentimentoLGPD: DateTime?` desde Onda 13.5)
- **Employee** — funcionários (3 relações 1:N por tipo de movimentação)
- **Producer** — produtores rurais (colheita solidária)
- **Donation** — header + `employeeId1/2/3`
- **DonationItem** — itens (com campo `boxes`)
- **Distribution** — header + `employeeId1/2/3`
- **DistributionItem** — itens (com campo `boxes`)
- **Harvest** — header + `producerId` + `employeeId1/2/3`
- **HarvestItem** — itens (com campo `boxes`)
- **DailyApproval** — registro diário do que sobrou em câmara fria
- **AuditLog** — ✅ Onda 13.4
- **ExpoLocation / ExpoFoodItem / ExpoRecord / ExpoRecordItem** — ⏳ a criar (Onda 17)

---

## 🎯 9. Decisões Importantes Tomadas

- ✅ **2 roles operacionais + 1 leitura:** admin, operador, visualizador
- 🗑️ **Role `desenvolvedor` + painéis `/dev/*` REMOVIDOS do roadmap** (02/06/2026)
- ✅ **Operador** tem trava temporal (mesmo dia)
- ✅ **Cadastros** são só-admin
- ✅ **Soft delete** de usuários (`active: false`)
- ✅ **Mascaramento no servidor** — visualizador nunca vê dados crus
- ✅ **Fail-secure** — sem role válido = mascarar
- ✅ **Banco único** dev = prod (Supabase)
- ✅ **Defesa em profundidade** — proxy + API auth + máscara + redirect
- ✅ **Next.js 16** — `middleware.ts` → `proxy.ts`
- ✅ **Múltiplos funcionários** via 3 FKs separadas (Onda 7)
- ✅ **Apenas 1º funcionário obrigatório** nas movimentações
- ✅ **Modelo de Estoque (Onda 10):** 🚨 SOB REVISÃO na Onda 16.1
- ✅ **Nome comercial Annonae** decidido
- ✅ **LGPD completa (Onda 13)**
- ✅ **Exportação client-side (Onda 15)** — Vercel Free + zero timeout
- ✅ **PDF com tabelas, não gráficos** (Onda 15)
- ✅ **Export organizado em pasta `src/lib/export/`** (divergiu do plano, mais escalável)
- ✅ **Filtros de indicadores: 30 dias padrão + presets + DD-MM-YYYY** (Onda 15.2.5)
- ✅ **Aba Tutorial (Onda 18):** logada, todas as roles, ensina PWA + registros
- ✅ **PWA já ativo** com `manifest.json`

---

## 🛠️ 10. Aprendizados Operacionais

### Infra/Git (Onda 5)
- Um único `.env.local` na raiz
- `prisma db pull` reescreve o schema (perde comentários) — usar com cuidado
- `git pull --rebase origin main`; **NUNCA** `git push --force`
- Rotação de credenciais: Supabase → local + Vercel simultaneamente

### Schema + Cache TS (Onda 7)
- Após mudar `schema.prisma`: `npx prisma generate`
- Reiniciar TS Server: `Ctrl+Shift+P → TypeScript: Restart TS Server`
- Cache visual do VS Code pode enganar — restart é parte do fluxo
- Atenção a campos antigos em `_count` — quebram o Prisma silenciosamente

### Cálculo de Estoque (Onda 10)
- Alinhamento de modelo mental ANTES de codar é crítico
- Next.js cacheia rotas API em dev — restart obrigatório após editar `route.ts`
- Colheita Solidária é controle paralelo (Cenário A) — entra na fórmula

### LGPD (Onda 13)
- 🛡️ Fail-secure é regra: sem role válido → mascarar
- 🔍 Auditoria antes de aplicar: mapear estado atual de cada API antes de mexer
- ⚠️ `mask.ts` é singular (não `masks.ts`)
- 🚨 APIs sem `requireView` são bomba-relógio
- 📜 AuditLog não deve ter `cascade delete`

### Exportação (Onda 15)
- ✅ Client-side evita timeout do Vercel Free (limite 10s)
- ✅ JSON já chega mascarado da API → export herda máscara LGPD automaticamente
- ✅ Admin pode escolher exportar com/sem censura
- ✅ Tabelas em PDF > gráficos (independe de renderização SVG)
- ✅ Organizar exports em pasta dedicada (`lib/export/`) escala melhor

---

## 🔒 11. Segurança e Proteção de Dados

### Status atual
- ✅ Visualizador NÃO acessa dados pessoais sensíveis
- ✅ Páginas sensíveis redirecionam visualizador → Dashboard
- ✅ Dados pessoais com criptografia em camadas
- ✅ APIs validam role no backend
- ✅ Dados mascarados no servidor antes de chegar ao cliente
- ✅ Fail-secure aplicado
- ✅ Audit Log completo (POST/PUT/DELETE)
- ✅ Política de Privacidade e Termos de Uso publicados
- ✅ Consentimento LGPD no cadastro de beneficiários
- ✅ Exportações respeitam máscara LGPD

### Próximas camadas
- 🔜 NDA para reuniões institucionais
- 🔜 Compliance LGPD formal documentado

---

## 📌 12. Onde Estamos AGORA

### 🎯 Cursor de Produção

**Última conclusão:** ✅ **Onda 16.2 — Marcos de Estoque (StockMarker)** (em produção)
**Fase atual:** 🌊 **Onda 16.5 — Indicadores de Aproveitamento**
**Status:** ⏳ PLANEJAMENTO — modelo mental travado, todas as decisões fechadas

### Próximo passo imediato (Onda 16.5)

1. 🛠️ Criar src/lib/stock/calculate-utilization.ts
2. 🛠️ Criar /api/indicadores/aproveitamento (período + 4 filtros)
3. 🛠️ Componentes de gráfico com toggle (recharts)
4. 🛠️ Estender FiltrosIndicadores.tsx (Doador/Instituição/Produtor/Funcionário)
5. 🛠️ Integrar export em tabela (src/lib/export/)
6. ✅ Validar com dados reais

### Nota de roadmap
- 🗑️ Onda 16.3 (Filtros Multi-Select) ABSORVIDA pela 16.5
- 🌊 Onda 16.4 (Cards All-Time) permanece pendente, sem alteração

### 📋 Pendências de input do Vitor

- 📋 **Lista de alimentos da Expo Del-Rei** (antes da Onda 17)
- 🧠 **Definir estrutura do "Refugo" da Expo** nos indicadores (Onda 17)
- 🎨 **Logo Annonae em PNG/SVG** (Onda 20 — Branding)
- 📝 **Conteúdo/prints da aba Tutorial** (Onda 18)

### 🐛 Pendências técnicas conhecidas

- ⚠️ **Bug `_count` em `/api/funcionarios`** (pode afetar confiabilidade de indicadores)
- ⚠️ **Dívida técnica:** unificar queries entre export e produção

---

## 💬 13. Estilo e Preferências do Vitor

- ✅ Respostas organizadas com emojis e headings claros
- ✅ Planejamento antes de código
- ✅ Divisão em pequenas ondas (incremental, testável)
- ✅ Explicações didáticas quando necessário
- ✅ Commits semânticos (feat, fix, chore, refactor, etc.)
- ✅ **Sempre código completo, não trechos**
- ✅ **Alinhamento de modelo mental antes de codar**
- ✅ Honestidade técnica — apontar riscos, não só elogiar
- 🌎 São João del-Rei / MG, Brasil
- 🗣️ Português (Brasil)
- 📚 Background: cultura grega clássica e latim

### O que NÃO fazer
- ❌ Não inventar features sem alinhar primeiro
- ❌ Não sugerir bibliotecas pesadas sem justificar
- ❌ Não pular o planejamento direto pro código
- ❌ Não dar respostas vagas — Vitor quer precisão
- ❌ Não esconder limitações

---

## 🏛️ 14. Sobre o Nome Annonae

**Annonae** é a forma genitiva/plural de ***Annona***, divindade romana responsável pelo abastecimento de grãos da capital do Império. A *Cura Annonae* (cuidado com o abastecimento) era uma das funções mais críticas do governo romano — garantir que ninguém passasse fome em Roma.

🎯 **Conexão direta com o projeto:** sistema que coordena o abastecimento alimentar de uma cidade, herdando o nome de uma das primeiras políticas públicas alimentares da história ocidental.

---

**Fim do backup oficial — atualizado em 02/06/2026**
**Próxima atualização:** ao concluir Onda 16.1