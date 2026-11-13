import { useCallback, useState } from 'react';

export interface NoticeState {
  ok: boolean;
  text: string;
}

export function useAsyncAction() {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const run = useCallback(async <T>(fn: () => Promise<T>, successMessage?: string | ((result: T) => string)) => {
    setPending(true);
    setNotice(null);
    try {
      const result = await fn();
      if (successMessage) {
        const text = typeof successMessage === 'function' ? successMessage(result) : successMessage;
        setNotice({ ok: true, text });
      }
      return result;
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : String(err) });
      return undefined;
    } finally {
      setPending(false);
    }
  }, []);

  const clearNotice = useCallback(() => setNotice(null), []);

  return { pending, notice, setNotice, run, clearNotice };
}
