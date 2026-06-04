# 🎯 CHECKPOINT — Onda 16.5: Indicadores de Aproveitamento

> 📅 Aberto em: 04/06/2026
> 🔄 Última atualização: 04/06/2026 (backend concluído + cálculo validado com dados reais)
> 🎯 Status: EM EXECUÇÃO — Backend PRONTO ✅ | Cálculo VALIDADO ✅ | Frontend + Export PENDENTES
> 📌 Regra: documento-base ATIVO até a onda ser concluída.
>          Ao encerrar, migrar conteúdo para o PROJETO-GERAL e arquivar.
> 🔗 Continuidade direta das Ondas 16.1 (Estoque Dinâmico) e 16.2 (Marcos)
> 🧩 ABSORVE a antiga Onda 16.3 (Filtros Multi-Select)

---

## 📊 PROGRESSO DA ONDA

| Fatia | Entrega | Status |
|-------|---------|--------|
| 16.5.A | `calculate-utilization.ts` (lib de cálculo) | ✅ CONCLUÍDA |
| 16.5.A | `/api/indicadores/aproveitamento` (API) | ✅ CONCLUÍDA |
| 16.5.A | Validação do cálculo com dados reais (volumes/somas) | ✅ CONCLUÍDA |
| 16.5.B | Componentes de gráfico + toggle (recharts) | 🔲 PENDENTE |
| 16.5.C | Estender `FiltrosIndicadores.tsx` (4 multi-select) | 🔲 PENDENTE |
| 16.5.D | Export em tabela (`src/lib/export/`) | 🔲 PENDENTE |
| —      | Validação visual (frontend) com dados reais | 🔲 PENDENTE |

---

## 🧭 DECISÕES TRAVADAS (04/06/2026)

1. ✅ Numeração: **Onda 16.5** (16.4 permanece como Cards All-Time)
2. ✅ Onda 16.3 (Filtros Multi-Select) FOI ABSORVIDA por esta onda
3. ✅ Visualização: **GRÁFICOS** (recharts) na aba Indicadores existente
4. ✅ Aba /estoque NÃO recebe gráficos (permanece operacional)
5. ✅ Tipo de gráfico das taxas %: TOGGLE no app (pizza/gauge/barra)
6. ✅ Exportação (PDF/Excel): TABELA fixa (padrão Onda 15, sem gráfico)
7. ✅ Período: reusa FiltrosIndicadores.tsx (30d default + 7/15d + 6m + 1a)

### 🆕 Decisões emergidas na implementação do backend (04/06/2026)
8. ✅ **Taxas só na VISÃO GERAL.** Com QUALQUER filtro de entidade ativo
   (doador/produtor/instituição/funcionário), os indicadores percentuais,
   perda e estoque viram `null` → exibidos como hífen ("—") na tela.
   **Motivo:** `DailyApproval` é agregado (sem `donorId`/`productId`), então
   atribuir taxa a uma entidade específica seria um número falso. Honestidade
   de dado > número bonito.
9. ✅ **Volumes SEMPRE calculados** (doação/colheita/distribuição em kg),
   independente de filtro — esses sim podem ser atribuídos por entidade.
10. ✅ **Filtro de funcionário via OR nos 3 slots** (`employeeId/2/3Id`)
    em cada model de movimentação. NÃO depende do `_count` de /api/funcionarios.
11. ✅ **Estoque atual** reusa `calculateStock(to)` — só retorna valor se
    houver marco (`hasMarker`); senão `null`.

### ✅ Validação do cálculo concluída (04/06/2026)
12. ✅ **Cálculo de volumes auditado contra o banco e APROVADO.**
    - Investigação de suposta discrepância de "+562 kg" entre dois períodos.
    - **Conclusão:** NÃO havia bug. A diferença entre comparar
      `05/05 → 03/06` vs. `05/05 → 04/06` é exatamente o dia 04/06 (167 kg).
    - O valor "562 kg" correspondia à soma legítima do dia 03/06
      (346.1 + 81.2 + 71.3 + 63.5 = 562.1 kg) — coincidência de leitura.
    - **Confirmado:** sem contagem dupla, sem fantasma, sem bug de fuso.
      A fronteira de bucket (UTC−3) inclui corretamente cada dia no range.
    - `calculate-utilization.ts` soma corretamente DistributionItem por período.

---

## 🧠 MODELO MENTAL TRAVADO (04/06/2026)

### O Funil
  Doação bruta → 1ª Triagem → 2ª Triagem → [Registrar Aproveitamento] → ESTOQUE
  Colheita Solidária ──────────────────────────────────────────────→ ESTOQUE (100%)
                                                                        ↓
                                                                   DISTRIBUIÇÃO

### Fatos confirmados
1. Doação bruta É pesada (DonationItem.quantity confiável)
2. A PERDA não é pesada (volume grande) — calculada por diferença
3. Colheita = 100% aproveitada (só status="realizada")
4. Distribuição NÃO entra no numerador (é destino, não fonte → evita dupla contagem)
5. Dias sem DailyApproval = descarte total (decisão aceita)
6. DailyApproval NÃO tem productId → cálculo só AGREGADO em kg (não por produto)

---

## 🧮 FÓRMULAS OFICIAIS (✅ implementadas em calculate-utilization.ts)

### Indicador 1 — Taxa de Aproveitamento
  (Aproveitamento + Colheita) / (Doação bruta + Colheita) × 100
  → "De tudo que entrou, quanto foi salvo do lixo?"

### Indicador 2 — Taxa de Destinação
  Distribuído / (Aproveitamento + Colheita) × 100
  → "De tudo que aproveitei, quanto já saiu pro beneficiário?"

### Perda (derivada)
  Perda = max(0, Doação bruta − Aproveitamento)
  → Colheita NÃO gera perda (100% aproveitada); denominador é só a doação bruta.
  → Consistência: perda = entradas − aproveitadoTotal = doação − approved

### Arredondamento
  - Volumes e perda: round3 (3 casas, kg)
  - Percentuais: round1 (1 casa, %)

---

## 📐 CONTRATO DA API (referência para o frontend)

`GET /api/indicadores/aproveitamento`

### Auth
  requireView('estoque') — mesmo padrão de /api/indicadores/macro

### Query params
  - from         (obrigatório) — ISO date; normalizado p/ 00:00:00.000
  - to           (obrigatório) — ISO date; normalizado p/ 23:59:59.999
  - donorIds        (opcional) — CSV: "id1,id2,id3"
  - producerIds     (opcional) — CSV
  - beneficiaryIds  (opcional) — CSV
  - employeeIds     (opcional) — CSV (checa os 3 slots via OR)

### Resposta (UtilizationSnapshot)
  {
    period: { from, to },
    hasEntityFilter: boolean,          // true se algum filtro de entidade ativo
    volumes: {
      donationsKg, harvestKg, distributedKg   // SEMPRE preenchidos
    },
    utilization: {                     // null em TODOS quando hasEntityFilter=true
      approvedKg, utilizationPct, destinationPct, lossKg, currentStockKg
    },
    calculatedAt
  }

### Erros
  - 400: from/to ausentes, datas inválidas, ou from > to
  - 401/403: via requireView
  - 500: erro de cálculo (lib retorna snapshot vazio em falhas previsíveis)

### ⚠️ Nota de comportamento (validado 04/06/2026)
  - O `to` é normalizado para 23:59:59.999 e convertido p/ Brasília (UTC−3)
    na lógica de buckets. Cada dia do range é incluído integralmente.
  - Diferenças de soma entre dois períodos refletem APENAS os dias adicionais
    incluídos — não há vazamento de buckets vizinhos.

---

## 📊 VISUALIZAÇÃO NA ABA INDICADORES (escopo desta onda)

Tudo em GRÁFICOS (recharts) na aba Indicadores existente:
- [ ] Taxa de Aproveitamento (%) — com TOGGLE de tipo (pizza/gauge/barra)
- [ ] Taxa de Destinação (%) — com TOGGLE de tipo (pizza/gauge/barra)
- [ ] Tendência temporal de aproveitamento (linha — kg no período filtrado)
- [ ] Composição: Entrada (Doação + Colheita) vs. Aproveitado vs. Perda (barras)
- [ ] Total doado geral (card numérico de apoio)
- [ ] Total do estoque dinâmico (card numérico — calculateStock JÁ EXISTE)

### 🎚️ Toggle de tipo de gráfico (decisão 2)
- O usuário escolhe na TELA: pizza / gauge / barra
- Preferência pode ser por componente (não precisa ser global)
- Sugestão de default: gauge (visual claro de "quão bom estamos")

### ⚠️ Tratamento de hasEntityFilter no frontend (NOVO)
- Quando `hasEntityFilter = true`: ocultar/desabilitar os gráficos de TAXA
  (utilizationPct/destinationPct = null) e exibir aviso claro tipo:
  "📊 As taxas % só estão disponíveis na visão geral (sem filtro de entidade).
   Com filtros ativos, mostramos apenas os volumes."
- Volumes (doação/colheita/distribuição) continuam exibíveis sempre.

> ❌ A aba /estoque NÃO recebe gráficos. Permanece operacional (saldo físico).

---

## 🎛️ FILTROS NA ABA INDICADORES (absorvidos da antiga 16.3)

Multi-select independentes e combináveis:
- [x] 📅 PERÍODO — reusa FiltrosIndicadores.tsx (Onda 15.2.5)
      → JÁ aceito pela API via from/to
- [ ] 👤 Doador (multi-select)          → API pronta (donorIds)
- [ ] 🏢 Instituição beneficiária (multi-select) → API pronta (beneficiaryIds)
- [ ] 🌾 Produtor (multi-select)        → API pronta (producerIds)
- [ ] 👷 Funcionário (multi-select)     → API pronta (employeeIds)

> ✅ Backend dos 4 filtros JÁ está implementado. Falta só a UI (16.5.C).
> ✅ A antiga Onda 16.3 está 100% contida AQUI. Não existe mais como onda separada.

---

## 📤 EXPORTAÇÃO (decisão 2 — parte exportável)

- PDF / Excel saem em TABELA (não gráfico) — padrão consolidado na Onda 15
- Reusa pipeline src/lib/export/ (herda máscara LGPD automaticamente)
- Admin mantém opção de censura

---

## ✅ O QUE JÁ ESTÁ PRONTO (NÃO refazer)
- [x] Cálculo de estoque dinâmico (src/lib/stock/calculate-stock.ts)
- [x] Sistema de marcos (StockMarker + enum StockMarkerType)
- [x] APIs /api/stock-markers + /api/stock-markers/[id]
- [x] DailyApproval (registro de aproveitamento, unique por date)
- [x] Colheita com filtro status="realizada"
- [x] Script de diagnóstico: scripts/diagnostico-aproveitamento.ts
- [x] Cutoff de fim-de-dia (movimentação do dia do marco = embutida)
- [x] recharts já instalado e usado (Onda 12)
- [x] FiltrosIndicadores.tsx existente (30d + presets) — base para reuso
- [x] Pipeline de export PDF/Excel em tabela (Onda 15)
- [x] 🆕 Lib de cálculo: src/lib/stock/calculate-utilization.ts ✅
- [x] 🆕 API: /api/indicadores/aproveitamento (período + 4 filtros) ✅
- [x] 🆕 Cálculo de volumes VALIDADO contra o banco (04/06) ✅

---

## 🛠️ O QUE FALTA FAZER (escopo restante da onda 16.5)
- [ ] Resolver o gap da TENDÊNCIA TEMPORAL (decidir A/B/C — ver ponto de atenção) — 16.5.B
- [ ] Componentes de gráfico com TOGGLE de tipo (recharts) — 16.5.B
- [ ] Estender FiltrosIndicadores.tsx com Doador/Instituição/Produtor/Funcionário — 16.5.C
- [ ] Integrar export (tabela) ao pipeline src/lib/export/ — 16.5.D
- [ ] Respeitar RBAC (visualizador vê mascarado / sem dado sensível)
- [ ] Tratamento visual dos dias de descarte total (0% naquele dia)
- [ ] Tratamento visual do hasEntityFilter (esconder taxas, mostrar aviso)
- [ ] Validar visualmente o frontend com dados reais

---

## ❓ DECISÕES PENDENTES (antes do próximo código)
- A confirmar na execução: default do toggle (sugestão: gauge)
- A confirmar: a "Tendência temporal" precisa de série diária? A API atual
  retorna AGREGADO do período (não série dia-a-dia). Se quisermos a linha
  temporal, a API/lib precisará de um modo "série" ou um endpoint auxiliar.
  ⚠️ PONTO DE ATENÇÃO — ver seção abaixo.

---

## 🚧 PONTO DE ATENÇÃO TÉCNICO (descoberto no backend)
A API atual retorna UM snapshot agregado do período inteiro. Mas o escopo
visual pede "Tendência temporal de aproveitamento (linha)". Isso exige uma
SÉRIE diária (vários pontos no tempo), que o snapshot único NÃO entrega.

## 🐛 PONTO DE MELHORIA — Fronteira de Fim-de-Dia (Bug do card "Distribuído")

> 📅 Identificado: 04/06/2026 (após validação dos volumes)
> 🎯 Severidade: MÉDIA — subcontagem real de distribuições do próprio dia
> 🔗 Afeta: card "Distribuído" + potencialmente calculate-stock (marcos)

### Sintoma
Período `04/05 → 04/05` não exibia TODAS as distribuições do dia 04/05.
Distribuições lançadas no fim do expediente (≈21h–23h BRT) ficavam de fora.

### Causa-raiz
Normalização do `to` para 23:59:59.999 feita em UTC (não em Brasília UTC−3).
23:59:59 UTC = 20:59:59 BRT → cortava as 3 últimas horas do dia local.
Como distribuições são lançadas no fim do dia, eram as mais afetadas.

### Decisão (correção definitiva)
- ❌ NÃO usar gambiarra de "to = dia seguinte" (reintroduz contagem dupla).
- ✅ Criar src/lib/date/day-boundaries.ts com startOfDayBRT/endOfDayBRT.
- ✅ Fronteira ancorada em UTC−3 via sufixo ISO "-03:00".
- ✅ Aplicar a MESMA fronteira em doação, colheita E distribuição.
- ✅ Conversão automática no servidor — usuário NUNCA mexe no range manualmente.
- ✅ Auditar calculate-stock.ts + cutoff de marcos pelo mesmo bug latente.

### Aceite
- [ ] `04/05 → 04/05` mostra 100% das distribuições do dia 04/05.
- [ ] Distribuição às 22h BRT do dia X entra no dia X (não no X+1).
- [ ] Soma da futura série diária == snapshot agregado do período.
- [ ] Nenhum ajuste manual de range necessário.


Opções a decidir em 16.5.B:
  (A) Adicionar um modo "série" na lib/API (retorna array por dia)
  (B) Endpoint auxiliar dedicado /api/indicadores/aproveitamento/serie
  (C) Adiar o gráfico de tendência para um refinamento posterior

→ Resolver ANTES de codar os gráficos.

> 💡 Aprendizado da validação de 04/06: ao implementar o modo "série", garantir
>   que a fronteira de bucket (UTC−3) seja idêntica à do snapshot agregado,
>   para que a SOMA da série bata exatamente com o snapshot do período.

---

## 📜 HISTÓRICO DE DECISÕES DESTA ONDA
- 04/06/2026 — Modelo mental travado, fórmulas definidas
- 04/06/2026 — Confirmado: doação bruta É pesada
- 04/06/2026 — Dias sem aproveitamento = descarte total
- 04/06/2026 — Numeração: Onda 16.5
- 04/06/2026 — Visualização: GRÁFICOS na aba Indicadores (não /estoque)
- 04/06/2026 — Onda 16.3 ABSORVIDA pela 16.5 (4 filtros vêm pra cá)
- 04/06/2026 — Tipo de gráfico: TOGGLE no app; export em TABELA
- 04/06/2026 — Período reusa FiltrosIndicadores (30d + 7/15d + 6m + 1a)
- 04/06/2026 — Cálculo AGREGADO em kg (DailyApproval não tem productId)
- 04/06/2026 — 🆕 BACKEND CONCLUÍDO: lib calculate-utilization + API
- 04/06/2026 — 🆕 Decisão: taxas viram null com filtro de entidade ativo
- 04/06/2026 — 🆕 Filtro de funcionário via OR nos 3 slots (não usa _count)
- 04/06/2026 — 🆕 Identificado gap: tendência temporal exige série diária
- 04/06/2026 — ✅ Cálculo de volumes VALIDADO contra o banco (suposto "+562 kg"
                era a soma legítima do dia 03/06; diferença real entre períodos
                = 167 kg do dia 04/06). SEM bug, SEM contagem dupla, SEM fuso.

---

# Checkpoint — 04/06/2026

## ✅ Validações concluídas
- Volumes de 03/06 corretos: 346.1 + 81.2 + 71.3 + 63.5 = 562,1 kg
- Sem vazamento de dados nem bug de fuso na soma agregada
- +167 kg em 04/06 = único registro de distribuicao legitimo do dia
- Falso alarme "+562 kg": era comparacao de janelas temporais diferentes
  (05/05→03/06 vs 05/05→04/06), nao um bug

## 🐛 Bug REAL identificado (pendente de correcao)
- Card "Distribuido" subconta distribuicoes do proprio dia
- Causa: normalizacao do 'to' para 23:59:59.999 feita em UTC, nao em BRT
  → 23:59 UTC = 20:59 BRT → corta as 3 ultimas horas do dia local
- Distribuicoes lancadas no fim do expediente (~21h-23h) caiam fora

## 🔧 Correcao decidida (NAO implementada ainda)
- Criar src/lib/date/day-boundaries.ts (startOfDayBRT / endOfDayBRT)
- Ancorar fronteira em UTC-03:00 via sufixo ISO
- NAO usar gambiarra "to = dia seguinte" (reintroduz contagem dupla)
- Aplicar mesma fronteira a doacao, colheita E distribuicao
- Auditar calculate-stock.ts pelo mesmo bug latente
- Conversao automatica no servidor — sem ajuste manual de range

## ⏭️ Proximos passos (ao retornar)
1. Hotfix 16.5.0 — implementar day-boundaries.ts + corrigir API
2. Decidir toggle gauge vs tendencia (default sugerido: gauge)
3. Modo serie diaria (Opcao A) antes do grafico de tendencia


## 🔧 CORREÇÃO PENDENTE NO PROJETO-GERAL (ao encerrar a onda)
A Seção 12 ("Onde Estamos AGORA") será atualizada para:
  "Última conclusão: Onda 16.5 (Indicadores de Aproveitamento)
   Fase atual: Onda 16.4 (Cards All-Time) ou a definir"