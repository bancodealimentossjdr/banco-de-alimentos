'use client'

import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import { usePermissions } from '@/hooks/usePermissions'

type ComVisibilidade = { id: string; name: string; hiddenAt?: string | null; hiddenNota?: string | null }

/**
 * 👁️ ONDA 23.7e-3 — estado e ações de visibilidade para páginas de cadastro.
 *
 * @param cadastro segmento da rota: 'funcionarios' | 'doadores' | ...
 * @param recarregar callback para refetch da lista após a mudança
 *
 * Contrato de querystring: `?ocultos=todos` (o backend também aceita `apenas`).
 * ⚠️ O front NUNCA é fonte de verdade — o backend revalida a role em todo PATCH.
 */
export function useVisibilidade<T extends ComVisibilidade>(
  cadastro: string,
  recarregar: () => void | Promise<void>,
) {
  const { canToggleVisibility } = usePermissions()
  const podeOcultar = canToggleVisibility()

  const [verOcultos, setVerOcultos] = useState(false)
  const [alterandoId, setAlterandoId] = useState<string | null>(null)
  const [alvo, setAlvo] = useState<T | null>(null)
  const [nota, setNota] = useState('')

  /** Sufixo de querystring para o fetch da lista. */
  const qsOcultos = verOcultos && podeOcultar ? 'ocultos=todos' : ''

  const enviar = useCallback(
    async (item: T, ocultar: boolean, notaEnvio: string | null) => {
      setAlterandoId(item.id)
      try {
        const res = await fetch(`/api/${cadastro}/${item.id}/visibilidade`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ocultar, nota: notaEnvio }),
        })
        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          toast.error(data.error || 'Erro ao alterar visibilidade')
          return
        }

        setAlvo(null)
        setNota('')
        toast.success(
          ocultar ? `${item.name} oculto para outros usuários` : `${item.name} visível novamente`,
        )
        await recarregar()
      } catch (error) {
        console.error('Erro ao alterar visibilidade:', error)
        toast.error('Falha de conexão')
      } finally {
        setAlterandoId(null)
      }
    },
    [cadastro, recarregar],
  )

  /** Oculto → reexibe direto. Visível → abre modal para justificar. */
  const acionar = useCallback(
    (item: T) => {
      if (item.hiddenAt) {
        enviar(item, false, null)
        return
      }
      setNota('')
      setAlvo(item)
    },
    [enviar],
  )

  return {
    podeOcultar,
    verOcultos,
    setVerOcultos,
    qsOcultos,
    alterandoId,
    alvo,
    setAlvo,
    nota,
    setNota,
    acionar,
    confirmar: () => alvo && enviar(alvo, true, nota.trim()),
  }
}
