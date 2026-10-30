"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import type { OperationsData } from "./types";

export async function operationsFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const body = await response
    .json()
    .catch(() => ({ error: "The server returned an invalid response." }));
  if (!response.ok)
    throw new Error(body.error || "The operation could not be completed.");
  return body;
}
export function useOperations(property: string, organizationId: string) {
  const client = useQueryClient(),
    key = ["omniops", organizationId, property];
  const [connection, setConnection] = useState("Connecting"),
    [notice, setNotice] = useState("");
  const locked = useRef(false);
  const pendingRequest = useRef<{ fingerprint: string; id: string } | null>(
    null,
  );
  const query = useQuery<OperationsData>({
    queryKey: key,
    queryFn: ({ signal }) =>
      operationsFetch("/api/operations?" + new URLSearchParams({ property }), {
        signal,
      }),
    staleTime: 60000,
    gcTime: 300000,
    placeholderData: (previousData) => previousData,
    refetchInterval: 30000,
    retry: 1,
  });
  const mutation = useMutation({
    mutationFn: async (input: {
      action: string;
      data: Record<string, unknown>;
      legacy?: boolean;
      requestId: string;
    }) => {
      if (!navigator.onLine)
        throw new Error(
          "You are offline. Reconnect before saving; no work has been submitted.",
        );
      return operationsFetch(
        input.legacy ? "/api/hospitality" : "/api/operations",
        {
          method: input.legacy
            ? input.action === "job_create"
              ? "POST"
              : "PATCH"
            : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            input.legacy
              ? { action: "job", ...input.data }
              : {
                  action: input.action,
                  data: input.data,
                  requestId: input.requestId,
                },
          ),
        },
      );
    },
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<OperationsData>(key);
      if (input.legacy && input.action === "job" && previous) {
        client.setQueryData<OperationsData>(key, {
          ...previous,
          jobs: previous.jobs.map((job) =>
            job.id === input.data.id
              ? {
                  ...job,
                  ...(input.data.status
                    ? { status: String(input.data.status) }
                    : {}),
                  ...(input.data.acknowledge
                    ? { acknowledged_at: new Date().toISOString() }
                    : {}),
                }
              : job,
          ),
        });
      }
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) client.setQueryData(key, context.previous);
      setNotice(error.message);
    },
    onSettled: () =>
      client.invalidateQueries({ queryKey: ["omniops", organizationId] }),
  });
  const mutate = useCallback(
    async (action: string, data: Record<string, unknown>, legacy = false) => {
      if (locked.current) return null;
      locked.current = true;
      setNotice("");
      const fingerprint = JSON.stringify({ action, data, legacy });
      if (pendingRequest.current?.fingerprint !== fingerprint)
        pendingRequest.current = { fingerprint, id: crypto.randomUUID() };
      try {
        const result = await mutation.mutateAsync({
          action,
          data,
          legacy,
          requestId: pendingRequest.current.id,
        });
        pendingRequest.current = null;
        return result;
      } catch {
        return null;
      } finally {
        locked.current = false;
      }
    },
    [mutation.mutateAsync],
  );
  useEffect(() => {
    let disposed = false;
    let realtime: ReturnType<typeof createClient> | undefined;
    let refresh: ReturnType<typeof setInterval> | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    async function connect() {
      try {
        const auth = await operationsFetch("/api/operations/realtime");
        if (disposed) return;
        if (!auth.url || !auth.key) {
          setConnection("Polling · realtime not configured");
          return;
        }
        realtime = createClient(auth.url, auth.key, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        });
        await realtime.realtime.setAuth(auth.token);
        const channel = realtime.channel(
          `operations:${organizationId}:${property}`,
        );
        for (const table of [
          "service_jobs",
          "hotel_rooms",
          "room_inspections",
          "luggage_logs",
          "valet_tickets",
          "breakfast_attendance",
          "telephony_events",
          "maintenance_tasks",
          "audit_trails",
        ]) {
          channel.on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table,
              filter: `organization_id=eq.${organizationId}`,
            },
            () => {
              clearTimeout(debounce);
              debounce = setTimeout(
                () =>
                  client.invalidateQueries({
                    queryKey: ["omniops", organizationId],
                  }),
                200,
              );
            },
          );
        }
        channel.subscribe((status) => {
          if (!disposed)
            setConnection(
              status === "SUBSCRIBED"
                ? "Live"
                : status === "CHANNEL_ERROR" || status === "TIMED_OUT"
                  ? "Reconnecting · 30s polling"
                  : "Connecting",
            );
        });
        refresh = setInterval(async () => {
          try {
            const auth = await operationsFetch("/api/operations/realtime");
            if (!disposed) await realtime?.realtime.setAuth(auth.token);
          } catch {
            if (!disposed) setConnection("Session refresh needed");
          }
        }, 60000);
      } catch {
        if (!disposed) setConnection("30s polling");
      }
    }
    if ("serviceWorker" in navigator)
      navigator.serviceWorker
        .register("/ops-sw.js", { scope: "/" })
        .catch(() => {});
    connect();
    const onOffline = () => setConnection("Offline · saves disabled");
    const onOnline = () => {
      setConnection("Reconnecting");
      client.invalidateQueries({ queryKey: ["omniops", organizationId] });
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      disposed = true;
      clearInterval(refresh);
      clearTimeout(debounce);
      realtime?.removeAllChannels();
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [organizationId, property, client]);
  return {
    ...query,
    mutate,
    busy: mutation.isPending,
    notice,
    setNotice,
    connection,
    refresh: () => client.invalidateQueries({ queryKey: key }),
  };
}
