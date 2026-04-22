# 📋 CHECKPOINT — Banco de Alimentos
**Última atualização:** 21/04/2026 (terça-feira, ~21h)
**Próxima sessão:** 22/04/2026 (do trabalho)

---

## 🎯 ONDE PARAMOS

Estamos na **Onda 4.3 — Proteção de UI por Role**.
O backend (APIs) já valida permissões. Agora estamos ocultando
botões/ações na interface para quem é "visualizador".

---

## ✅ JÁ CONCLUÍDO

### Ondas anteriores (resumo)
- [x] Onda 1 — Setup inicial (Next.js, Prisma, Auth)
- [x] Onda 2 — CRUDs principais
- [x] Onda 3 — Sistema de permissões (roles + canAccessRoute)
- [x] Onda 4.1 — Proteção de rotas via middleware
- [x] Onda 4.2 — Proteção de APIs (requireView / requireEdit)

### Onda 4.3 — já feito
- [x] `src/app/doacoes/page.tsx` — botão "+ Nova Doação" oculto pra visualizador
- [x] `src/lib/auth.config.ts` — redirecionamento com query param `?acesso_negado=xxx`
- [x] `src/app/layout.tsx` — `<Toaster />` global + `<AccessDeniedToast />`
- [x] `src/components/AccessDeniedToast.tsx` — componente novo (toast de acesso negado)
- [x] Instalado: `react-hot-toast`

---

## ⏳ FALTA FAZER

### Páginas que precisam ocultar botões de ação pra visualizador

- [ ] `src/app/produtos/page.tsx`
      → + Novo Produto, Editar, Excluir
- [ ] `src/app/doadores/page.tsx`
      → + Novo Doador, Editar, Excluir
- [ ] `src/app/beneficiarios/page.tsx`
      → + Novo Beneficiário, Editar, Excluir
- [ ] `src/app/funcionarios/page.tsx`
      → + Novo Funcionário, Editar, Excluir
- [ ] `src/app/produtores/page.tsx`
      → + Novo Produtor, Editar, Excluir
- [ ] `src/app/distribuicoes/page.tsx`
      → + Nova Distribuição, Editar, Excluir
- [ ] `src/app/colheita-solidaria/page.tsx`
      → + Nova Colheita, Editar, Excluir
- [ ] `src/app/estoque/page.tsx`
      → Verificar se há ações de ajuste/movimentação
- [ ] REVISAR `src/app/doacoes/page.tsx`
      → Confirmar se Editar/Excluir também estão protegidos

### Estimativa
~5-10 min por página = **1h a 1h15** pra terminar a Onda 4.3

---

## 🧩 PADRÃO A SEGUIR (já validado em `doacoes/page.tsx`)

Em cada página:

1. Importar `useSession` do next-auth/react
2. Importar helper de permissão (`canEdit` do `@/lib/permissions`)
3. Obter a role do usuário da sessão
4. Envolver botões de ação com condicional:

   ```tsx
   {canEdit(userRole, 'nome-do-modulo') && (
     <button>...</button>
   )}
