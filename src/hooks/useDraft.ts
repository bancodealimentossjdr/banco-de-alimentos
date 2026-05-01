'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

const DRAFT_PREFIX = 'bdsjdr-draft-'
const DRAFT_TTL_MS = 12 * 60 * 60 * 1000 // 12 horas
const DEBOUNCE_MS = 500
const SAVED_INDICATOR_MS = 2000

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

export function useDraft<T>({
  key,
  state,
  onRestore,
  disabled = false,
}: UseDraftOptions<T>): UseDraftReturn {
  const fullKey = `${DRAFT_PREFIX}${key}`
  const [showSavedIndicator, setShowSavedIndicator] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null)

  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const indicatorRef = useRef<NodeJS.Timeout | null>(null)
  const hasRestoredRef = useRef(false)
  const isFirstRunRef = useRef(true)

  // 🔍 Ao montar: verifica se existe rascunho válido
  useEffect(() => {
    if (disabled) return
    if (typeof window === 'undefined') return

    try {
      const raw = localStorage.getItem(fullKey)
      if (!raw) return

      const wrapper: DraftWrapper<T> = JSON.parse(raw)
      const age = Date.now() - wrapper.savedAt

      // Expirou (>12h)? Apaga e ignora
      if (age > DRAFT_TTL_MS) {
        localStorage.removeItem(fullKey)
        return
      }

      setHasDraft(true)
      setDraftSavedAt(wrapper.savedAt)
    } catch (err) {
      console.error('Erro ao ler rascunho:', err)
      localStorage.removeItem(fullKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 💾 Auto-save com debounce sempre que o state mudar
  useEffect(() => {
    if (disabled) return
    if (typeof window === 'undefined') return

    // Pula a primeira execução (estado inicial vazio)
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false
      return
    }

    // Não salva enquanto o banner de "recuperar" está visível
    if (hasDraft && !hasRestoredRef.current) return

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      try {
        const wrapper: DraftWrapper<T> = {
          data: state,
          savedAt: Date.now(),
        }
        localStorage.setItem(fullKey, JSON.stringify(wrapper))

        // Mostra "💾 Salvo" por 2s
        setShowSavedIndicator(true)
        if (indicatorRef.current) clearTimeout(indicatorRef.current)
        indicatorRef.current = setTimeout(() => {
          setShowSavedIndicator(false)
        }, SAVED_INDICATOR_MS)
      } catch (err) {
        console.error('Erro ao salvar rascunho:', err)
      }
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, disabled])

  // ↩️ Recupera o rascunho
  const restoreDraft = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(fullKey)
      if (!raw) return

      const wrapper: DraftWrapper<T> = JSON.parse(raw)
      onRestore(wrapper.data)
      hasRestoredRef.current = true
      setHasDraft(false)
    } catch (err) {
      console.error('Erro ao recuperar rascunho:', err)
    }
  }, [fullKey, onRestore])

  // 🗑️ Descarta o rascunho
  const discardDraft = useCallback(() => {
    if (typeof window === 'undefined') return
    localStorage.removeItem(fullKey)
    hasRestoredRef.current = true
    setHasDraft(false)
    setDraftSavedAt(null)
  }, [fullKey])

  // 🧹 Limpa (após salvar com sucesso)
  const clearDraft = useCallback(() => {
    if (typeof window === 'undefined') return
    localStorage.removeItem(fullKey)
    setHasDraft(false)
    setDraftSavedAt(null)
    setShowSavedIndicator(false)
  }, [fullKey])

  return {
    showSavedIndicator,
    hasDraft,
    draftSavedAt,
    restoreDraft,
    discardDraft,
    clearDraft,
  }
}
