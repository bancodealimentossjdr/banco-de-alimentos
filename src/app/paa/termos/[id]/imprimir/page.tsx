'use client'

import { use, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePermissions } from '@/hooks/usePermissions'
import { useApi } from '@/hooks/useApi'

// ============================================
// G1-8d — Impressão do Termo (layout v4)
// Renderiza via portal em <body>, FORA do layout do app.
// Na impressão, todo o resto do body recebe display:none (sem página em branco).
// ?modelo=sispaa → A4 paisagem, margem 15mm | ?modelo=annonae → A4 retrato, 16/18mm
// Logos: public/logos/ (assets compartilhados)
// ============================================

const LOGO_GOV = '/logos/paa/logo-governo.png'
const LOGO_ANNONAE = '/logos/annonae-color.png'

const VERDE = '#14532D'
const OURO = '#C9A227'
const VINHO = '#9B2C2C'
const CINZA = '#6E6E6E'

type Cultivo = 'CONVENCIONAL' | 'ORGANICO'

interface Item {
  productId: string
  tipoCultivo: Cultivo
  quantidade: number
  precoUnitario: number | null
  pesoKg: number
  subtotal: number | null
  product: { name: string; paaUnidade: string | null }
}

interface Entrega {
  id: string
  dataEntrega: string
  valorTotal: number | null
  pesoTotalKg: number
  assinaturaEm: string | null
  itens: Item[]
}

interface Linha {
  productId: string
  tipoCultivo: Cultivo
  nome: string
  quantidade: number
  precoUnitario: number | null
  valor: number | null
  pesoKg: number
}

interface Termo {
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
  producer: { id: string; name: string; cpf?: string | null; dapCaf?: string | null }
  registradoPor: { id: string; name: string } | null
  entregas: Entrega[]
  linhas: Linha[]
  aviso?: string | null
}

interface PaaConfig {
  unidadeExecutora: string | null
  termoAdesao: string | null
  proposta: string | null
  planoOperacional: string | null
  uf: string | null
  municipio: string | null
}

const civilBR = (s: string | null | undefined) => (s ? s.split('-').reverse().join('/') : '')
const n2 = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const nQtd = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })
const n3 = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const up = (s: string | null | undefined) => (s ?? '').toLocaleUpperCase('pt-BR')
const cultivo = (t: Cultivo) => (t === 'ORGANICO' ? 'ORGÂNICO' : 'CONVENCIONAL')
const dtBR = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })

function Logo({ src, alt, h }: { src: string; alt: string; h: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      style={{ height: h, width: 'auto', objectFit: 'contain', display: 'block' }}
      onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
    />
  )
}

const CSS_BASE = `
#termo-root { position: fixed; inset: 0; z-index: 9999; overflow: auto; background: #E5E7EB; padding: 16px 0 40px; }
.barra { margin: 0 auto 12px; padding: 0 8px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.btn { padding: 8px 16px; border-radius: 8px; font: 500 13px Arial, sans-serif; border: 1px solid #D1D5DB;
  background: #fff; color: #374151; cursor: pointer; text-decoration: none; }
.btn.on { background: #16A34A; color: #fff; border-color: #16A34A; }
.folha { background: #fff; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,.15); box-sizing: border-box; }
.doc { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 11px; line-height: 1.4;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.doc * { box-sizing: border-box; }
.doc table { width: 100%; border-collapse: collapse; }
.doc .r { text-align: right; white-space: nowrap; }
.doc .c { text-align: center; }
.doc .quebra { break-inside: avoid; page-break-inside: avoid; }
.doc thead { display: table-header-group; }
@media print {
  html, body { background: #fff !important; margin: 0 !important; padding: 0 !important;
    height: auto !important; overflow: visible !important; }
  body > *:not(#termo-portal) { display: none !important; }
  #termo-root { position: static; overflow: visible; background: #fff; padding: 0; }
  .barra { display: none !important; }
  .folha { box-shadow: none; padding: 0 !important; width: auto !important; min-height: 0 !important; }
}
`

const CSS_SISPAA = `
@page { size: A4 landscape; margin: 15mm; }
.folha { width: 297mm; min-height: 210mm; padding: 15mm; }
.barra { width: 297mm; }
.sis th, .sis td { border: 1px solid #000; padding: 5px 7px; vertical-align: middle; }
.sis thead th { background: #D9D9D9; font-weight: bold; text-align: center; }
.sis .rot { font-weight: bold; white-space: nowrap; }
.sis .tot td { font-weight: bold; }
.sis .ass { text-align: center; padding: 0 18px; vertical-align: top; }
.sis .ass .linha { margin: 44px auto 4px; width: 80%; border-top: 1px solid #000; }
`

const CSS_ANNONAE = `
@page { size: A4 portrait; margin: 16mm 18mm; }
.folha { width: 210mm; min-height: 297mm; padding: 16mm 18mm; }
.barra { width: 210mm; }
.ann th, .ann td { padding: 6px 8px; border-bottom: 1px solid #E5E7EB; }
.ann thead th { background: ${VERDE}; color: #fff; font-weight: bold; text-align: left; border: none; }
.ann thead th.r { text-align: right; }
.ann tbody tr:nth-child(even) td { background: #F7F8F5; }
.ann .tot td { background: #FBF6E3 !important; font-weight: bold; border-top: 2px solid ${OURO}; }
.ann h2 { font-size: 12px; font-weight: bold; color: ${VERDE}; margin: 20px 0 8px;
  padding-left: 8px; border-left: 4px solid ${OURO}; text-transform: uppercase; }
.ann .card { border: 1px solid #E5E7EB; border-radius: 6px; padding: 10px 12px; }
.ann .k { font-size: 9px; color: ${CINZA}; text-transform: uppercase; margin-bottom: 2px; }
.ann .v { font-size: 12px; font-weight: bold; }
`

export default function ImprimirTermoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ modelo?: string }>
}) {
  const { id } = use(params)
  const { modelo: m } = use(searchParams)
  const modelo = m === 'annonae' ? 'annonae' : 'sispaa'

  const { isAdmin, isDev } = usePermissions()
  const pode = isAdmin || isDev

  const { data: t, isLoading } = useApi<Termo>(pode ? `/api/paa/termos/${id}` : null)
  const { data: cfg } = useApi<PaaConfig>(pode ? '/api/paa/config' : null)

  const [portal, setPortal] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const el = document.createElement('div')
    el.id = 'termo-portal'
    document.body.appendChild(el)
    setPortal(el)
    return () => {
      document.body.removeChild(el)
    }
  }, [])

  const unidade = useMemo(() => {
    const map = new Map<string, string>()
    t?.entregas.forEach((e) => e.itens.forEach((i) => map.set(i.productId, i.product.paaUnidade || 'Kg')))
    return map
  }, [t])

  if (!pode) return <p className="p-6 text-gray-600">🔒 Restrito a administradores.</p>
  if (isLoading && !t) return <p className="p-6 text-gray-600">Carregando Termo...</p>
  if (!t) return <p className="p-6 text-gray-600">Termo não encontrado.</p>
  if (t.entregas.length === 0 || t.aviso) {
    return <p className="p-6 text-red-700">🔴 {t.aviso || 'Termo sem entregas.'} Não é possível imprimir.</p>
  }
  if (!portal) return null

  const num = t.numeroTermo
  const dataAq = civilBR(t.dataTermo)
  const sis = modelo === 'sispaa'

  const conteudo = (
    <div id="termo-root">
      <style>{CSS_BASE + (sis ? CSS_SISPAA : CSS_ANNONAE)}</style>

      <div className="barra">
        <button className="btn" onClick={() => window.close()}>
          ✕ Fechar
        </button>
        <a className={`btn ${sis ? 'on' : ''}`} href={`/paa/termos/${id}/imprimir?modelo=sispaa`}>
          Modelo SISPAA
        </a>
        <a className={`btn ${!sis ? 'on' : ''}`} href={`/paa/termos/${id}/imprimir?modelo=annonae`}>
          Modelo Annonae
        </a>
        <span style={{ fontSize: 12, color: '#6B7280', fontFamily: 'Arial' }}>
          layout v4 · {sis ? 'A4 paisagem' : 'A4 retrato'} · Margens: Padrão · desmarque &quot;Cabeçalhos e rodapés&quot;
        </span>
        <button className="btn on" style={{ marginLeft: 'auto' }} onClick={() => window.print()}>
          🖨️ Imprimir / Salvar PDF
        </button>
      </div>

      <div className={`folha doc ${sis ? 'sis' : 'ann'}`}>
        {sis ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 14 }}>
              <Logo src={LOGO_GOV} alt="Governo Federal" h={56} />
              <h1 style={{ flex: 1, fontSize: 15, fontWeight: 'bold', textAlign: 'center', margin: 0 }}>
                TERMO DE RECEBIMENTO E ACEITABILIDADE Nº {num}
              </h1>
            </div>

            <table style={{ marginBottom: 14 }}>
              <tbody>
                <tr>
                  <td colSpan={3}>
                    <span className="rot">UNIDADE EXECUTORA:</span> {cfg?.unidadeExecutora ?? ''}
                  </td>
                </tr>
                <tr>
                  <td>
                    <span className="rot">Nº TERMO ADESÃO:</span> {cfg?.termoAdesao ?? ''}
                  </td>
                  <td>
                    <span className="rot">Nº PROPOSTA</span> {cfg?.proposta ?? ''}
                  </td>
                  <td>
                    <span className="rot">Nº PLANO OPERACIONAL</span> {cfg?.planoOperacional ?? ''}
                  </td>
                </tr>
                <tr>
                  <td>
                    <span className="rot">PRODUTOR:</span> {up(t.producer.name)}
                  </td>
                  <td>
                    <span className="rot">CPF:</span> {t.producer.cpf ?? ''}
                  </td>
                  <td>
                    <span className="rot">DAP:</span> {t.producer.dapCaf ?? ''}
                  </td>
                </tr>
                <tr>
                  <td>
                    <span className="rot">UF:</span> {up(cfg?.uf)}
                  </td>
                  <td colSpan={2}>
                    <span className="rot">Município:</span> {up(cfg?.municipio)}
                  </td>
                </tr>
              </tbody>
            </table>

            <p style={{ fontWeight: 'bold', textAlign: 'center', margin: '8px 0 6px' }}>
              Relação do(s) Produto(s) Adquirido(s) pelo Produtor
            </p>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '28%' }}>Produto</th>
                  <th>Tipo</th>
                  <th>Unidade</th>
                  <th>Preço Unitário</th>
                  <th>Qtd Adquirida</th>
                  <th>Valor a Pagar</th>
                  <th>Data da Aquisição</th>
                </tr>
              </thead>
              <tbody>
                {t.linhas.map((l) => (
                  <tr key={`${l.productId}::${l.tipoCultivo}`}>
                    <td>{up(l.nome)}</td>
                    <td className="c">{cultivo(l.tipoCultivo)}</td>
                    <td className="c">{unidade.get(l.productId) ?? 'Kg'}</td>
                    <td className="r">{n2(l.precoUnitario)}</td>
                    <td className="r">{nQtd(l.quantidade)}</td>
                    <td className="r">{n2(l.valor)}</td>
                    <td className="c">{dataAq}</td>
                  </tr>
                ))}
                <tr className="tot">
                  <td colSpan={4} style={{ border: 'none' }}></td>
                  <td className="r">{nQtd(t.quantidadeTotal)}</td>
                  <td className="r">{n2(t.valorTotal)}</td>
                  <td style={{ border: 'none' }}></td>
                </tr>
              </tbody>
            </table>

            <div className="quebra" style={{ marginTop: 28 }}>
              <table>
                <tbody>
                  <tr>
                    <td className="ass" style={{ border: 'none', width: '50%' }}>
                      <p style={{ margin: 0 }}>
                        Atesto o recebimento dos produtos e suas respectivas quantidades descritos no Termo de
                        Recebimento e Aceitabilidade Nº {num}.
                      </p>
                      <div className="linha"></div>
                      <p style={{ margin: 0 }}>*Assinatura do Técnico Responsável</p>
                    </td>
                    <td className="ass" style={{ border: 'none', width: '50%' }}>
                      <p style={{ margin: 0 }}>
                        Atesto a entrega dos produtos e suas respectivas quantidades descritas no Termo de
                        Recebimento e Aceitabilidade Nº {num}.
                      </p>
                      <div className="linha"></div>
                      <p style={{ margin: 0 }}>*Assinatura do Produtor</p>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p style={{ marginTop: 28, fontSize: 9, textAlign: 'center', fontWeight: 'bold' }}>
                O cartão de pagamento do programa é de uso pessoal e instransferível. Nunca ceda o cartão ou informe a
                senha para outras pessoas. Reclamação, sugestão ou dúvida ligue (51) - 32183381
              </p>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                background: VERDE,
                color: '#fff',
                borderRadius: '6px 6px 0 0',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <Logo src={LOGO_ANNONAE} alt="Annonae" h={44} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 'bold' }}>ANNONAE</div>
                <div style={{ fontSize: 9, opacity: 0.85 }}>Gestão de Banco de Alimentos</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9, color: OURO }}>TERMO DE RECEBIMENTO · PAA</div>
                <div style={{ fontSize: 15, fontWeight: 'bold' }}>Nº {num}</div>
              </div>
            </div>
            <div style={{ height: 3, background: OURO, marginBottom: 6 }} />
            <p style={{ fontSize: 9, color: VINHO, textAlign: 'right', margin: '0 0 14px' }}>
              Documento interno · não substitui o Termo emitido no SISPAA
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="card">
                <div className="k">Produtor</div>
                <div className="v">{t.producer.name}</div>
                <div style={{ fontSize: 10, color: CINZA, marginTop: 3 }}>
                  CPF {t.producer.cpf ?? '—'} · CAF/DAP {t.producer.dapCaf ?? '—'}
                </div>
              </div>
              <div className="card">
                <div className="k">Unidade executora</div>
                <div className="v">{cfg?.unidadeExecutora ?? '—'}</div>
                <div style={{ fontSize: 10, color: CINZA, marginTop: 3 }}>
                  {cfg?.municipio ?? ''}/{cfg?.uf ?? ''} · Plano {cfg?.planoOperacional ?? '—'}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 10 }}>
              <div className="card">
                <div className="k">Data do Termo</div>
                <div className="v">{dataAq}</div>
              </div>
              <div className="card">
                <div className="k">Nota fiscal</div>
                <div className="v">{t.notaFiscal || '—'}</div>
              </div>
              <div className="card">
                <div className="k">Ateste</div>
                <div className="v">{civilBR(t.dataAteste) || '—'}</div>
              </div>
              <div className="card" style={{ borderColor: OURO, background: '#FBF6E3' }}>
                <div className="k">Valor total</div>
                <div className="v" style={{ color: VINHO }}>R$ {n2(t.valorTotal)}</div>
              </div>
            </div>

            <h2>Resumo por produto</h2>
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Cultivo</th>
                  <th className="r">Quantidade</th>
                  <th className="r">Peso (kg)</th>
                  <th className="r">Preço</th>
                  <th className="r">Valor (R$)</th>
                </tr>
              </thead>
              <tbody>
                {t.linhas.map((l) => (
                  <tr key={`${l.productId}::${l.tipoCultivo}`}>
                    <td>{l.nome}</td>
                    <td>{l.tipoCultivo === 'ORGANICO' ? 'Orgânico' : 'Convencional'}</td>
                    <td className="r">
                      {nQtd(l.quantidade)} {unidade.get(l.productId) ?? 'Kg'}
                    </td>
                    <td className="r">{n3(l.pesoKg)}</td>
                    <td className="r">{n2(l.precoUnitario)}</td>
                    <td className="r">{n2(l.valor)}</td>
                  </tr>
                ))}
                <tr className="tot">
                  <td colSpan={2}>Total</td>
                  <td className="r">{nQtd(t.quantidadeTotal)}</td>
                  <td className="r">{n3(t.pesoTotalKg)}</td>
                  <td></td>
                  <td className="r">{n2(t.valorTotal)}</td>
                </tr>
              </tbody>
            </table>

            <h2>Entregas vinculadas ({t.entregas.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Itens</th>
                  <th className="r">Peso (kg)</th>
                  <th className="r">Valor (R$)</th>
                  <th>Assinada em</th>
                </tr>
              </thead>
              <tbody>
                {t.entregas.map((e) => (
                  <tr key={e.id} className="quebra">
                    <td style={{ whiteSpace: 'nowrap' }}>{civilBR(e.dataEntrega)}</td>
                    <td>
                      {e.itens
                        .map(
                          (i) =>
                            `${i.product.name}${i.tipoCultivo === 'ORGANICO' ? ' (org.)' : ''} ${nQtd(i.quantidade)} ${i.product.paaUnidade || 'Kg'}`,
                        )
                        .join(' · ')}
                    </td>
                    <td className="r">{n3(e.pesoTotalKg)}</td>
                    <td className="r">{n2(e.valorTotal)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{e.assinaturaEm ? dtBR(e.assinaturaEm) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {t.observacaoInterna && (
              <div className="quebra">
                <h2>Observação interna</h2>
                <div className="card" style={{ whiteSpace: 'pre-line', borderColor: OURO }}>
                  {t.observacaoInterna}
                </div>
              </div>
            )}

            <div
              style={{
                marginTop: 24,
                paddingTop: 8,
                borderTop: `1px solid ${OURO}`,
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 9,
                color: CINZA,
              }}
            >
              <span>
                Registrado por {t.registradoPor?.name ?? '—'} em {dtBR(t.registradoEm)}
              </span>
              <span>
                Gerado em {dtBR(new Date().toISOString())} · <b style={{ color: VERDE }}>annonae.com.br</b>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )

  return createPortal(conteudo, portal)
}
