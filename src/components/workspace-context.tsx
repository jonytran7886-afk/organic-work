"use client";
import { createContext, useContext } from "react";
type Row = Record<string, any>;
export type CacheEntry = { value: Row; at: number };
export const WorkspaceContext = createContext<{
  data: Row;
  refresh: () => Promise<void>;
  cache: Map<string, CacheEntry>;
  expire: () => void;
} | null>(null);
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("Thiếu layout không gian làm việc");
  return context;
}
