"use client";

import { useState, useRef, useCallback } from "react";

interface UseFormSubmitOptions {
  /** Tempo mínimo de bloqueio em ms (evita "flash" rápido do botão). Padrão: 500ms */
  minLockMs?: number;
}

/**
 * Hook que protege formulários contra envios duplicados (duplo/triplo clique).
 *
 * COMO USAR:
 *   const { isSubmitting, handleSubmit } = useFormSubmit();
 *
 *   const onSalvar = () => {
 *     handleSubmit(async () => {
 *       await fetch("/api/doacoes", { method: "POST", body: JSON.stringify(data) });
 *       toast.success("Salvo!");
 *     });
 *   };
 *
 *   <button disabled={isSubmitting} onClick={onSalvar}>
 *     {isSubmitting ? "Salvando..." : "Salvar"}
 *   </button>
 */
export function useFormSubmit(options: UseFormSubmitOptions = {}) {
  const { minLockMs = 500 } = options;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lockRef = useRef(false); // trava síncrona — evita race condition do useState

  const handleSubmit = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
      // Se já está enviando, ignora cliques extras (essa é a "trava")
      if (lockRef.current) {
        return undefined;
      }

      lockRef.current = true;
      setIsSubmitting(true);
      const startedAt = Date.now();

      try {
        const result = await action();
        return result;
      } finally {
        // Garante tempo mínimo de bloqueio pra UX (sem "piscar" o botão)
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, minLockMs - elapsed);
        setTimeout(() => {
          lockRef.current = false;
          setIsSubmitting(false);
        }, remaining);
      }
    },
    [minLockMs]
  );

  return { isSubmitting, handleSubmit };
}
