"use client";

import { useEffect, useRef, useState } from "react";
import AddressBar from "./components/AddressBar";
import AdvancedControls from "./components/AdvancedControls";
import InboxFeed from "./components/InboxFeed";
import SiteHeader from "./components/SiteHeader";
import { useInbox } from "./lib/useInbox";

const DEFAULT_DOMAIN = "kanop.site";
const HASH_KEY = "address";

function readAddressHash(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const value = params.get(HASH_KEY);
  return value ? decodeURIComponent(value) : null;
}

function writeAddressHash(address: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (address) {
    url.hash = `${HASH_KEY}=${encodeURIComponent(address)}`;
  } else {
    url.hash = "";
  }
  // Replace, not push: address swaps shouldn't pollute browser history.
  window.history.replaceState(null, "", url.toString());
}

export default function Home() {
  const { state, randomize, createCustom, openExisting, refresh } = useInbox();
  const bootstrappedRef = useRef(false);

  // On first mount: prefer #address=... (so the redirect shim from
  // /inbox/[address] works), otherwise generate a fresh random inbox.
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    const prefill = readAddressHash();
    if (prefill && prefill.includes("@")) {
      void openExisting(prefill);
    } else {
      void randomize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the URL in sync with the active address.
  useEffect(() => {
    if (!bootstrappedRef.current) return;
    writeAddressHash(state.address);
  }, [state.address]);

  const loading = state.status === "loading";

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="page-main">
        <section className="hero">
          <h1 className="hero-title">
            Temporary email, <span className="accent">streamed live.</span>
          </h1>
          <p className="hero-sub">
            Generate a throwaway address, paste it anywhere, and watch incoming
            mail in real time.
          </p>
        </section>

        <AddressBar
          address={state.address}
          loading={loading}
          onRandomize={() => randomize()}
        />

        <AdvancedControls
          defaultDomain={DEFAULT_DOMAIN}
          disabled={loading}
          onCreateCustom={(localPart, domain) =>
            void createCustom(localPart, domain)
          }
          onOpenExisting={(address) => void openExisting(address)}
        />

        {state.error ? (
          <div className="alert" role="alert">
            {state.error}
          </div>
        ) : null}

        <InboxFeed
          address={state.address}
          messages={state.messages}
          status={state.status}
          onRefresh={() => refresh()}
        />
      </main>
      <footer className="site-footer">
        <p>
          Copyright &copy; {new Date().getFullYear()} Rains. Made with Love. Learning purpose.
        </p>
      </footer>
    </div>
  );
}
