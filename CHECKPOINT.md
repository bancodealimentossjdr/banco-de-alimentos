# 📋 CHECKPOINT — Banco de Alimentos
**Última atualização:** 24/04/2026 (sexta-feira, ~12h45)
**Próxima sessão:** Início da Onda 6

---

## 🎯 ONDE PARAMOS

**Onda 5 CONCLUÍDA ✅ — Deploy em produção validado**

Hotfix: endpoints POST de doações e distribuições estavam retornando 
405 (Method Not Allowed). Handlers restaurados via Git, credenciais 
do Supabase rotacionadas, infra local organizada. Tudo testado em 
local e produção.

**Próximo passo:** Iniciar **Onda 6 — Desconto automático de caixas**.

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

### Commits relevantes
- `311281a` — fix(api): restaura handlers POST de doacoes e distribuicoes (Onda 5)

---

## 🗺️ ROADMAP — PRÓXIMAS ONDAS

### 📦 Onda 6 — Desconto automático de caixas (PRÓXIMA)
Unifica item 2 da lista original + Onda 5 planejada.
- [ ] Cadastro de doações → desconto automático quando `boxes > 0`
- [ ] Cadastro de distribuições → mesma calculadora
- [ ] Cadastro de colheita solidária → mesma calculadora
- [ ] Suporte a pesagem única (peso bruto total menos caixas)
- [ ] UI reutilizável (componente único `<CalculadoraPeso />`)

### 👥 Onda 7 — Múltiplos funcionários na coleta
- [ ] Ajustar schema Prisma: Donation → de 1 para até 3 funcionários
- [ ] Migration no banco
- [ ] Ajustar UI do cadastro/edição
- [ ] Ajustar exibição nos detalhes
- [ ] Retrocompatibilidade com doações antigas
- ❓ **Dúvida pendente:** 3 obrigatórios ou apenas 1º obrigatório?

### 🗑️ Onda 8 — Aba Impróprios
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

## 🧩 APRENDIZADOS OPERACIONAIS DA ONDA 5

### .env — Padrão Next.js
- Usar **um único** `.env.local` na raiz
- `.env*.local` já está no `.gitignore`
- Evitar múltiplos `.env`, `.env.teste`, etc.

### Prisma — Cuidados
- ⚠️ `prisma db pull` **reescreve** o schema (perde comentários/ordem)
- ✅ `prisma generate` é seguro (só regenera o client)
- 🛟 Recuperação: `git checkout prisma/schema.prisma`

### Git — Fluxo seguro
- Sempre `git pull` antes de começar
- `git pull --rebase origin main` pra sincronizar sem merge commit
- ❌ **NUNCA** `git push --force`
- 🕰️ `git show <hash>:<arquivo>` recupera versão antiga

### Rotação de credenciais
- Trocar senha Supabase → atualizar **local + Vercel**
- Testar local antes de push/deploy

---

## 🔄 Migração Next.js 16 (preservado)
- [x] `src/middleware.ts` → renomeado para `src/proxy.ts`
- [x] `export { auth as middleware }` → `export { auth as proxy }`
- [x] Proteção de rotas continua funcionando normalmente
