"use client";

import { createContext, useCallback, useContext, useState } from "react";

type Toast = { id: number; message: string; error?: boolean };

type Ctx = {
  toast: (message: string, opts?: { error?: boolean }) => void;
};

const ToastContext = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const toast = useCallback((message: string, opts?: { error?: boolean }) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, message, error: opts?.error }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {items.map((t) => (
        <div key={t.id} className={`toast${t.error ? " error" : ""}`}>
          {t.message}
        </div>
      ))}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast requires ToastProvider");
  return ctx;
}
