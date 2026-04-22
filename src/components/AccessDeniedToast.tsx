'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import toast from 'react-hot-toast'

const moduleLabels: Record<string, string> = {
  produtos: 'Produtos',
  doadores: 'Doadores',
  beneficiarios: 'Beneficiários',
  funcionarios: 'Funcionários',
  produtores: 'Produtores',
  doacoes: 'Doações',
  distribuicoes: 'Distribuições',
  'colheita-solidaria': 'Colheita Solidária',
  estoque: 'Estoque',
  usuarios: 'Usuários',
}

function AccessDeniedToastInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const denied = searchParams.get('acesso_negado')
    if (!denied) return

    const moduleName = moduleLabels[denied] || denied
    toast.error(
      `Seu perfil não tem permissão para acessar "${moduleName}".`,
      {
        icon: '🔒',
        duration: 5000,
        style: {
          background: '#fef2f2',
          color: '#991b1b',
          border: '1px solid #fecaca',
          padding: '12px 16px',
        },
      }
    )

    // Limpa o parâmetro da URL pra não repetir o toast ao recarregar
    const params = new URLSearchParams(searchParams.toString())
    params.delete('acesso_negado')
    const newUrl = params.toString() ? `${pathname}?${params}` : pathname
    router.replace(newUrl, { scroll: false })
  }, [searchParams, router, pathname])

  return null
}

export default function AccessDeniedToast() {
  return (
    <Suspense fallback={null}>
      <AccessDeniedToastInner />
    </Suspense>
  )
}
