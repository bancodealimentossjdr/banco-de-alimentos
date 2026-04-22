# 📋 CHECKPOINT — Banco de Alimentos
**Última atualização:** 22/04/2026 (quarta-feira, ~12h30)
**Próxima sessão:** 22/04/2026 à noite (de casa) ou 23/04/2026

---

## 🎯 ONDE PARAMOS

**Problema 4 (Mascaramento LGPD) CONCLUÍDO ✅**

Acabamos de selar a proteção de dados sensíveis nas APIs: usuários
com role `visualizador` agora recebem dados mascarados (CPF, telefone,
endereço, etc.) em vez dos dados reais. Testado e funcionando.

---

## ✅ JÁ CONCLUÍDO

### Ondas anteriores
- [x] Onda 1 — Setup inicial (Next.js, Prisma, Auth)
- [x] Onda 2 — CRUDs principais
- [x] Onda 3 — Sistema de permissões (roles + canAccessRoute)
- [x] Onda 4.1 — Proteção de rotas via middleware
- [x] Onda 4.2 — Proteção de APIs (requireView / requireEdit)
- [x] Onda 4.3 — Proteção de UI por role (botões ocultos pra visualizador)

### Problema 4 — Mascaramento LGPD ✅
Helper `maskNotesListIfReadOnly` aplicado em:
- [x] `src/app/api/doadores/route.ts`
- [x] `src/app/api/beneficiarios/route.ts`
- [x] `src/app/api/doacoes/route.ts`
- [x] `src/app/api/distribuicoes/route.ts`
- [x] `src/app/api/colheita-solidaria/route.ts`

Helper central: `src/lib/mask-by-role.ts`

---

## ⏳ PRÓXIMOS PASSOS

### Checklist final da Onda 4.3 (à noite, de casa)
- [ ] Logar como usuário visualizador e testar todas as páginas
- [ ] Confirmar que dados sensíveis estão mascarados
- [ ] Confirmar que botões de ação estão ocultos
- [ ] Commit final da Onda 4.3 + Problema 4

### Onda 5 — Desconto de caixas 📦
(A definir detalhes ao iniciar)

---

## 🧩 PADRÃO DE MASCARAMENTO (referência rápida)

Em rotas de API que retornam dados sensíveis:

```ts
import { maskNotesListIfReadOnly } from '@/lib/mask-by-role'
const seguros = maskNotesListIfReadOnly(dados, role, 'doacoes')
### 🔄 Migração Next.js 16
- [x] `src/middleware.ts` → renomeado para `src/proxy.ts`
- [x] `export { auth as middleware }` → `export { auth as proxy }`
- [x] Proteção de rotas continua funcionando normalmente
