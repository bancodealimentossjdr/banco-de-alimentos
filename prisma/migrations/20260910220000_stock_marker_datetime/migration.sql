-- ⏱️ ONDA 23.6a-bis — StockMarker.date: @db.Date → DateTime
--
-- PROBLEMA
-- Como @db.Date, o marco valia meia-noite UTC do dia D, que em Brasília
-- (UTC-3) é o dia D-1 às 21h. Toda movimentação do próprio dia da
-- calibragem caía DEPOIS do marco e era somada de novo. Calibrar zero
-- produzia saldo negativo (-171,3 kg no caso real).
--
-- SOLUÇÃO
-- O marco passa a ser um INSTANTE. O ledger filtra createdAt > marco.
--
-- BACKFILL
-- Marcos existentes viram o FIM do dia civil BRT (23:59:59.999 BRT =
-- 02:59:59.999 UTC do dia seguinte), para que os createdAt posteriores
-- continuem contando e os anteriores fiquem absorvidos no peso do marco.
ALTER TABLE "stock_markers"
  ALTER COLUMN "date" TYPE TIMESTAMP(3)
  USING ("date"::timestamp + interval '1 day 2 hours 59 minutes 59.999 seconds');

-- 🔓 Unicidade por dia civil passa a ser validada na API (upsert por
--    range do dia). Com hora na coluna, o índice único global impediria
--    duas calibragens no mesmo dia de convergirem para a mesma linha.
DROP INDEX IF EXISTS "stock_markers_date_key";

-- 📈 Índice de leitura: o ledger sempre busca o marco mais recente
--    (ORDER BY date DESC LIMIT 1).
CREATE INDEX IF NOT EXISTS "stock_markers_date_idx" ON "stock_markers"("date");
