# 🍎 Banco de Alimentos SJDR — Backup de Contexto

> **📅 Data do backup:** 25/04/2026 (atualizado pós-Onda 7 + roadmap final)
> **🎯 Propósito:** Documento de continuidade para retomar o desenvolvimento em uma nova conversa.
> **👤 Desenvolvedor:** Vitor
> **🤖 Assistente:** Claude (Anthropic)
> **🌐 URL de produção:** https://banco-de-alimentos-green.vercel.app

---

## 🚀 Como usar este documento em uma nova conversa

Cole este arquivo inteiro no primeiro prompt junto com:

> "Estou retomando o desenvolvimento do sistema Banco de Alimentos. Segue o backup do contexto da nossa conversa anterior. Por favor, leia tudo e me confirme onde paramos antes de continuarmos."

---

## 📖 1. Visão Geral do Projeto

**Nome:** Sistema de Gestão do Banco de Alimentos de São João del-Rei (SJDR)
**Tipo:** Aplicação web para gestão operacional de uma ONG
**Objetivo:** Controlar doações recebidas, distribuições a beneficiários, colheita solidária, estoque e cadastros relacionados.

### 🛠️ Stack Tecnológica

- **Framework:** Next.js 16 (App Router)
- **Linguagem:** TypeScript
- **Banco de dados:** PostgreSQL (Supabase) — dev = prod
- **ORM:** Prisma v6.19.3
- **Autenticação:** NextAuth v5 (Auth.js) com Credentials + JWT
- **Hospedagem:** Vercel
- **Estilização:** Tailwind CSS
- **Hash de senha:** bcryptjs
- **Toasts:** react-hot-toast

---

## 👥 2. Sistema de Permissões (RBAC)

### Roles definidas

| Role | Descrição |
|------|-----------|
| 👑 **admin** | Acesso total; gerencia cadastros estruturais e usuários |
| 🧑‍💼 **operador** | Dia-a-dia (doações, distribuições, colheitas); trava temporal no mesmo dia |
| 👀 **visualizador** | Somente leitura — vê dados mascarados (LGPD-friendly) |

### 📋 Matriz de Permissões

| Funcionalidade | 👑 Admin | 🧑‍💼 Operador | 👀 Visualizador |
|----------------|:-------:|:-----------:|:--------------:|
| Ver movimentações | ✅ | ✅ | ✅ (mascarado) |
| Criar/Editar/Excluir movimentações | ✅ | ✅ (só no mesmo dia) | ❌ |
| Ver cadastros | ✅ | ✅ | ✅ (mascarado) |
| Criar/Editar/Excluir cadastros | ✅ | ❌ | ❌ |
| Gerenciar usuários | ✅ | ❌ | ❌ |

### 🔐 Princípios aplicados

1. **Backend nunca confia no frontend** — toda API valida via `requireView`/`requireEdit`.
2. **Dados sensíveis são mascarados no servidor** — visualizador recebe JSON já mascarado.
3. **Botões de ação são ocultos** no frontend quando o role não tem permissão (UX).
4. **Operador tem trava temporal** — só edita/exclui movimentações do mesmo dia.

---

## 🗺️ 3. Roadmap de Ondas

### ✅ Ondas concluídas

- **Onda 1-3** — Setup, CRUDs, sistema de permissões base
- **Onda 3A** — Calculadora de peso líquido (campo `boxes` em DonationItem)
- **Onda 4.0** — Role visualizador adicionada
- **Onda 4.1** — Página de Usuários (CRUD + soft delete)
- **Onda 4.2** — RBAC nas APIs (`requireView`/`requireEdit`)
- **Onda 4.3** — Proteção de UI por role + Mascaramento LGPD no servidor
- **Onda 5** — Hotfix: restauração de handlers POST + rotação de credenciais Supabase
- **Onda 6** — Desconto automático de caixas (componente `<CalculadoraPeso />` reutilizável)
- **Onda 7** — Múltiplos funcionários (até 3) em doações, distribuições e colheitas

### 🔜 Próximas ondas (roadmap final)

#### 🗑️ Onda 8 — Aba Impróprios (PRÓXIMA)
- Nova página `/improprios`
- Cálculo: total recebido (doações) − total distribuído + colheita do dia
- Registro diário (automático ou manual — a definir)
- Permissões: admin/operador criam, visualizador vê
- **Dúvidas pendentes:** 
  - Cálculo por produto ou total geral do dia?
  - Considera colheita solidária no recebido?
  - Registro automático (cron) ou manual pelo operador?
  - Precisa de campo "motivo" (vencido, estragado, contaminado)?

#### 📊 Onda 9 — Aba Indicadores
- Dashboard com filtros (período, produto, doador, beneficiário)
- Gráficos (barras, linhas, pizza)
- Totais, médias, top 10
- Respeitar RBAC (visualizador vê mascarado)

#### 📱 Onda 10 — PWA (instalável no celular)
- `manifest.json` + ícones em vários tamanhos
- Service Worker básico
- Configurar Next.js pra PWA
- Testar instalação em Android + iPhone

#### 📤 Onda 11 — Exportação CSV/PDF
- Exportar doações, distribuições, estoque, indicadores

---

## 📄 4. Arquivos-Chave do Projeto

src/ ├── app/ │ ├── api/ │ │ ├── auth/[...nextauth]/ │ │ ├── doacoes/ ← GET mascara notes + suporta múltiplos funcionários │ │ ├── distribuicoes/ ← GET mascara notes + suporta múltiplos funcionários │ │ ├── colheita-solidaria/ ← GET mascara notes + produtor + múltiplos funcionários │ │ ├── produtos/ │ │ ├── doadores/ ← GET mascara dados pessoais │ │ ├── beneficiarios/ ← GET mascara dados pessoais │ │ ├── funcionarios/ ← _count via donationsAsEmployee1/2/3 etc (Onda 7) │ │ ├── produtores/ │ │ └── usuarios/ ← só admin │ ├── [páginas dos módulos] │ └── login/ ├── lib/ │ ├── auth.ts │ ├── auth.config.ts │ ├── auth-helpers.ts ← requireView/requireEdit │ ├── permissions.ts ← canView/canEdit/canEditRecord │ ├── mask.ts ← funções genéricas (Onda 4.3) │ ├── mask-by-role.ts ← helpers por entidade (Onda 4.3) │ └── prisma.ts ├── components/ │ ├── AccessDeniedToast.tsx │ └── CalculadoraPeso.tsx ← componente reutilizável (Onda 6) ├── types/ │ └── next-auth.d.ts └── proxy.ts ← antigo middleware.ts (Next.js 16)


### Schema Prisma — Resumo dos modelos principais

- **User** — id, email, password (hash), name, role (admin/operador/visualizador), active
- **Product** — produtos cadastrados
- **Donor** — doadores (PF/PJ)
- **Beneficiary** — beneficiários
- **Employee** — funcionários do banco (com 3 relações 1:N para cada tipo de movimentação)
- **Producer** — produtores rurais (colheita solidária)
- **Donation** — header da doação + `employeeId1/2/3` (Onda 7)
- **DonationItem** — itens (com campo `boxes` desde Onda 3A)
- **Distribution** — header + `employeeId1/2/3` (Onda 7)
- **DistributionItem** — itens (com campo `boxes` na Onda 6)
- **Harvest** — header + `producerId` + `employeeId1/2/3` (Onda 7)
- **HarvestItem** — itens (com campo `boxes` na Onda 6)

### Matriz de permissões resumida (`src/lib/permissions.ts`)

- **Visualizador** vê: dashboard, produtos, doadores, beneficiarios, doacoes, distribuicoes, colheita-solidaria, estoque
- **Visualizador** edita: nada
- **Operador** vê: tudo exceto usuarios
- **Operador** edita: só movimentações (com trava temporal)
- **Admin** vê e edita tudo

---

## 🎯 5. Decisões Importantes Tomadas

- ✅ **3 roles:** admin, operador, visualizador
- ✅ **Operador** tem trava temporal nas movimentações (mesmo dia)
- ✅ **Cadastros** são só-admin
- ✅ **Soft delete** de usuários (active: false)
- ✅ **Mascaramento no servidor** — visualizador nunca vê dados crus
- ✅ **Banco único** dev = prod (Supabase)
- ✅ **Defesa em profundidade** — proxy + API auth + máscara
- ✅ **Env centralizado** — apenas `.env.local` (Onda 5)
- ✅ **Next.js 16** — `middleware.ts` renomeado para `proxy.ts`
- ✅ **Calculadora de peso** unificada em `<CalculadoraPeso />` (Onda 6)
- ✅ **Múltiplos funcionários** via 3 FKs separadas (employeeId1/2/3) — não tabela pivô (Onda 7)
- ✅ **Apenas 1º funcionário obrigatório** nas movimentações (Onda 7)

---

## 🛠️ 6. Aprendizados Operacionais

### Onda 5 — Infra/Git
#### .env — Padrão Next.js
- Um único `.env.local` na raiz
- `.env*.local` já está no `.gitignore`

#### Prisma — Cuidados
- ⚠️ `prisma db pull` reescreve o schema (perde comentários)
- ✅ `prisma generate` é seguro
- 🛟 Recuperação: `git checkout prisma/schema.prisma`

#### Git — Fluxo
- Sempre `git pull` antes de começar
- `git pull --rebase origin main` pra sincronizar
- ❌ **NUNCA** `git push --force`
- 🕰️ `git show <hash>:<arquivo>` recupera versão antiga

#### Rotação de credenciais
- Supabase → atualizar local + Vercel simultaneamente
- Testar local antes de push/deploy

### Onda 7 — Schema + Cache TS
- ⚠️ Após mudar `schema.prisma`: rodar `npx prisma generate`
- 💡 Reiniciar TS Server no VS Code: `Ctrl+Shift+P → TypeScript: Restart TS Server`
- 🧹 Em último caso: deletar `node_modules/.prisma` + `node_modules/@prisma/client` e reinstalar
- 🔍 Atenção a campos antigos em `_count` — quebram o Prisma silenciosamente
- 🪟 `Developer: Reload Window` resolve cache persistente do VS Code

---

## 📌 7. Próximo Passo Imediato

### 🟢 AGORA — Iniciar Onda 8: Aba Impróprios

**Escopo a definir:**
- Nova página `/improprios`
- Cálculo do desperdício/sobra: doações − distribuições + colheita do dia
- Registro diário (automático via cron ou manual?)
- Permissões: admin/operador criam, visualizador vê

**Perguntas de planejamento:**
1. 🧮 Cálculo por produto individual ou total geral do dia?
2. 🌾 Colheita solidária entra no "recebido" ou é categoria separada?
3. 📅 Registro automático no fim do dia ou o operador insere manualmente?
4. 📝 Precisa de campo "motivo" (vencido, estragado, contaminado, outro)?
5. 🗓️ Permitir editar registros de dias anteriores? (ou só admin?)

---

## 💬 8. Estilo e Preferências do Vitor

- ✅ Respostas organizadas com emojis e headings claros
- ✅ Planejamento antes de código
- ✅ Divisão em pequenas ondas (incremental, testável)
- ✅ Explicações didáticas quando necessário
- ✅ Commits semânticos (feat, fix, chore, etc.)
- 🌎 Localização: São João del-Rei / Lagoa Dourada, MG, Brasil
- 🗣️ Idioma: Português (Brasil)

---

**Fim do backup — atualizado em 25/04/2026 (Onda 7 concluída)**