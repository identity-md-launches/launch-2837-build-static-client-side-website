import { useCallback, useEffect, useRef, useState } from "react";
export function useResource<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
  interval: number,
  enabled = true,
) {
  const [state, setState] = useState<{
    key: string;
    data?: T;
    error: string;
    loading: boolean;
    updated: number;
  }>({ key, error: "", loading: enabled, updated: 0 });
  const [revision, setRevision] = useState(0);
  const loader = useRef(load);
  loader.current = load;
  useEffect(() => {
    if (!enabled) {
      setState({ key, error: "", loading: false, updated: 0 });
      return;
    }
    let active = true,
      pending = false;
    const controller = new AbortController();
    setState((s) =>
      s.key === key ? s : { key, error: "", loading: true, updated: 0 },
    );
    const run = async () => {
      if (pending) return;
      pending = true;
      setState((s) => ({ ...s, loading: true }));
      try {
        const data = await loader.current(controller.signal);
        if (active)
          setState({
            key,
            data,
            error: "",
            loading: false,
            updated: Date.now(),
          });
      } catch (e) {
        if (active)
          setState((s) => ({
            ...s,
            key,
            loading: false,
            error:
              e instanceof Error
                ? e.message
                : "Unable to load data. Check your connection and retry.",
          }));
      } finally {
        pending = false;
      }
    };
    void run();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void run();
    }, interval);
    const wake = () => {
      if (document.visibilityState === "visible") void run();
    };
    document.addEventListener("visibilitychange", wake);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [key, revision, interval, enabled]);
  return {
    ...(state.key === key
      ? state
      : { key, data: undefined, error: "", loading: enabled, updated: 0 }),
    refresh: useCallback(() => setRevision((n) => n + 1), []),
  };
}
export function useClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}
export function useRoute() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const change = () => {
      setHash(location.hash);
      window.scrollTo(0, 0);
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>("#page-title")?.focus(),
      );
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  return hash;
}
