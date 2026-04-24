# 🍎 Banco de Alimentos SJDR — Backup de Contexto

> **📅 Data do backup:** 24/04/2026 (atualizado pós-Onda 5 + roadmap definido)
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

### 🔜 Próximas ondas (roadmap detalhado)

#### 📦 Onda 6 — Desconto automático de caixas (PRÓXIMA)
- Cadastro de doações → desconto automático quando `boxes > 0`
- Cadastro de distribuições → mesma calculadora
- Cadastro de colheita solidária → mesma calculadora
- Suporte a pesagem única (peso bruto total menos caixas)
- UI reutilizável (componente único `<CalculadoraPeso />`)

#### 👥 Onda 7 — Múltiplos funcionários na coleta
- Ajustar schema Prisma: Donation → de 1 para até 3 funcionários
- Migration no banco
- Ajustar UI de cadastro/edição/detalhes
- Retrocompatibilidade com doações antigas
- **Dúvida pendente:** 3 obrigatórios ou apenas 1º obrigatório?

#### 🗑️ Onda 8 — Aba Impróprios
- Nova página `/improprios`
- Cálculo: total recebido (doações) − total distribuído + colheita do dia
- Registro diário (automático ou manual — a definir)
- Permissões: admin/operador criam, visualizador vê
- **Dúvidas pendentes:** cálculo por produto ou total geral? considera colheita no recebido?

#### 📊 Onda 9 — Aba Indicadores
- Dashboard com filtros (período, produto, doador, beneficiário)
- Gráficos (barras, linhas, pizza)
- Totais, médias, top 10
- Respeitar RBAC (visualizador vê mascarado)

#### 📱 Onda 10 — PWA (instalável no celular)
- `manifest.json` + ícones em vários tamanhos
- Service Worker básico
- Testar instalação em Android + iPhone

#### 📤 Onda 11 — Exportação CSV/PDF
- Exportar doações, distribuições, estoque, indicadores

---

## 📄 4. Arquivos-Chave do Projeto

src/ ├── app/ │ ├── api/ │ │ ├── auth/[...nextauth]/ │ │ ├── doacoes/ ← GET mascara notes + POST restaurado (Onda 5) │ │ ├── distribuicoes/ ← GET mascara notes + POST restaurado (Onda 5) │ │ ├── colheita-solidaria/ ← GET mascara notes + produtor │ │ ├── produtos/ │ │ ├── doadores/ ← GET mascara dados pessoais │ │ ├── beneficiarios/ ← GET mascara dados pessoais │ │ ├── funcionarios/ │ │ ├── produtores/ │ │ └── usuarios/ ← só admin │ ├── [páginas dos módulos] │ └── login/ ├── lib/ │ ├── auth.ts │ ├── auth.config.ts │ ├── auth-helpers.ts ← requireView/requireEdit │ ├── permissions.ts ← canView/canEdit/canEditRecord │ ├── mask.ts ← funções genéricas (Onda 4.3) │ ├── mask-by-role.ts ← helpers por entidade (Onda 4.3) │ └── prisma.ts ├── components/ │ └── AccessDeniedToast.tsx ├── types/ │ └── next-auth.d.ts └── proxy.ts ← antigo middleware.ts (Next.js 16)

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

---

## 🛠️ 6. Aprendizados Operacionais (Onda 5)

### .env — Padrão Next.js
- Um único `.env.local` na raiz
- `.env*.local` já está no `.gitignore`

### Prisma — Cuidados
- ⚠️ `prisma db pull` reescreve o schema (perde comentários)
- ✅ `prisma generate` é seguro
- 🛟 Recuperação: `git checkout prisma/schema.prisma`

### Git — Fluxo
- Sempre `git pull` antes de começar
- `git pull --rebase origin main` pra sincronizar
- ❌ **NUNCA** `git push --force`
- 🕰️ `git show <hash>:<arquivo>` recupera versão antiga

### Rotação de credenciais
- Supabase → atualizar local + Vercel simultaneamente
- Testar local antes de push/deploy

---

## 📌 7. Próximo Passo Imediato

### 🟢 AGORA — Iniciar Onda 6: Desconto automático de caixas

**Escopo definido:**
- Componente único `<CalculadoraPeso />` reutilizável
- Aplicar em: doações, distribuições, colheita solidária
- Suporte a pesagem única (peso bruto − caixas)

**Perguntas de planejamento a responder ao iniciar:**
1. Já existe o campo `boxes` no `DonationItem` (Onda 3A). Precisa adicionar em `DistributionItem` e `HarvestItem`?
2. Peso da caixa é fixo (ex: 400g) ou configurável por produto?
3. Quer armazenar peso bruto + peso líquido no banco, ou só o líquido?

---

## 💬 8. Estilo e Preferências do Vitor

- ✅ Respostas organizadas com emojis e headings claros
- ✅ Planejamento antes de código
- ✅ Divisão em pequenas ondas (incremental, testável)
- ✅ Explicações didáticas quando necessário
- 🌎 Localização: São João del-Rei / Lagoa Dourada, MG, Brasil
- 🗣️ Idioma: Português (Brasil)

---

**Fim do backup — atualizado em 24/04/2026 (Onda 5 concluída, Onda 6 definida)**
