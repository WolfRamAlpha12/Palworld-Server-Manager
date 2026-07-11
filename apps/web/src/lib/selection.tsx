"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "psm.selectedServerId";

type Ctx = {
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
};

const SelectionContext = createContext<Ctx | null>(null);

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedId, setSelectedIdState] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSelectedIdState(stored);
    } catch {
      // ignore
    }
  }, []);

  const setSelectedId = useCallback((id: string | null) => {
    setSelectedIdState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(
    () => ({ selectedId, setSelectedId }),
    [selectedId, setSelectedId],
  );

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelectedServer() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelectedServer requires SelectionProvider");
  return ctx;
}
