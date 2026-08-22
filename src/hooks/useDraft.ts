'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * 🧹 ONDA 22 (22-h) — correção do "rascunho fantasma".
 *
 * Três bugs corrigidos:
 *
 * 1. clearDraft() não cancelava o debounce pendente. O fluxo real era:
 *    usuário salva → clearDraft() limpa o localStorage → 250ms depois o
 *    timer de 500ms dispara e REGRAVA o rascunho já consumido.
 *    → agora clearDraft/discardDraft cancelam timers e armam um bloqueio.
 *
 * 2. `if (hasDraft && !hasRestoredRef) return` desligava o auto-save para
 *    sempre quando o usuário ignorava o banner e digitava direto.
 *    → agora a primeira digitação assume a decisão implícita de "descartar"
 *      e o auto-save volta a funcionar.
 *
 * 3. Após clearDraft, o form voltando a vazio gravava um rascunho vazio.
 *    → bloqueio de uma rodada (`skipNextSaveRef`) resolve.
 */

const DRAFT_PREFIX = 'annonae-draft-'
/** 🕰️ prefixo legado (pré-branding) — lido e migrado, nunca escrito */
const DRAFT_PREFIX_LEGADO = 'bdsjdr-draft-'

const DRAFT_TTL_MS = 12 * 60 * 60 * 1000 // 12 horas
const DEBOUNCE_MS = 500
const SAVED_INDICATOR_MS = 2000

type Timer = ReturnType<typeof setTimeout>

interface DraftWrapper<T> {
  data: T
  savedAt: number
}

interface UseDraftOptions<T> {
  /** Chave única do rascunho. Ex: 'doacao-nova' */
  key: string
  /** Estado atual do formulário (pra salvar) */
  state: T
  /** Função que aplica os dados do rascunho ao formulário */
  onRestore: (data: T) => void
  /** Se true, não salva (ex: durante edição de registro existente) */
  disabled?: boolean
}

interface UseDraftReturn {
  /** True se acabou de salvar (mostra "💾 Salvo" por 2s) */
  showSavedIndicator: boolean
  /** True se existe rascunho válido pra recuperar */
  hasDraft: boolean
  /** Timestamp do rascunho encontrado (pra mostrar "há 5 min") */
  draftSavedAt: number | null
  /** Recupera o rascunho e aplica no form */
  restoreDraft: () => void
  /** Descarta o rascunho */
  discardDraft: () => void
  /** Limpa o rascunho (chamar após salvar com sucesso) */
  clearDraft: () => void
}

/** Valida a forma do wrapper — localStorage é território hostil */
function ehWrapperValido<T>(v: unknown): v is DraftWrapper<T> {
  return (
    typeof v === 'object' &&
    v !== null &&
    'data' in v &&
    'savedAt' in v &&
    typeof (v as { savedAt: unknown }).savedAt === 'number'
  )
}

export function useDraft<T>({
  key,
  state,
  onRestore,
  disabled = false,
}: UseDraftOptions<T>): UseDraftReturn {
  const fullKey = `${DRAFT_PREFIX}${key}`
  const legacyKey = `${DRAFT_PREFIX_LEGADO}${key}`

  const [showSavedIndicator, setShowSavedIndicator] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null)

  const debounceRef = useRef<Timer | null>(null)
  const indicatorRef = useRef<Timer | null>(null)
  const isFirstRunRef = useRef(true)

  /**
   * 🔒 Bloqueia a PRÓXIMA gravação. Armado por clearDraft/discardDraft
   * para que o reset do formulário não gere um rascunho vazio.
   */
  const skipNextSaveRef = useRef(false)

  /** Cancela qualquer gravação já agendada — o coração da correção do fantasma */
  const cancelarSalvamentoPendente = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }, [])

  const escrever = useCallback(
    (dados: T) => {
      try {
        const wrapper: DraftWrapper<T> = { data: dados, savedAt: Date.now() }
        localStorage.setItem(fullKey, JSON.stringify(wrapper))

        setShowSavedIndicator(true)
        if (indicatorRef.current) clearTimeout(indicatorRef.current)
        indicatorRef.current = setTimeout(() => {
          setShowSavedIndicator(false)
        }, SAVED_INDICATOR_MS)
      } catch (err) {
        // localStorage cheio ou modo privado — não pode derrubar o formulário
        console.error('[useDraft] falha ao salvar rascunho:', err)
      }
    },
    [fullKey],
  )

  const apagar = useCallback(() => {
    try {
      localStorage.removeItem(fullKey)
      localStorage.removeItem(legacyKey)
    } catch (err) {
      console.error('[useDraft] falha ao apagar rascunho:', err)
    }
  }, [fullKey, legacyKey])

  // 🔍 Ao montar: procura rascunho válido (migrando o prefixo legado)
  useEffect(() => {
    if (disabled) return
    if (typeof window === 'undefined') return

    try {
      let raw = localStorage.getItem(fullKey)

      // 🕰️ migração transparente do prefixo antigo
      if (!raw) {
        const legado = localStorage.getItem(legacyKey)
        if (legado) {
          localStorage.setItem(fullKey, legado)
          localStorage.removeItem(legacyKey)
          raw = legado
        }
      }
      if (!raw) return

      const parsed: unknown = JSON.parse(raw)
      if (!ehWrapperValido<T>(parsed)) {
        apagar()
        return
      }

      // Expirou (>12h)? Apaga e ignora
      if (Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
        apagar()
        return
      }

      setHasDraft(true)
      setDraftSavedAt(parsed.savedAt)
    } catch (err) {
      console.error('[useDraft] rascunho corrompido, descartando:', err)
      apagar()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 💾 Auto-save com debounce sempre que o state mudar
  useEffect(() => {
    if (disabled) return
    if (typeof window === 'undefined') return

    // Pula a primeira execução (estado inicial, ainda não é digitação)
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false
      return
    }

    // 🔒 rodada bloqueada por clearDraft/discardDraft (reset do form)
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false
      return
    }

    // 🐛 CORREÇÃO 2 — antes havia um `return` aqui quando o banner estava
    // visível, o que MATAVA o auto-save de quem ignorava o banner e digitava.
    // Digitar é decisão implícita de seguir com dados novos: some com o banner
    // e volta a salvar normalmente.
    if (hasDraft) {
      setHasDraft(false)
      setDraftSavedAt(null)
    }

    cancelarSalvamentoPendente()
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      escrever(state)
    }, DEBOUNCE_MS)

    return () => {
      cancelarSalvamentoPendente()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, disabled])

  // 🧼 Desmonta: mata timers órfãos
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (indicatorRef.current) clearTimeout(indicatorRef.current)
    }
  }, [])

  // ↩️ Recupera o rascunho
  const restoreDraft = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(fullKey)
      if (!raw) {
        setHasDraft(false)
        return
      }

      const parsed: unknown = JSON.parse(raw)
      if (!ehWrapperValido<T>(parsed)) {
        apagar()
        setHasDraft(false)
        return
      }

      // ⚠️ o onRestore vai mudar o state e disparar o efeito de save.
      // Aqui NÃO bloqueamos: regravar o mesmo conteúdo é inofensivo e
      // mantém o savedAt fresco.
      cancelarSalvamentoPendente()
      onRestore(parsed.data)
      setHasDraft(false)
    } catch (err) {
      console.error('[useDraft] falha ao recuperar rascunho:', err)
      apagar()
      setHasDraft(false)
    }
  }, [fullKey, onRestore, apagar, cancelarSalvamentoPendente])

  // 🗑️ Descarta o rascunho (decisão explícita do usuário)
  const discardDraft = useCallback(() => {
    if (typeof window === 'undefined') return
    cancelarSalvamentoPendente()
    skipNextSaveRef.current = true
    apagar()
    setHasDraft(false)
    setDraftSavedAt(null)
    setShowSavedIndicator(false)
  }, [apagar, cancelarSalvamentoPendente])

  // 🧹 Limpa após salvar com sucesso — 🐛 CORREÇÃO 1 (fim do fantasma)
  const clearDraft = useCallback(() => {
    if (typeof window === 'undefined') return
    cancelarSalvamentoPendente() // ← mata o timer que ressuscitava o rascunho
    skipNextSaveRef.current = true // ← e o reset do form não grava vazio
    apagar()
    setHasDraft(false)
    setDraftSavedAt(null)
    setShowSavedIndicator(false)
  }, [apagar, cancelarSalvamentoPendente])

  return {
    showSavedIndicator,
    hasDraft,
    draftSavedAt,
    restoreDraft,
    discardDraft,
    clearDraft,
  }
}
