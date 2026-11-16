# 🧯 Runbook do Annonae

📅 16/11/2026 · Para a equipe da ONG e para o responsável técnico.
Regra de ouro: **nada se resolve apagando registro.** Na dúvida, pare e chame o responsável técnico.

## 📞 Contatos
| Papel | Nome | Telefone/WhatsApp |
|---|---|---|
| Responsável técnico (dev) | Vitor | _preencher_ |
| Coordenação da ONG | _preencher_ | _preencher_ |
| Substituto técnico | _preencher_ | _preencher_ |

---

## 1. O app não abre ou dá erro
1. Teste em outra rede (dados móveis × Wi-Fi) e em aba anônima.
2. Se a tela de login abrir, mas o restante falhar, anote **hora, tela e mensagem** (print).
3. Avise o responsável técnico.
4. **Enquanto isso, registre no papel** (doações, distribuições, entregas PAA com assinatura em papel). Lance no app quando voltar, com a data real.

> Técnico: confira o status da Vercel e do Supabase. Erro de conexão intermitente (P1001) costuma passar em minutos.

## 2. "Muitas tentativas" ou login recusado
- Depois de 5 tentativas erradas, o e-mail fica bloqueado por **15 minutos**. Espere e tente de novo.
- Esqueceu a senha: peça ao admin.
- Entrou, mas "não vê nada": a conta está como visualizador. Peça a role certa ao admin.

## 3. Entrega PAA assinada com erro
Uma entrega assinada fica travada e não se edita.
1. Admin/dev: abra a entrega em **/paa → Retirar assinatura** e informe o **motivo**.
2. A entrega volta para RASCUNHO. Corrija e **colha a assinatura do produtor de novo**.
3. Se a entrega estava num Termo, ela sai do Termo e os totais são recalculados. Siga a seção 5.

## 4. Entrega vinculada ao Termo errado
1. Admin/dev: **/paa → Termos →** abra o Termo **→ Retirar entrega**.
2. A entrega volta para ASSINADA e pode entrar em outro Termo.
3. Um Termo vazio continua existindo, e o número **nunca é reutilizado**.

## 5. Reemitir um Termo (depois das seções 3 ou 4)
1. Confira no Annonae se o Termo ficou com as entregas e os totais certos.
2. Corrija ou gere o Termo no **SISPAA** (o registro oficial é o SISPAA).
3. Se o SISPAA gerou um número novo, crie um Termo novo no Annonae com esse número e com as entregas.
4. Imprima de novo: **Termos → Imprimir SISPAA / Annonae → Salvar como PDF**.
5. Anote o ocorrido na observação interna do Termo.

## 6. PDF do Termo não sai
- Termo vazio ou com aviso não imprime: corrija antes.
- Na janela de impressão: destino **"Salvar como PDF"**, margens "Padrão", "Gráficos de fundo" ligado.
- Nome de produto diferente do SISPAA: corrija o nome no cadastro de Produtos.

## 7. Dado apagado ou errado em massa (somente o técnico)
1. **Não tente consertar pelo app.** Pare os lançamentos e anote a hora.
2. Backups: diário do Supabase Pro (7 dias) + `pg_dump` guardado fora do projeto.
3. Restore testado em 14/11/2026 (8,8 s, 38/38 tabelas). Restaure primeiro num banco separado, confira e só depois decida.
4. Registre o incidente em `docs/incidentes/`.

## 8. Regras do técnico (resumo)
- Produção só por `migrate deploy`/`status`/`diff`/`pg_dump`, com a trava do script B.
- Nunca `migrate dev`, `db push`, `reset` ou SQL manual na produção.
- Nunca migrar com evento em andamento.
- O banco de dev pausa após 7 dias sem uso: reative pelo painel do Supabase.
