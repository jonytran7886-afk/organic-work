"use client";
import { useEffect, useState } from "react";
import type { CacheEntry } from "./workspace-context";
type Row = Record<string, any>;
const MAX_ENTRIES = 24,
  MAX_AGE = 30000;
export function useQueryResource(
  url: string | null,
  cache: Map<string, CacheEntry>,
  revision: unknown,
  expire: () => void,
) {
  const principal = (revision as { user?: Row } | null)?.user;
  const key = url
    ? [principal?._id, principal?.role, principal?.departmentId, url].join(":")
    : null;
  function cached() {
    if (!key) return null;
    const entry = cache.get(key);
    return entry && Date.now() - entry.at < MAX_AGE ? entry.value : null;
  }
  const [state, setState] = useState<{
      key: string | null;
      data: Row | null;
      pending: boolean;
      error: string;
    }>({ key, data: cached(), pending: Boolean(url), error: "" }),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    setState((previous) => ({
      key,
      data: cached() || (previous.key === key ? previous.data : null),
      pending: true,
      error: "",
    }));
    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const value = await response.json();
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          expire();
          throw new Error("Vui lòng đăng nhập");
        }
        if (!response.ok)
          throw new Error(value.error || "Không thể tải dữ liệu");
        if (controller.signal.aborted) return;
        if (cache.size >= MAX_ENTRIES && !cache.has(key!))
          cache.delete(cache.keys().next().value!);
        cache.set(key!, { value, at: Date.now() });
        setState({ key, data: value, pending: false, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          cache.delete(key!);
          setState({
            key,
            data: null,
            pending: false,
            error: error.message || "Không thể tải dữ liệu",
          });
        }
      });
    return () => controller.abort();
  }, [url, key, cache, revision, retry, expire]);
  return {
    data: url ? (state.key === key ? state.data : cached()) : null,
    pending: Boolean(url) && (state.key !== key || state.pending),
    error: url && state.key === key ? state.error : "",
    retry: () => setRetry((v) => v + 1),
  };
}
