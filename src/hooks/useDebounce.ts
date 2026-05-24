import { useEffect, useState } from "react";

/**
 * Qiymatni debounce qiladi — foydalanuvchi yozishni to'xtatgandan keyin
 * `delay` ms o'tgach yangilangan qiymatni qaytaradi.
 * Qidiruv input'larida har keystroke'da re-render va filterlashni kamaytiradi.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
