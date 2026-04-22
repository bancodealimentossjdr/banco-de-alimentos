# 🍎 Banco de Alimentos SJDR — Backup de Contexto

> **📅 Data do backup:** 22/04/2026 (atualizado pós-Onda 4.3 Problema 4)
> **🎯 Propósito:** Documento de continuidade para retomar o desenvolvimento em uma nova conversa caso a atual apresente problemas.
> **👤 Desenvolvedor:** Vitor
> **🤖 Assistente:** Claude (Anthropic)
> **🌐 URL de produção:** https://banco-de-alimentos-green.vercel.app

---

## 🚀 Como usar este documento em uma nova conversa

Se você precisar iniciar uma nova conversa, **cole este arquivo inteiro** no primeiro prompt junto com uma mensagem do tipo:

> "Estou retomando o desenvolvimento do sistema Banco de Alimentos. Segue o backup do contexto da nossa conversa anterior. Por favor, leia tudo e me confirme onde paramos antes de continuarmos."

---

## 📖 1. Visão Geral do Projeto

**Nome:** Sistema de Gestão do Banco de Alimentos de São João del-Rei (SJDR)
**Tipo:** Aplicação web para gestão operacional de uma ONG
**Objetivo:** Controlar doações recebidas, distribuições a beneficiários, colheita solidária, estoque e cadastros relacionados.

### 🛠️ Stack Tecnológica

- **Framework:** Next.js 14+ (App Router)
- **Linguagem:** TypeScript
- **Banco de dados:** PostgreSQL (Supabase) — mesmo banco em dev e prod
- **ORM:** Prisma
- **Autenticação:** NextAuth v5 (Auth.js) com Credentials Provider + JWT
- **Hospedagem:** Vercel
- **Estilização:** Tailwind CSS
- **Hash de senha:** bcryptjs
- **Toasts:** react-hot-toast

---

## 👥 2. Sistema de Permissões (RBAC)

### Roles definidas

| Role | Descrição |
|------|-----------|
| 👑 **admin** | Acesso total; único que gerencia cadastros estruturais e usuários |
| 🧑‍💼 **operador** | Opera o dia-a-dia (doações, distribuições, colheitas); trava temporal no mesmo dia |
| 👀 **visualizador** | Somente leitura — vê dados mascarados (LGPD-friendly) |

### 📋 Matriz de Permissões

| Funcionalidade | 👑 Admin | 🧑‍💼 Operador | 👀 Visualizador |
|----------------|:-------:|:-----------:|:--------------:|
| Ver doações/distribuições/colheitas | ✅ | ✅ | ✅ (dados mascarados) |
| Criar/Editar/Excluir movimentações | ✅ | ✅ (só no mesmo dia) | ❌ |
| Ver cadastros (doadores, beneficiários, etc.) | ✅ | ✅ | ✅ (dados mascarados) |
| Criar/Editar/Excluir cadastros | ✅ | ❌ | ❌ |
| Gerenciar usuários | ✅ | ❌ | ❌ |

### 🔐 Princípios aplicados (Onda 4.3)

1. **Backend nunca confia no frontend** — toda API valida role via `requireView`/`requireEdit`.
2. **Dados sensíveis são mascarados no servidor** — visualizador recebe JSON já mascarado (não dá pra inspecionar Network).
3. **Botões de ação são ocultos** no frontend quando o role não tem permissão (UX).
4. **Operador tem trava temporal** — só edita/exclui movimentações criadas no mesmo dia.

---

## 🗺️ 3. Roadmap de Fases e Ondas

### ✅ Ondas concluídas

- **Onda 1 a 3** — Setup, CRUDs, sistema de permissões base
- **Onda 3A** — Calculadora de peso líquido (campo `boxes` em DonationItem)
- **Onda 4.0** — Role `visualizador` adicionada
- **Onda 4.1** — Página de Usuários (CRUD + soft delete)
- **Onda 4.2** — RBAC nas APIs (`requireView`/`requireEdit`)

### ✅ Onda 4.3 — Proteção de UI por Role (CONCLUÍDA 22/04/2026)

**Problemas resolvidos nesta onda:**

1. ✅ **Ocultação de botões** de ação para visualizador em todas as páginas
2. ✅ **Redirecionamento com toast** em caso de acesso negado (`?acesso_negado=xxx`)
3. ✅ **Trava temporal do operador** — só edita/exclui movimentações do mesmo dia (`canEditRecord`)
4. ✅ **Mascaramento de dados sensíveis no servidor (LGPD)** — visualizador recebe JSON já mascarado

**Arquivos criados/modificados no Problema 4 (mascaramento):**

- ✅ `src/lib/mask.ts` — funções genéricas (maskCPF, maskPhone, maskEmail, maskAddress, maskContactName)
- ✅ `src/lib/mask-by-role.ts` — helpers por entidade:
  - `shouldMaskPersonalData(role)` — true se role = visualizador
  - `isReadOnlyInModule(role, module)` — baseado em `canEdit`
  - `maskDoador` / `maskDoadorList`
  - `maskBeneficiario` / `maskBeneficiarioList`
  - `maskProdutor`
  - `maskNotesIfReadOnly` / `maskNotesListIfReadOnly`
- ✅ `src/app/api/doadores/route.ts` (GET) — mascaramento aplicado
- ✅ `src/app/api/beneficiarios/route.ts` (GET) — mascaramento aplicado
- ✅ `src/app/api/doacoes/route.ts` (GET) — notes mascaradas para readonly
- ✅ `src/app/api/distribuicoes/route.ts` (GET) — notes mascaradas para readonly
- ✅ `src/app/api/colheita-solidaria/route.ts` (GET) — notes + dados do produtor mascarados

**Status final do mascaramento:**

| Módulo | Status |
|--------|--------|
| Doadores (lista) | ✅ Mascarado |
| Beneficiários (lista) | ✅ Mascarado |
| Doações (GET) | ✅ Notes mascaradas |
| Distribuições (GET) | ✅ Notes mascaradas |
| Colheita-solidária (GET) | ✅ Notes + produtor mascarados |
| Estoque | ✅ Não tem dados pessoais |
| Usuários | ✅ Bloqueado fora do admin |
| Rotas [id] (PUT/DELETE) | ✅ Só admin/operador acessam |

### 🔜 Próximas ondas

- **Onda 4.4** — Testes finais com usuário de cada role
- **Onda 5** — Desconto automático de caixas na pesagem única (doações em caixa)
- **Ondas futuras** — Relatórios avançados, exportação (CSV/PDF)

---

## 📄 4. Arquivos-Chave do Projeto

### Estrutura principal

src/ ├── app/ │ ├── api/ │ │ ├── auth/[...nextauth]/ │ │ ├── doacoes/ ← GET mascara notes │ │ ├── distribuicoes/ ← GET mascara notes │ │ ├── colheita-solidaria/ ← GET mascara notes + produtor │ │ ├── produtos/ │ │ ├── doadores/ ← GET mascara dados pessoais │ │ ├── beneficiarios/ ← GET mascara dados pessoais │ │ ├── funcionarios/ │ │ ├── produtores/ │ │ └── usuarios/ ← só admin │ ├── [páginas dos módulos] │ └── login/ ├── lib/ │ ├── auth.ts │ ├── auth.config.ts │ ├── auth-helpers.ts ← requireView/requireEdit │ ├── permissions.ts ← canView/canEdit/canEditRecord │ ├── mask.ts ← funções genéricas (Onda 4.3) │ ├── mask-by-role.ts ← helpers por entidade (Onda 4.3) │ └── prisma.ts ├── components/ │ └── AccessDeniedToast.tsx ├── types/ │ └── next-auth.d.ts └── middleware.ts

### Matriz de permissões resumida (`src/lib/permissions.ts`)

- `visualizador` vê: dashboard, produtos, doadores, beneficiarios, doacoes, distribuicoes, colheita-solidaria, estoque
- `visualizador` edita: nada
- `operador` vê: tudo exceto usuarios
- `operador` edita: só doacoes, distribuicoes, colheita-solidaria (com trava temporal)
- `admin` vê e edita tudo

---

## 🎯 5. Decisões Importantes Tomadas

- ✅ **3 roles:** admin, operador, visualizador
- ✅ **Operador tem trava temporal** em movimentações (só edita/exclui no mesmo dia)
- ✅ **Cadastros são só-admin** (produtos, doadores, beneficiários, etc.)
- ✅ **Soft delete de usuários** (active: false)
- ✅ **Mascaramento no servidor** — visualizador nunca vê dados pessoais crus
- ✅ **Banco único** dev = prod (Supabase)
- ✅ **Defesa em profundidade** — middleware + API auth + máscara de dados

---

## 7. Próximos Passos Imediatos

### 🟢 AGORA — Testes finais da Onda 4.3 + Commit

1. Testar com usuário visualizador em produção:
   - Doadores → dados mascarados ✅
   - Beneficiários → dados mascarados ✅
   - Doações/Distribuições/Colheita → notes mascaradas ✅
   - Sem botões de ação em lugar nenhum ✅
2. Testar com admin e operador → tudo normal
3. Commit final da Onda 4.3

### 🔵 Depois — Onda 5: Desconto automático de caixas

- Ao cadastrar doação com campo `boxes`, calcular peso líquido automaticamente
- Ajustar UI da calculadora de peso

---

## 💬 8. Estilo e Preferências do Vitor

- ✅ Respostas organizadas com emojis e headings claros
- ✅ Planejamento antes de código
- ✅ Divisão em pequenas ondas (incremental, testável)
- ✅ Explicações didáticas quando necessário
- 🌎 Localização: São João del-Rei, MG, Brasil
- 🗣️ Idioma: Português (Brasil)

---

**Fim do backup — atualizado em 22/04/2026 (Onda 4.3 Problema 4 concluído)**
