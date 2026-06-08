'use client'

import { useEffect, useRef, useState } from 'react'

export type MultiSelectOption = {
  id: string
  name: string
}

type Props = {
  label: string
  placeholder?: string
  options: MultiSelectOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  emptyMessage?: string
}

/**
 * Componente de seleção múltipla com:
 * - Chips removíveis pros selecionados
 * - Dropdown com busca interna
 * - Botão "Limpar tudo"
 * - Fecha ao clicar fora (ESC também)
 * - Tailwind puro, zero deps
 */
export default function MultiSelectChips({
  label,
  placeholder = 'Selecionar...',
  options,
  selectedIds,
  onChange,
  emptyMessage = 'Nenhuma opção encontrada',
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setSearch('')
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEsc)
      // foca input ao abrir
      setTimeout(() => inputRef.current?.focus(), 50)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  const selectedSet = new Set(selectedIds)
  const selectedOptions = options.filter((o) => selectedSet.has(o.id))
  const filteredOptions = options.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase())
  )

  function toggle(id: string) {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((s) => s !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  function removeOne(id: string) {
    onChange(selectedIds.filter((s) => s !== id))
  }

  function clearAll() {
    onChange([])
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>

      {/* Caixa de chips + botão "abrir" */}
      <div
        className="flex min-h-[42px] cursor-pointer flex-wrap items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 hover:border-gray-400 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500"
        onClick={() => setOpen(true)}
      >
        {selectedOptions.length === 0 && (
          <span className="px-1 text-sm text-gray-400">{placeholder}</span>
        )}

        {selectedOptions.map((opt) => (
          <span
            key={opt.id}
            className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
            onClick={(e) => e.stopPropagation()}
          >
            {opt.name}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                removeOne(opt.id)
              }}
              className="ml-0.5 rounded-full hover:bg-blue-200"
              aria-label={`Remover ${opt.name}`}
            >
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}

        <span className="ml-auto pr-1 text-gray-400">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
          {/* Busca */}
          <div className="border-b border-gray-100 p-2">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Buscar..."
              className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Opções */}
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <p className="p-3 text-center text-sm text-gray-500">{emptyMessage}</p>
            ) : (
              filteredOptions.map((opt) => {
                const checked = selectedSet.has(opt.id)
                return (
                  <label
                    key={opt.id}
                    className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(opt.id)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className={checked ? 'font-medium text-gray-900' : 'text-gray-700'}>
                      {opt.name}
                    </span>
                  </label>
                )
              })
            )}
          </div>

          {/* Rodapé */}
          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-3 py-2 text-xs">
            <button
              type="button"
              onClick={clearAll}
              className="text-gray-600 hover:text-red-600 disabled:opacity-40"
              disabled={selectedIds.length === 0}
            >
              Limpar tudo
            </button>
            <span className="font-medium text-gray-700">
              {selectedIds.length} selecionado{selectedIds.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
