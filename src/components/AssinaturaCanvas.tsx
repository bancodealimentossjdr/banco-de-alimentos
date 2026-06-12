'use client'

import {
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
  useEffect,
  useCallback,
} from 'react'
import SignatureCanvas from 'react-signature-canvas'

export interface AssinaturaCanvasRef {
  /** Retorna a assinatura como data URL (PNG base64) ou null se vazia */
  toDataURL: () => string | null
  /** Limpa o canvas */
  clear: () => void
  /** Indica se o canvas está vazio */
  isEmpty: () => boolean
}

interface AssinaturaCanvasProps {
  /** Callback disparado quando o usuário começa/termina de desenhar */
  onChange?: (isEmpty: boolean) => void
}

const AssinaturaCanvas = forwardRef<AssinaturaCanvasRef, AssinaturaCanvasProps>(
  function AssinaturaCanvas({ onChange }, ref) {
    const sigRef = useRef<SignatureCanvas>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [hasSignature, setHasSignature] = useState(false)

    useImperativeHandle(ref, () => ({
      toDataURL: () => {
        if (!sigRef.current || sigRef.current.isEmpty()) return null
        return sigRef.current.getCanvas().toDataURL('image/png')
      },
      clear: () => {
        sigRef.current?.clear()
        setHasSignature(false)
        onChange?.(true)
      },
      isEmpty: () => sigRef.current?.isEmpty() ?? true,
    }))

    /**
     * 🔧 Ajusta o tamanho INTERNO do canvas para casar com o tamanho CSS,
     * aplicando o devicePixelRatio (nitidez em telas retina).
     * Preserva o traçado existente: salva → redimensiona → restaura.
     */
    const resizeCanvas = useCallback(() => {
      const sig = sigRef.current
      const container = containerRef.current
      if (!sig || !container) return

      const canvas = sig.getCanvas()

      // 1️⃣ Salva o traçado atual (se houver)
      const wasEmpty = sig.isEmpty()
      const saved = wasEmpty ? null : canvas.toDataURL('image/png')

      // 2️⃣ Calcula dimensões reais a partir do container
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      const { width, height } = container.getBoundingClientRect()
      if (width === 0 || height === 0) return

      // 3️⃣ Redimensiona o bitmap interno (isso zera o desenho)
      canvas.width = width * ratio
      canvas.height = height * ratio

      const ctx = canvas.getContext('2d')
      if (ctx) {
        // Reseta a transform antes de escalar (evita acúmulo no giro)
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.scale(ratio, ratio)
      }

      // 4️⃣ Restaura o traçado salvo
      if (saved) {
        const img = new window.Image()
        img.onload = () => {
          ctx?.drawImage(img, 0, 0, width, height)
        }
        img.src = saved
      } else {
        sig.clear()
      }
    }, [])

    // 🔄 Ajuste inicial + listeners de resize/giro (com debounce)
    useEffect(() => {
      resizeCanvas()

      let timer: ReturnType<typeof setTimeout>
      const handleResize = () => {
        clearTimeout(timer)
        // pequeno delay para o layout refluir antes de medir
        timer = setTimeout(resizeCanvas, 150)
      }

      window.addEventListener('resize', handleResize)
      window.addEventListener('orientationchange', handleResize)

      return () => {
        clearTimeout(timer)
        window.removeEventListener('resize', handleResize)
        window.removeEventListener('orientationchange', handleResize)
      }
    }, [resizeCanvas])

    function handleEnd() {
      const empty = sigRef.current?.isEmpty() ?? true
      setHasSignature(!empty)
      onChange?.(empty)
    }

    function handleClear() {
      sigRef.current?.clear()
      setHasSignature(false)
      onChange?.(true)
    }

    return (
      <div className="w-full">
        <div
          ref={containerRef}
          className="relative h-[260px] w-full overflow-hidden rounded-xl border-2 border-dashed border-green-300 bg-white"
        >
          <SignatureCanvas
            ref={sigRef}
            penColor="#1f2937"
            onEnd={handleEnd}
            canvasProps={{
              className: 'absolute inset-0 h-full w-full touch-none',
            }}
          />

          {/* Placeholder central quando vazio */}
          {!hasSignature && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-green-400">
              <svg
                className="mb-2 h-10 w-10"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                />
              </svg>
              <span className="text-sm font-medium">Assine no espaço acima</span>
            </div>
          )}

          {/* Linha-base de assinatura */}
          <div className="pointer-events-none absolute bottom-10 left-6 right-6 border-b border-gray-300" />
        </div>

        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Use o dedo (toque) ou o mouse para assinar.
          </span>
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Limpar
          </button>
        </div>
      </div>
    )
  },
)

export default AssinaturaCanvas
