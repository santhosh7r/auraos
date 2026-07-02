"use client";

import * as React from "react";
import { toast } from "sonner";

type Id = string;

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json as T;
}

export interface ResourceApi<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (payload: Partial<T> & Record<string, unknown>) => Promise<T | null>;
  update: (id: Id, payload: Partial<T> & Record<string, unknown>) => Promise<T | null>;
  remove: (id: Id) => Promise<boolean>;
}

/**
 * Client hook for a REST resource backed by MongoDB.
 * `base` examples: "/api/r/clients", "/api/team".
 */
export function useResource<T extends { id: string }>(base: string): ResourceApi<T> {
  const [data, setData] = React.useState<T[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const json = await http<{ data: T[] }>(base);
      setData(json.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [base]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = React.useCallback(
    async (payload: Record<string, unknown>) => {
      try {
        const json = await http<{ data: T }>(base, { method: "POST", body: JSON.stringify(payload) });
        setData((d) => [json.data, ...d]);
        toast.success("Created");
        return json.data;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to create");
        return null;
      }
    },
    [base]
  );

  const update = React.useCallback(
    async (id: Id, payload: Record<string, unknown>) => {
      try {
        const json = await http<{ data: T }>(`${base}/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
        setData((d) => d.map((x) => (x.id === id ? json.data : x)));
        toast.success("Saved");
        return json.data;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save");
        return null;
      }
    },
    [base]
  );

  const remove = React.useCallback(
    async (id: Id) => {
      try {
        await http(`${base}/${id}`, { method: "DELETE" });
        setData((d) => d.filter((x) => x.id !== id));
        toast.success("Deleted");
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to delete");
        return false;
      }
    },
    [base]
  );

  return { data, loading, error, refresh, create, update, remove };
}
