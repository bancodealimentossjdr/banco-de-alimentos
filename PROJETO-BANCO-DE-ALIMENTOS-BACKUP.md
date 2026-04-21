# 🍎 Banco de Alimentos SJDR — Backup de Contexto

> **📅 Data do backup:** 21/04/2026 (atualizado)
> **🎯 Propósito:** Documento de continuidade para retomar o desenvolvimento em uma nova conversa caso a atual apresente problemas.
> **👤 Desenvolvedor:** Vitor
> **🤖 Assistente:** Claude (Anthropic)
> **🌐 URL de produção:** https://banco-de-alimentos-green.vercel.app

---

## 🚀 Como usar este documento em uma nova conversa

Se você precisar iniciar uma nova conversa, **cole este arquivo inteiro** no primeiro prompt junto com uma mensagem do tipo:

> "Estou retomando o desenvolvimento do sistema Banco de Alimentos. Segue o backup do contexto da nossa conversa anterior. Por favor, leia tudo e me confirme onde paramos antes de continuarmos."

Isso vai garantir que o novo assistente tenha contexto completo.

---

## 📖 1. Visão Geral do Projeto

**Nome:** Sistema de Gestão do Banco de Alimentos de São João del-Rei (SJDR)
**Tipo:** Aplicação web para gestão operacional de uma ONG
**Objetivo:** Controlar doações recebidas, distribuições a beneficiários, colheita solidária, estoque e cadastros relacionados.

### 🛠️ Stack Tecnológica

- **Framework:** Next.js 14+ (App Router)
- **Linguagem:** TypeScript
- **Banco de dados:** PostgreSQL (Supabase) — **mesmo banco em dev e prod**
- **ORM:** Prisma
- **Autenticação:** NextAuth v5 (Auth.js) com Credentials Provider + JWT
- **Hospedagem:** Vercel
- **Estilização:** Tailwind CSS
- **Hash de senha:** bcryptjs

### 🗂️ Estrutura Principal do Projeto

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/
│   │   ├── doacoes/
│   │   ├── distribuicoes/
│   │   ├── colheita-solidaria/
│   │   ├── produtos/
│   │   ├── doadores/
│   │   ├── beneficiarios/
│   │   ├── funcionarios/
│   │   ├── produtores/
│   │   └── usuarios/          ← criado na Onda 4.1
│   ├── estoque/
│   ├── doacoes/
│   ├── distribuicoes/
│   ├── colheita-solidaria/
│   ├── produtos/
│   ├── doadores/
│   ├── beneficiarios/
│   ├── funcionarios/
│   ├── produtores/
│   ├── usuarios/              ← criado na Onda 4.1
│   └── login/
├── lib/
│   ├── auth.ts
│   ├── auth.config.ts
│   ├── permissions.ts
│   ├── api-auth.ts            ← helpers requireView/requireEdit (Onda 4.2)
│   ├── prisma.ts
│   └── constants.ts
├── types/
│   └── next-auth.d.ts
└── middleware.ts
```

---

## 👥 2. Sistema de Permissões (RBAC)

### Roles definidas

| Role | Descrição |
|------|-----------|
| 👑 **admin** | Acesso total; único que gerencia cadastros estruturais e usuários |
| 🧑‍💼 **operador** | Opera o dia-a-dia (doações, distribuições, colheitas) — pode criar/editar/excluir movimentações |
| 👀 **visualizador** | Somente leitura — vê tudo mas não edita nada |

### 📋 Matriz de Permissões

| Funcionalidade | 👑 Admin | 🧑‍💼 Operador | 👀 Visualizador |
|----------------|:-------:|:-----------:|:--------------:|
| Ver doações/distribuições/colheitas | ✅ | ✅ | ✅ |
| Criar doações/distribuições/colheitas | ✅ | ✅ | ❌ |
| Editar doações/distribuições/colheitas | ✅ | ✅ | ❌ |
| **Excluir** doações/distribuições/colheitas | ✅ | ✅ | ❌ |
| Ver cadastros (doadores, produtos, etc.) | ✅ | ✅ | ✅ |
| **Criar/Editar cadastros** | ✅ | ❌ | ❌ |
| Excluir cadastros | ✅ | ❌ | ❌ |
| Gerenciar usuários | ✅ | ❌ | ❌ |
| Ver relatórios | ✅ | ✅ | ✅ |

**Justificativa do Vitor:**
> "O operador precisa ter liberdade para excluir movimentações em caso de erro de registro, mas cadastros são estruturais e ficam só com admins."

---

## 🗺️ 3. Roadmap de Fases e Ondas

### ✅ FASE 1 — Infraestrutura (concluída)
- Setup do Next.js, Prisma, Supabase, NextAuth
- Schema inicial do banco

### ✅ FASE 2.1 — Autenticação (concluída)
- Login com email/senha (bcrypt)
- Proteção de rotas via middleware
- Campo `role` e `active` na tabela User
- `permissions.ts` com `canAccessRoute()`, `can()`, `isAdmin()`

### ✅ Ondas 1, 2 e 3 — Funcionalidades operacionais (concluídas)
Entregaram: doações, distribuições, colheita solidária, estoque, cadastros básicos (produtos, doadores, beneficiários, funcionários, produtores).

### ✅ Onda 3A — Calculadora de peso líquido (concluída)
- Campo `boxes` em `DonationItem` no schema
- Removido campo `weighed` de `HarvestItem`
- Criado `src/lib/constants.ts`
- Migration: `20260421134928_add_boxes_remove_weighed`
- **Commit:** `feat: calculadora de peso líquido nas doações + limpeza colheita`

### ✅ Onda 4.0 — Ajustes preparatórios (concluída)
- Adicionado `'visualizador'` no tipo `UserRole` em `src/types/next-auth.d.ts`
- Adicionado `'visualizador'` nas rotas de leitura em `permissions.ts`
- Schema do Prisma alinhado (admin | operador | visualizador)

### ✅ Onda 4.1 — Página de Usuários (concluída 100%)
- `src/app/usuarios/page.tsx` — listagem
- `src/app/usuarios/_components/UserFormModal.tsx` — criar/editar
- `src/app/usuarios/_components/PasswordModal.tsx` — troca de senha em rota separada
- `src/app/api/usuarios/route.ts` — GET/POST
- `src/app/api/usuarios/[id]/route.ts` — PATCH/DELETE (soft delete)
- `src/app/api/usuarios/[id]/password/route.ts` — troca de senha
- **Soft delete** implementado (active: false)
- **Usuário admin** já criado, protegido e funcionando em produção

### ✅ Onda 4.2 — RBAC nas APIs (concluída)
- Criado `src/lib/api-auth.ts` com helpers `requireView()` e `requireEdit()`
- **Todas as APIs** protegidas: doacoes, distribuicoes, colheita-solidaria, produtos, doadores, beneficiarios, funcionarios, produtores, usuarios
- Retorno padronizado 401/403 para não autorizados
- **Commit:** `feat(rbac): protege todas as APIs com requireView/requireEdit + otimizacao do estoque + remocao de notificacoes` (`34bd6ce`)

### 🧹 Melhorias incluídas na Onda 4.2
- **⚡ Otimização de performance no módulo de estoque** — queries refatoradas
- **🔕 Remoção do sistema de notificações** — não fazia sentido na fase atual, removido para manter o projeto enxuto

### 🔄 Onda 4.3 — RBAC no Frontend (PRÓXIMA — a iniciar agora)
- Esconder/desabilitar botões de ação (Criar, Editar, Excluir) baseado em `role`
- Usar hook de sessão (`useSession`) + helpers de `permissions.ts`
- Ajustar menus e navegação conforme role
- Mostrar badge do role no header/perfil

### 🔜 Onda 4.4 — Testes finais
- Testes manuais com usuário de cada role (admin, operador, visualizador)
- Ajustes finos conforme achados

### 🔜 Ondas futuras (pós-Onda 4)
- Relatórios avançados
- Exportação de dados
- (definir com o Vitor)

---

## 📄 4. Arquivos-Chave do Projeto (estado atual)

### 🔐 `src/lib/auth.ts`

```typescript
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { authConfig } from './auth.config'
import type { UserRole } from '@/types/next-auth'

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.active) return null

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isPasswordValid) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as UserRole,
        }
      },
    }),
  ],
})
```

### 🔐 `src/lib/auth.config.ts`

```typescript
import type { NextAuthConfig } from 'next-auth'
import { canAccessRoute } from './permissions'
import type { UserRole } from '@/types/next-auth'

export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.id = user.id as string
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as UserRole
        session.user.id = token.id as string
      }
      return session
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const userRole = auth?.user?.role as UserRole | undefined
      const { pathname } = nextUrl

      const publicRoutes = ['/login']
      const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))
      const isAuthApi = pathname.startsWith('/api/auth')

      if (isAuthApi) return true
      if (isLoggedIn && isPublicRoute) {
        return Response.redirect(new URL('/', nextUrl.origin))
      }
      if (!isLoggedIn && !isPublicRoute) return false
      if (isLoggedIn && !canAccessRoute(userRole, pathname)) {
        return Response.redirect(new URL('/', nextUrl.origin))
      }
      return true
    },
  },
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
}
```

### 🔐 `src/lib/permissions.ts`

```typescript
import type { UserRole } from '@/types/next-auth'

export const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  '/': ['admin', 'operador', 'visualizador'],
  '/estoque': ['admin', 'operador', 'visualizador'],
  '/doacoes': ['admin', 'operador', 'visualizador'],
  '/distribuicoes': ['admin', 'operador', 'visualizador'],
  '/colheita-solidaria': ['admin', 'operador', 'visualizador'],
  '/produtos': ['admin', 'operador', 'visualizador'],
  '/doadores': ['admin', 'operador', 'visualizador'],
  '/beneficiarios': ['admin', 'operador', 'visualizador'],
  '/funcionarios': ['admin', 'operador', 'visualizador'],
  '/produtores': ['admin', 'operador', 'visualizador'],
  '/usuarios': ['admin'],
}

export const WRITE_PERMISSIONS = {
  dashboard: ['admin', 'operador'],
  estoque: ['admin', 'operador'],
  doacoes: ['admin', 'operador'],
  distribuicoes: ['admin', 'operador'],
  'colheita-solidaria': ['admin', 'operador'],
  produtos: ['admin'],
  doadores: ['admin'],
  beneficiarios: ['admin'],
  funcionarios: ['admin'],
  produtores: ['admin'],
  usuarios: ['admin'],
} as const satisfies Record<string, UserRole[]>

export type WriteResource = keyof typeof WRITE_PERMISSIONS

export function canAccessRoute(role: UserRole | undefined, pathname: string): boolean {
  if (!role) return false
  const matchedRoute = Object.keys(ROUTE_PERMISSIONS)
    .filter((route) => pathname === route || pathname.startsWith(route + '/'))
    .sort((a, b) => b.length - a.length)[0]
  if (!matchedRoute) return true
  return ROUTE_PERMISSIONS[matchedRoute].includes(role)
}

export function can(role: UserRole | undefined, resource: WriteResource): boolean {
  if (!role) return false
  return (WRITE_PERMISSIONS[resource] as readonly UserRole[]).includes(role)
}

export function isAdmin(role: UserRole | undefined): boolean {
  return role === 'admin'
}
```

### 🔐 `src/lib/api-auth.ts` (criado na Onda 4.2)

Helpers usados em todas as rotas de API para proteger endpoints:
- `requireView(resource)` — garante que o usuário pode visualizar
- `requireEdit(resource)` — garante que o usuário pode editar/criar/excluir
- Retornam `401` (não autenticado) ou `403` (sem permissão) quando falham

### 🔐 `src/types/next-auth.d.ts`

```typescript
import { DefaultSession, DefaultUser } from 'next-auth'
import { JWT as DefaultJWT } from 'next-auth/jwt'

export type UserRole = 'admin' | 'operador' | 'visualizador'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: UserRole
    } & DefaultSession['user']
  }

  interface User extends DefaultUser {
    role: UserRole
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string
    role: UserRole
  }
}
```

### 🔐 `src/middleware.ts`

```typescript
import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'

const { auth } = NextAuth(authConfig)
export default auth

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
```

### 🗄️ Modelo `User` no Prisma

```prisma
model User {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  password  String
  role      String   @default("operador") // admin | operador | visualizador
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## 🎯 5. Decisões Importantes Tomadas

- ✅ **3 roles:** admin, operador, visualizador (Vitor manteve o visualizador para uso futuro — ex: diretoria/presidente).
- ✅ **Operador pode excluir movimentações** (doações/distribuições/colheitas) — para corrigir erros.
- ✅ **Cadastros são só-admin** (produtos, doadores, beneficiários, funcionários, produtores) — decisões estruturais.
- ✅ **Exclusão de usuário é soft delete** — muda `active` para `false`, mantém histórico.
- ✅ **Troca de senha em rota separada** — `/api/usuarios/[id]/password` — boa prática de segurança.
- ✅ **Banco único** — mesmo Supabase é usado em dev e em produção (Vercel).
- ✅ **Notificações removidas** — não faziam sentido na fase atual, foram descartadas para manter o código enxuto.
- ✅ **Proteção dupla de APIs** — middleware (rotas) + `requireView`/`requireEdit` (endpoints de API).

---

## ✅ 6. Status Atual (tudo verde)

| Item | Status |
|------|:------:|
| Deploy em produção funcionando | ✅ |
| Usuário admin criado e protegido | ✅ |
| Banco único (dev = prod) confirmado | ✅ |
| Tipo `UserRole` alinhado com schema do Prisma | ✅ |
| Todas as APIs protegidas com RBAC | ✅ |
| Página de usuários 100% funcional | ✅ |

---

## 7. Próximos Passos Imediatos (retomar aqui)

### 🟢 AGORA — Onda 4.3 (RBAC no Frontend)

1. Usar `useSession()` (client components) ou `auth()` (server components) para obter o `role` do usuário logado
2. Esconder/desabilitar botões **Criar / Editar / Excluir** conforme permissões
3. Ajustar menu lateral / navegação para ocultar `/usuarios` quando não for admin
4. Exibir badge do role no header/menu do usuário
5. Garantir que o visualizador só vê listagens e detalhes (sem ações)

**Arquivos principais a tocar:**
- Componentes de listagem em cada módulo (`page.tsx` de doacoes, distribuicoes, etc.)
- Menu/sidebar (se houver componente compartilhado)
- Header/perfil do usuário

### 🔵 Depois — Onda 4.4 (testes finais)
- Criar 1 usuário de cada role para validação
- Testar fluxos completos com cada um
- Ajustar inconsistências encontradas

### 🔵 Depois — Planejar Ondas futuras
- Relatórios avançados
- Exportação (CSV/PDF)
- (alinhar novas prioridades com o Vitor)

---

## 💬 8. Estilo e Preferências do Vitor

- ✅ Gosta de respostas organizadas com emojis e headings claros
- ✅ Prefere planejamento antes de código (confirma entendimento antes de escrever)
- ✅ Valoriza divisão em pequenas ondas (incremental, testável)
- ✅ Gosta de explicações didáticas quando não entende algo
- ✅ Responde de forma direta e objetiva às perguntas
- 🌎 Localização: São João del-Rei, MG, Brasil
- 🗣️ Idioma: Português (Brasil)

---

## 🔖 9. Glossário rápido

- **RBAC:** Role-Based Access Control (Controle de Acesso Baseado em Funções)
- **Soft delete:** Marcar como inativo em vez de apagar do banco
- **Onda:** Unidade de entrega de funcionalidades (divisão adotada no projeto)
- **FASE:** Grupo maior de Ondas relacionadas
- **requireView / requireEdit:** Helpers em `api-auth.ts` que protegem endpoints

---

## 📞 10. Como retomar caso esta conversa falhe

1. Abra uma nova conversa com o Claude
2. Cole este arquivo inteiro como primeiro prompt
3. Adicione: *"Retome o desenvolvimento a partir da seção 7 (Próximos Passos). Primeiro, me confirme que leu tudo e me pergunte o que precisar para continuarmos."*
4. O assistente deverá ter contexto completo para retomar de onde paramos.

---

**Fim do backup — atualizado em 21/04/2026 (pós-Onda 4.2, rumo à Onda 4.3)**