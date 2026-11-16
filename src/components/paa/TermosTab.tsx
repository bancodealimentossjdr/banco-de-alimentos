'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { useApi, invalidate } from '@/hooks/useApi'
import { NUMERO_TERMO_REGEX } from '@/lib/validations/termo-paa'

// ============================================
// G1-8d-2 — Aba "Termos" dentro de /paa (somente admin/dev)
// O servidor SEMPRE revalida; as checagens aqui são só conveniência.
// ============================================

type Cultivo = 'CONVENCIONAL' | 'ORGANICO'

interface ProdutorPaa {
  id: string
  name: string
  active: boolean
}

interface TermoResumo {
  id: string
  numeroTermo: string
  dataTermo: string
  valorTotal: number | null
  quantidadeTotal: number
  pesoTotalKg: number
  notaFiscal: string | null
  dataAteste: string | null
  observacaoInterna: string | null
  registradoEm: string
  producer: { id: string; name: string }
  registradoPor: { id: string; name: string } | null
  _count?: { entregas: number }
  isMasked?: boolean
}

interface ItemTermo {
  productId: string
  tipoCultivo: Cultivo
  quantidade: number
  precoUnitario: number | null
  pesoKg: number
  subtotal: number | null
  product: { name: string; paaUnidade: string | null }
}

interface EntregaTermo {
  id: string
  dataEntrega: string
  status?: string
  valorTotal: number | null
  pesoTotalKg: number
  assinaturaEm: string | null
  itens: ItemTermo[]
}

interface LinhaSispaa {
  productId: string
  tipoCultivo: Cultivo
  nome: string
  quantidade: number
  precoUnitario: number | null
  valor: number | null
  pesoKg: number
}

interface TermoDetalhe extends TermoResumo {
  updatedAt: string
  producer: { id: string; name: string; cpf?: string | null; dapCaf?: string | null }
  entregas: EntregaTermo[]
  linhas: LinhaSispaa[]
  aviso?: string | null
}

interface PaaConfig {
  cotaPadrao: number
  alertaPercentual: number
  unidadeExecutora: string | null
  termoAdesao: string | null
  proposta: string | null
  planoOperacional: string | null
  uf: string | null
  municipio: string | null
}

type CfgForm = {
  unidadeExecutora: string
  termoAdesao: string
  proposta: string
  planoOperacional: string
  uf: string
  municipio: string
}

const CAMPOS_CFG: { key: keyof CfgForm; label: string; max: number; span?: boolean }[] = [
  { key: 'unidadeExecutora', label: 'Unidade executora', max: 150, span: true },
  { key: 'termoAdesao', label: 'Termo de adesão', max: 40 },
  { key: 'proposta', label: 'Proposta', max: 60 },
  { key: 'planoOperacional', label: 'Plano operacional', max: 60 },
  { key: 'uf', label: 'UF', max: 2 },
  { key: 'municipio', label: 'Município', max: 80 },
]

const hoje = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const civilBR = (s: string | null | undefined) => (s ? s.split('-').reverse().join('/') : '—')
const fmt3 = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

/** Mesma abreviação cosmética da aba Entregas (não altera cálculo). */
const abrevUnidade = (u: string | null | undefined): string => {
  const v = (u ?? 'Kg').trim().toLowerCase()
  if (v.startsWith('litro') || v === 'l') return 'L'
  if (v.startsWith('dúzia') || v.startsWith('duzia') || v === 'dz') return 'Dz'
  if (v.startsWith('maço') || v.startsWith('maco')) return 'Mç'
  if (v.startsWith('unid') || v === 'un') return 'Un'
  return 'Kg'
}

const inputCls =
  'w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm'

export default function TermosTab() {
  const { isAdmin, isDev } = usePermissions()
  const podeAdmin = isAdmin || isDev // Termos são exclusivos de admin/dev

  // ---------- Dados ----------
  const { data: termosData, isLoading: loadingTermos, mutate: mutateTermos } =
    useApi<TermoResumo[]>(podeAdmin ? '/api/paa/termos' : null)
  const termos = useMemo(() => termosData ?? [], [termosData])

  const { data: cfg, mutate: mutateCfg } = useApi<PaaConfig>(podeAdmin ? '/api/paa/config' : null)

  const { data: produtoresData } = useApi<ProdutorPaa[]>(podeAdmin ? '/api/produtores?paa=true' : null)
  const produtores = useMemo(() => produtoresData ?? [], [produtoresData])

  // ---------- Filtro ----------
  const [filtroProd, setFiltroProd] = useState('')
  const produtoresFiltro = useMemo(() => {
    const map = new Map<string, string>()
    termos.forEach((t) => map.set(t.producer.id, t.producer.name))
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [termos])
  const termosFiltrados = filtroProd ? termos.filter((t) => t.producer.id === filtroProd) : termos

  // ---------- PaaConfig ----------
  const [cfgAberto, setCfgAberto] = useState(false)
  const [cfgForm, setCfgForm] = useState<CfgForm>({
    unidadeExecutora: '',
    termoAdesao: '',
    proposta: '',
    planoOperacional: '',
    uf: '',
    municipio: '',
  })
  const [salvandoCfg, setSalvandoCfg] = useState(false)

  const cfgIncompleto = !cfg || CAMPOS_CFG.some((c) => !cfg[c.key])

  const abrirCfg = () => {
    setCfgForm({
      unidadeExecutora: cfg?.unidadeExecutora ?? '',
      termoAdesao: cfg?.termoAdesao ?? '',
      proposta: cfg?.proposta ?? '',
      planoOperacional: cfg?.planoOperacional ?? '',
      uf: cfg?.uf ?? '',
      municipio: cfg?.municipio ?? '',
    })
    setCfgAberto(true)
  }

  const salvarCfg = async () => {
    if (salvandoCfg) return
    if (cfgForm.uf.trim() && !/^[A-Za-z]{2}$/.test(cfgForm.uf.trim())) {
      alert('UF com 2 letras (ex.: MG).')
      return
    }
    setSalvandoCfg(true)
    try {
      const res = await fetch('/api/paa/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unidadeExecutora: cfgForm.unidadeExecutora,
          termoAdesao: cfgForm.termoAdesao,
          proposta: cfgForm.proposta,
          planoOperacional: cfgForm.planoOperacional,
          uf: cfgForm.uf.trim() || null,
          municipio: cfgForm.municipio,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        mutateCfg()
        setCfgAberto(false)
      } else {
        alert(body.error || 'Erro ao salvar dados institucionais')
      }
    } catch (err) {
      console.error('Erro ao salvar PaaConfig:', err)
      alert('Erro ao salvar dados institucionais')
    } finally {
      setSalvandoCfg(false)
    }
  }

  // ---------- Novo Termo ----------
  const [novo, setNovo] = useState(false)
  const [nProducer, setNProducer] = useState('')
  const [nNumero, setNNumero] = useState('')
  const [nData, setNData] = useState(hoje())
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [criando, setCriando] = useState(false)

  const { data: elegData, isLoading: loadingEleg, mutate: mutateEleg } = useApi<EntregaTermo[]>(
    podeAdmin && novo && nProducer
      ? `/api/paa/termos/elegiveis?producerId=${encodeURIComponent(nProducer)}`
      : null,
  )
  const elegiveis = useMemo(() => elegData ?? [], [elegData])
  const selecionadas = useMemo(() => elegiveis.filter((e) => sel.has(e.id)), [elegiveis, sel])

  const resumoSel = useMemo(() => {
    let valor = 0
    let peso = 0
    let maisRecente = ''
    const precos = new Map<string, { nome: string; preco: number }>()
    let conflito = ''
    for (const e of selecionadas) {
      valor += e.valorTotal ?? 0
      peso += e.pesoTotalKg
      if (e.dataEntrega > maisRecente) maisRecente = e.dataEntrega
      for (const i of e.itens) {
        const k = `${i.productId}::${i.tipoCultivo}`
        const p = Number(i.precoUnitario ?? 0)
        const atual = precos.get(k)
        if (!atual) precos.set(k, { nome: i.product.name, preco: p })
        else if (atual.preco !== p && !conflito) {
          conflito = `"${atual.nome}" aparece com preços diferentes (${brl(atual.preco)} e ${brl(p)}). Separe em Termos distintos.`
        }
      }
    }
    return { valor, peso, maisRecente, conflito }
  }, [selecionadas])

  const errosNovo: string[] = []
  if (nNumero.trim() && !NUMERO_TERMO_REGEX.test(nNumero.trim()))
    errosNovo.push('Número fora do formato do SISPAA (ex.: 123/2026.1).')
  if (resumoSel.maisRecente && nData && nData < resumoSel.maisRecente)
    errosNovo.push(`A data do Termo não pode ser anterior à entrega mais recente (${civilBR(resumoSel.maisRecente)}).`)
  if (sel.size > 100) errosNovo.push('Máximo de 100 entregas por Termo.')
  if (resumoSel.conflito) errosNovo.push(resumoSel.conflito)

  const podeEnviarNovo =
    !!nProducer && !!nNumero.trim() && !!nData && sel.size >= 1 && errosNovo.length === 0 && !criando

  const resetNovo = () => {
    setNovo(false)
    setNProducer('')
    setNNumero('')
    setNData(hoje())
    setSel(new Set())
  }

  const toggleSel = (id: string) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const toggleTodas = () =>
    setSel((s) => (s.size === elegiveis.length ? new Set() : new Set(elegiveis.slice(0, 100).map((e) => e.id))))

  // ---------- Detalhe ----------
  const [detalheId, setDetalheId] = useState<string | null>(null)
  const { data: det, isLoading: loadingDet, mutate: mutateDet } = useApi<TermoDetalhe>(
    podeAdmin && detalheId ? `/api/paa/termos/${detalheId}` : null,
  )

  const abrirDetalhe = (id: string) => {
    setDetalheId(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const criarTermo = async () => {
    if (!podeEnviarNovo) return
    setCriando(true)
    try {
      const res = await fetch('/api/paa/termos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numeroTermo: nNumero.trim(),
          dataTermo: nData,
          producerId: nProducer,
          entregaIds: Array.from(sel),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        resetNovo()
        mutateTermos()
        invalidate('/api/paa')
        if (body?.id) abrirDetalhe(body.id)
      } else {
        alert(body.error || 'Erro ao criar Termo')
        if (res.status === 409) {
          setSel(new Set())
          mutateEleg()
        }
      }
    } catch (err) {
      console.error('Erro ao criar Termo PAA:', err)
      alert('Erro ao criar Termo')
    } finally {
      setCriando(false)
    }
  }

  const [nf, setNf] = useState('')
  const [ateste, setAteste] = useState('')
  const [obs, setObs] = useState('')
  const [salvandoAdm, setSalvandoAdm] = useState(false)

  useEffect(() => {
    if (!det) return
    setNf(det.notaFiscal ?? '')
    setAteste(det.dataAteste ?? '')
    setObs(det.observacaoInterna ?? '')
  }, [det?.id, det?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const unidadePorProduto = useMemo(() => {
    const m = new Map<string, string | null>()
    det?.entregas.forEach((e) => e.itens.forEach((i) => m.set(i.productId, i.product.paaUnidade)))
    return m
  }, [det])

  const salvarAdmin = async () => {
    if (!detalheId || salvandoAdm) return
    setSalvandoAdm(true)
    try {
      const res = await fetch(`/api/paa/termos/${detalheId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notaFiscal: nf,
          dataAteste: ateste || null,
          observacaoInterna: obs,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        mutateDet()
        mutateTermos()
      } else {
        alert(body.error || 'Erro ao salvar')
      }
    } catch (err) {
      console.error('Erro ao atualizar Termo PAA:', err)
      alert('Erro ao salvar')
    } finally {
      setSalvandoAdm(false)
    }
  }

  // ---------- Retirar entrega do Termo ----------
  const [retirandoId, setRetirandoId] = useState<string | null>(null)
  const [motivoR, setMotivoR] = useState('')
  const [enviandoR, setEnviandoR] = useState(false)

  const confirmarRetirada = async () => {
    if (!detalheId || !retirandoId || enviandoR) return
    if (motivoR.trim().length < 5) {
      alert('Informe o motivo (mínimo de 5 caracteres).')
      return
    }
    setEnviandoR(true)
    try {
      const res = await fetch(`/api/paa/termos/${detalheId}/entregas/${retirandoId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivoR.trim() }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        setRetirandoId(null)
        setMotivoR('')
        mutateDet()
        mutateTermos()
        invalidate('/api/paa')
      } else {
        alert(body.error || 'Erro ao retirar entrega')
        if (res.status === 409 || res.status === 404) {
          setRetirandoId(null)
          mutateDet()
        }
      }
    } catch (err) {
      console.error('Erro ao retirar entrega do Termo:', err)
      alert('Erro ao retirar entrega')
    } finally {
      setEnviandoR(false)
    }
  }

  const fecharDetalhe = () => {
    setDetalheId(null)
    setRetirandoId(null)
    setMotivoR('')
    mutateTermos()
  }

  // 🔒 Conveniência: o servidor já devolve 403
  if (!podeAdmin) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-6xl mb-4">🔒</p>
        <p className="text-lg">Termos são restritos a administradores.</p>
      </div>
    )
  }

  // ============================================
  // 🔎 VISÃO: DETALHE (substitui a lista, sem modal)
  // ============================================
  if (detalheId) {
    const podePdf = !!det && det.entregas.length > 0 && !det.aviso
    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <button
            onClick={fecharDetalhe}
            className="self-start text-green-700 hover:text-green-800 font-medium px-3 py-2 rounded-lg hover:bg-green-50 transition"
          >
            ← Voltar aos Termos
          </button>
          {det && (
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href={podePdf ? `/paa/termos/${det.id}/imprimir?modelo=sispaa` : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!podePdf}
                className={`text-center px-4 py-2.5 rounded-lg font-medium transition ${
                  podePdf
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-200 text-gray-400 pointer-events-none'
                }`}
              >
                📄 PDF SISPAA
              </a>
              <a
                href={podePdf ? `/paa/termos/${det.id}/imprimir?modelo=annonae` : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!podePdf}
                className={`text-center px-4 py-2.5 rounded-lg font-medium transition ${
                  podePdf
                    ? 'bg-white border border-green-600 text-green-700 hover:bg-green-50'
                    : 'bg-gray-200 text-gray-400 pointer-events-none'
                }`}
              >
                📄 PDF Annonae
              </a>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
          {loadingDet && !det ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500"></div>
            </div>
          ) : !det ? (
            <p className="text-sm text-gray-500">Termo não encontrado.</p>
          ) : (
            <>
              <h3 className="text-lg font-bold text-gray-900">📄 Termo {det.numeroTermo}</h3>
              <p className="text-sm text-gray-600 mt-0.5">
                <strong>{det.producer.name}</strong>
                {det.producer.cpf ? ` · CPF ${det.producer.cpf}` : ''}
                {det.producer.dapCaf ? ` · CAF/DAP ${det.producer.dapCaf}` : ''}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Data do Termo: {civilBR(det.dataTermo)}
                {det.registradoPor ? ` · registrado por ${det.registradoPor.name}` : ''}
              </p>

              {det.aviso && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
                  🔴 {det.aviso}
                </p>
              )}
              {cfgIncompleto && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
                  ⚠️ Dados institucionais incompletos: o PDF SISPAA sairá com campos em branco.
                </p>
              )}
              {(!det.producer.cpf || !det.producer.dapCaf) && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
                  ⚠️ Produtor sem CPF ou CAF/DAP no cadastro: o PDF sairá com esses campos em branco.
                </p>
              )}

              {/* LINHAS SISPAA */}
              <h4 className="text-md font-semibold text-gray-800 mt-5 mb-2">🧾 Linhas do Termo (SISPAA)</h4>
              {det.linhas.length === 0 ? (
                <p className="text-sm text-gray-500">Sem linhas.</p>
              ) : (
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 text-xs">
                      <tr>
                        <th className="text-left px-3 py-2">Produto</th>
                        <th className="text-left px-3 py-2">Cultivo</th>
                        <th className="text-right px-3 py-2">Quantidade</th>
                        <th className="text-right px-3 py-2">Preço</th>
                        <th className="text-right px-3 py-2">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {det.linhas.map((l) => (
                        <tr key={`${l.productId}::${l.tipoCultivo}`} className="border-t">
                          <td className="px-3 py-2">{l.nome}</td>
                          <td className="px-3 py-2">{l.tipoCultivo === 'ORGANICO' ? '🍃 Orgânico' : 'Convencional'}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {fmt3(l.quantidade)} {abrevUnidade(unidadePorProduto.get(l.productId))}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {l.precoUnitario !== null ? brl(l.precoUnitario) : '🔒'}
                          </td>
                          <td className="px-3 py-2 text-right font-medium whitespace-nowrap">
                            {l.valor !== null ? brl(l.valor) : '🔒'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-amber-50 font-semibold">
                      <tr className="border-t">
                        <td className="px-3 py-2" colSpan={2}>
                          Total
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{fmt3(det.pesoTotalKg)} kg</td>
                        <td></td>
                        <td className="px-3 py-2 text-right text-amber-800 whitespace-nowrap">
                          {det.valorTotal !== null ? brl(det.valorTotal) : '🔒'}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* ENTREGAS */}
              <h4 className="text-md font-semibold text-gray-800 mt-5 mb-2">
                🥬 Entregas vinculadas ({det.entregas.length})
              </h4>
              <div className="space-y-2">
                {det.entregas.map((e) => (
                  <div key={e.id} className="border rounded-lg p-3">
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-medium text-gray-900">{civilBR(e.dataEntrega)}</span>
                        <span className="text-xs text-gray-500 ml-2">{fmt3(e.pesoTotalKg)} kg</span>
                        {e.valorTotal !== null && (
                          <span className="text-sm text-amber-700 font-semibold ml-2">{brl(e.valorTotal)}</span>
                        )}
                        <p className="text-xs text-gray-500 mt-0.5">
                          {e.itens
                            .map(
                              (i) =>
                                `${i.product.name}${i.tipoCultivo === 'ORGANICO' ? ' 🍃' : ''} ${i.quantidade} ${abrevUnidade(i.product.paaUnidade)}`,
                            )
                            .join(' · ')}
                        </p>
                      </div>
                      {retirandoId !== e.id && (
                        <button
                          onClick={() => {
                            setRetirandoId(e.id)
                            setMotivoR('')
                          }}
                          className="text-red-600 hover:text-red-800 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition self-start"
                        >
                          ↩️ Retirar do Termo
                        </button>
                      )}
                    </div>
                    {retirandoId === e.id && (
                      <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-sm text-red-700">
                          🔴 A entrega volta para <strong>Assinada</strong> e os totais são recalculados. O Termo
                          deverá ser <strong>reemitido no SISPAA</strong>.
                        </p>
                        <textarea
                          value={motivoR}
                          onChange={(ev) => setMotivoR(ev.target.value)}
                          maxLength={500}
                          rows={2}
                          placeholder="Motivo (mínimo 5 caracteres)"
                          className="w-full border rounded-lg px-3 py-2 mt-2 text-sm focus:ring-2 focus:ring-red-500"
                        />
                        <div className="flex gap-2 mt-2 justify-end">
                          <button
                            onClick={() => setRetirandoId(null)}
                            disabled={enviandoR}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={confirmarRetirada}
                            disabled={motivoR.trim().length < 5 || enviandoR}
                            className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-4 py-2 rounded-lg text-sm font-medium"
                          >
                            {enviandoR ? 'Retirando...' : 'Confirmar retirada'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* PÓS-EMISSÃO */}
              <h4 className="text-md font-semibold text-gray-800 mt-5 mb-2">🧾 Nota fiscal e ateste</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nota fiscal</label>
                  <input value={nf} maxLength={30} onChange={(e) => setNf(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data do ateste</label>
                  <input type="date" value={ateste} onChange={(e) => setAteste(e.target.value)} className={inputCls} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observação interna <span className="text-xs text-gray-400">(não vai ao PDF SISPAA)</span>
                  </label>
                  <textarea
                    value={obs}
                    maxLength={2000}
                    rows={3}
                    onChange={(e) => setObs(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="md:col-span-2">
                  <button
                    onClick={salvarAdmin}
                    disabled={salvandoAdm}
                    className="bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white px-6 py-2.5 rounded-lg font-medium transition"
                  >
                    {salvandoAdm ? 'Salvando...' : 'Salvar NF / ateste / observação'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // ============================================
  // 📋 VISÃO: LISTA
  // ============================================
  return (
    <div>
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">📄 Termos de Recebimento</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Dados transcritos do SISPAA · uma linha por produto e tipo de cultivo
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => (cfgAberto ? setCfgAberto(false) : abrirCfg())}
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg font-medium transition"
          >
            🏛️ Dados institucionais
          </button>
          <button
            onClick={() => (novo ? resetNovo() : setNovo(true))}
            className="bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-lg font-medium transition"
          >
            {novo ? 'Cancelar' : '+ Novo Termo'}
          </button>
        </div>
      </div>

      {cfgIncompleto && !cfgAberto && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl p-3 mb-4">
          ⚠️ Dados institucionais do PAA incompletos. Eles são obrigatórios no PDF do Termo. Clique em
          &quot;🏛️ Dados institucionais&quot;.
        </div>
      )}

      {/* 🏛️ PAACONFIG */}
      {cfgAberto && (
        <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-900">🏛️ Dados institucionais do PAA</h3>
          <p className="text-xs text-gray-500 mt-0.5 mb-4">
            Transcreva do SISPAA. Valem para todos os Termos desta organização.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CAMPOS_CFG.map((c) => (
              <div key={c.key} className={c.span ? 'md:col-span-2' : ''}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{c.label}</label>
                <input
                  value={cfgForm[c.key]}
                  maxLength={c.max}
                  onChange={(e) =>
                    setCfgForm({
                      ...cfgForm,
                      [c.key]: c.key === 'uf' ? e.target.value.toUpperCase() : e.target.value,
                    })
                  }
                  className={inputCls}
                />
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-5">
            <button
              onClick={salvarCfg}
              disabled={salvandoCfg}
              className="bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white px-6 py-2.5 rounded-lg font-medium transition"
            >
              {salvandoCfg ? 'Salvando...' : 'Salvar dados institucionais'}
            </button>
            <button
              onClick={() => setCfgAberto(false)}
              disabled={salvandoCfg}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2.5 rounded-lg font-medium transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ➕ NOVO TERMO */}
      {novo && (
        <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">➕ Novo Termo</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">1. Produtor *</label>
              <select
                value={nProducer}
                onChange={(e) => {
                  setNProducer(e.target.value)
                  setSel(new Set())
                }}
                className={inputCls}
              >
                <option value="">Selecione um produtor</option>
                {produtores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nº do Termo (SISPAA) *</label>
              <input
                value={nNumero}
                onChange={(e) => setNNumero(e.target.value)}
                placeholder="123/2026.1"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data do Termo (SISPAA) *</label>
              <input type="date" value={nData} onChange={(e) => setNData(e.target.value)} className={inputCls} />
            </div>
          </div>

          {nProducer && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-md font-semibold text-gray-800">2. Entregas assinadas sem Termo</h4>
                {elegiveis.length > 0 && (
                  <button onClick={toggleTodas} className="text-green-600 hover:text-green-700 text-sm font-medium">
                    {sel.size === elegiveis.length ? 'Desmarcar todas' : 'Marcar todas'}
                  </button>
                )}
              </div>

              {loadingEleg && !elegData ? (
                <p className="text-sm text-gray-500 py-4">Carregando entregas...</p>
              ) : elegiveis.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">
                  Nenhuma entrega assinada e livre para este produtor. Assine as entregas na aba Entregas.
                </p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {elegiveis.map((e) => (
                    <label
                      key={e.id}
                      className={`flex items-start gap-3 border rounded-lg p-3 cursor-pointer transition ${
                        sel.has(e.id) ? 'bg-green-50 border-green-300' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={sel.has(e.id)}
                        onChange={() => toggleSel(e.id)}
                        className="mt-1 h-4 w-4"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between gap-2">
                          <span className="font-medium text-gray-900">{civilBR(e.dataEntrega)}</span>
                          <span className="text-sm font-semibold text-amber-700">
                            {e.valorTotal !== null ? brl(e.valorTotal) : '—'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {e.itens
                            .map(
                              (i) =>
                                `${i.product.name}${i.tipoCultivo === 'ORGANICO' ? ' 🍃' : ''} ${i.quantidade} ${abrevUnidade(i.product.paaUnidade)}`,
                            )
                            .join(' · ')}{' '}
                          · {fmt3(e.pesoTotalKg)} kg
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {sel.size > 0 && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between gap-3">
              <div>
                <p className="text-xs text-green-600 font-medium">
                  {sel.size} ENTREGA{sel.size > 1 ? 'S' : ''} · PESO
                </p>
                <p className="text-xl font-bold text-green-700">{fmt3(resumoSel.peso)} kg</p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs text-amber-600 font-medium">VALOR ESTIMADO</p>
                <p className="text-xl font-bold text-amber-700">{brl(resumoSel.valor)}</p>
                <p className="text-xs text-gray-500 mt-1">⚠️ O valor oficial é recalculado por linha no servidor</p>
              </div>
            </div>
          )}

          {errosNovo.length > 0 && (
            <ul className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
              {errosNovo.map((m) => (
                <li key={m}>⚠️ {m}</li>
              ))}
            </ul>
          )}

          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <button
              onClick={criarTermo}
              disabled={!podeEnviarNovo}
              className="bg-green-500 hover:bg-green-600 disabled:bg-green-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium transition"
            >
              {criando ? 'Registrando...' : 'Registrar Termo'}
            </button>
          </div>
        </div>
      )}

      {/* FILTRO */}
      {!novo && termos.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
          <label className="block text-xs text-gray-500 mb-1">🔍 Produtor</label>
          <select value={filtroProd} onChange={(e) => setFiltroProd(e.target.value)} className={inputCls}>
            <option value="">Todos</option>
            {produtoresFiltro.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* LISTA */}
      {loadingTermos && !termosData ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
        </div>
      ) : termosFiltrados.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-6xl mb-4">📄</p>
          <p className="text-xl">Nenhum Termo registrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {termosFiltrados.map((t) => {
            const qtdEntregas = t._count?.entregas ?? 0
            return (
              <div key={t.id} className="bg-white rounded-xl shadow-sm border p-4 md:p-5">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-gray-900">Termo {t.numeroTermo}</h3>
                      {qtdEntregas === 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                          🔴 Vazio
                        </span>
                      )}
                      {t.notaFiscal && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          🧾 NF {t.notaFiscal}
                        </span>
                      )}
                      {t.dataAteste && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          ✅ Atestado {civilBR(t.dataAteste)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{t.producer.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {civilBR(t.dataTermo)} · {qtdEntregas} entrega{qtdEntregas !== 1 ? 's' : ''} ·{' '}
                      {fmt3(t.pesoTotalKg)} kg
                    </p>
                  </div>
                  <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                    {t.valorTotal !== null && (
                      <span className="text-lg font-bold text-amber-700">{brl(t.valorTotal)}</span>
                    )}
                    <button
                      onClick={() => abrirDetalhe(t.id)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium px-2 py-1 rounded hover:bg-blue-50 transition"
                    >
                      Ver detalhes →
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
