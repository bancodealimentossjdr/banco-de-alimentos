# 📋 CHECKPOINT — Banco de Alimentos
**Última atualização:** 25/04/2026 (sábado)
**Próxima sessão:** Início da Onda 8

---

## 🎯 ONDE PARAMOS

**Onda 7 CONCLUÍDA ✅ — Múltiplos funcionários implementados**

Schema Prisma ajustado para suportar até 3 funcionários por 
movimentação (doação, distribuição e colheita). APIs, UI e 
relações atualizadas. Bug do `_count.distributions` corrigido 
em `/api/funcionarios/route.ts`. Tudo testado e funcionando 
em produção.

**Próximo passo:** Iniciar **Onda 8 — Aba Impróprios**.

---

## ✅ JÁ CONCLUÍDO

### Ondas anteriores
- [x] Onda 1 — Setup inicial (Next.js, Prisma, Auth)
- [x] Onda 2 — CRUDs principais
- [x] Onda 3 — Sistema de permissões (roles + canAccessRoute)
- [x] Onda 3A — Calculadora de peso líquido (campo `boxes`)
- [x] Onda 4.0 — Role visualizador adicionada
- [x] Onda 4.1 — Página de Usuários (CRUD + soft delete)
- [x] Onda 4.2 — Proteção de APIs (requireView / requireEdit)
- [x] Onda 4.3 — Proteção de UI por role + Mascaramento LGPD
- [x] Onda 5 — Restauração de handlers POST + rotação de credenciais
- [x] Onda 6 — Desconto automático de caixas (CalculadoraPeso)
- [x] Onda 7 — Múltiplos funcionários (até 3) em movimentações

### Commits relevantes
- `311281a` — fix(api): restaura handlers POST (Onda 5)
- `<novo>`  — feat(onda-7): múltiplos funcionários

---

## 🗺️ ROADMAP — PRÓXIMAS ONDAS

### 🗑️ Onda 8 — Aba Impróprios (PRÓXIMA)
- [ ] Nova página `/improprios`
- [ ] Cálculo: total recebido (doações) − total distribuído + colheita do dia
- [ ] Registro diário (automático ou manual?)
- [ ] Permissões (admin/operador criam, visualizador vê)
- ❓ **Dúvidas pendentes:** 
  - Cálculo por produto ou total geral do dia?
  - Considera colheita solidária no recebido?

### 📊 Onda 9 — Aba Indicadores
- [ ] Dashboard com filtros:
  - 📅 Por data (período: de/até)
  - 📦 Por produto
  - 🎁 Por doador
  - 🏛️ Por beneficiário
- [ ] Gráficos (barras, linhas, pizza)
- [ ] Totais, médias, top 10
- [ ] Respeitar RBAC (visualizador vê mascarado)

### 📱 Onda 10 — PWA (instalável no celular)
- [ ] Criar `manifest.json`
- [ ] Ícones em vários tamanhos
- [ ] Service Worker básico
- [ ] Configurar Next.js pra PWA
- [ ] Testar instalação em Android + iPhone

### 📤 Onda 11 — Exportação CSV/PDF
- [ ] Exportar doações
- [ ] Exportar distribuições
- [ ] Exportar estoque
- [ ] Exportar indicadores

---

## 🧩 APRENDIZADOS OPERACIONAIS

### Onda 5 — Infra
- Usar **um único** `.env.local` na raiz
- `prisma db pull` reescreve o schema (cuidado!)
- `prisma generate` é seguro
- ❌ **NUNCA** `git push --force`

### Onda 7 — Prisma + TS
- ⚠️ Após mudar schema: rodar `npx prisma generate`
- 💡 Reiniciar TS Server no VS Code (`Ctrl+Shift+P → Restart TS Server`)
- 🧹 Em último caso: limpar `node_modules/.prisma` e reinstalar
- 🔍 Atenção a `_count` em rotas — campos antigos quebram o Prisma

---

## 🔄 Migração Next.js 16 (preservado)
- [x] `src/middleware.ts` → `src/proxy.ts`
- [x] `export { auth as middleware }` → `export { auth as proxy }`
- [x] Proteção de rotas funcionando