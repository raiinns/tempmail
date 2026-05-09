"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getEmailsByRecipient, type Email } from "./api";
import { DOMAINS } from "../components/DomainSelector";

function randomDomain(): string {
  return DOMAINS[Math.floor(Math.random() * DOMAINS.length)];
}

export type InboxStatus = "idle" | "loading" | "ready" | "error";

export type InboxState = {
  address: string | null;
  status: InboxStatus;
  messages: Email[];
  error: string | null;
};

type InboxControls = {
  state: InboxState;
  randomize: (domain?: string) => void;
  createCustom: (localPart: string, domain?: string) => void;
  openExisting: (address: string) => void;
  refresh: () => Promise<void>;
};

const POLL_INTERVAL_MS = 10_000;

function randomString(length = 10): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function useInbox(): InboxControls {
  const [state, setState] = useState<InboxState>({
    address: null,
    status: "idle",
    messages: [],
    error: null,
  });

  const addressRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchMessages = useCallback(async (address: string) => {
    try {
      const data = await getEmailsByRecipient(address);
      if (addressRef.current !== address) return;
      setState((prev) =>
        prev.address === address
          ? { ...prev, messages: Array.isArray(data) ? data : [], status: "ready", error: null }
          : prev
      );
    } catch (err) {
      if (addressRef.current !== address) return;
      const message =
        err instanceof Error ? err.message : "Failed to fetch emails";
      setState((prev) =>
        prev.address === address
          ? { ...prev, status: "error", error: message }
          : prev
      );
    }
  }, []);

  const startPolling = useCallback(
    (address: string) => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      void fetchMessages(address);
      pollRef.current = setInterval(() => {
        if (addressRef.current === address) {
          void fetchMessages(address);
        }
      }, POLL_INTERVAL_MS);
    },
    [fetchMessages]
  );

  const teardown = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const switchAddress = useCallback(
    async (newAddress: string) => {
      teardown();
      addressRef.current = newAddress;
      setState({
        address: newAddress,
        status: "loading",
        messages: [],
        error: null,
      });
      await fetchMessages(newAddress);
      if (addressRef.current === newAddress) {
        startPolling(newAddress);
      }
    },
    [teardown, fetchMessages, startPolling]
  );

  const randomize = useCallback(
    (domain?: string) => {
      const addr = `${randomString()}@${domain || randomDomain()}`;
      void switchAddress(addr);
    },
    [switchAddress]
  );

  const createCustom = useCallback(
    (localPart: string, domain?: string) => {
      const addr = `${localPart}@${domain || "kanop.site"}`;
      void switchAddress(addr);
    },
    [switchAddress]
  );

  const openExisting = useCallback(
    (address: string) => {
      void switchAddress(address.trim().toLowerCase());
    },
    [switchAddress]
  );

  const refresh = useCallback(async () => {
    const addr = addressRef.current;
    if (!addr) return;
    await fetchMessages(addr);
  }, [fetchMessages]);

  useEffect(() => {
    return () => {
      teardown();
    };
  }, [teardown]);

  return { state, randomize, createCustom, openExisting, refresh };
}
