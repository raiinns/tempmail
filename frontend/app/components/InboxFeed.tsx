"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, Inbox, RefreshCw, Check } from "lucide-react";
import type { Email } from "../lib/api";
import type { InboxStatus } from "../lib/useInbox";
import MessageCard from "./MessageCard";

type InboxFeedProps = {
  address: string | null;
  messages: Email[];
  status: InboxStatus;
  onRefresh: () => Promise<void>;
};

const STICK_THRESHOLD_PX = 120;

export default function InboxFeed({
  address,
  messages,
  status,
  onRefresh,
}: InboxFeedProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const lastSeenIdRef = useRef<number | null>(null);
  const [stick, setStick] = useState(true);
  const [unread, setUnread] = useState(0);
  const [refreshSuccess, setRefreshSuccess] = useState(false);

  // Track whether the user is at (or near) the bottom of the page.
  useEffect(() => {
    const onScroll = () => {
      const distanceFromBottom =
        document.documentElement.scrollHeight -
        window.scrollY -
        window.innerHeight;
      setStick(distanceFromBottom < STICK_THRESHOLD_PX);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // When new messages arrive, either auto-scroll (if pinned to bottom) or
  // bump the "N new" pill counter.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) {
      lastSeenIdRef.current = null;
      setUnread(0);
      return;
    }
    if (lastSeenIdRef.current === last.id) return;

    const isFirstBatch = lastSeenIdRef.current === null;
    lastSeenIdRef.current = last.id;

    if (stick || isFirstBatch) {
      // Defer to the next paint so the new card has rendered before scrolling.
      requestAnimationFrame(() => {
        sentinelRef.current?.scrollIntoView({
          behavior: isFirstBatch ? "auto" : "smooth",
          block: "end",
        });
      });
      setUnread(0);
    } else {
      setUnread((n) => n + 1);
    }
  }, [messages, stick]);

  const empty = messages.length === 0;
  const isLoading = status === "loading";

  return (
    <section className="inbox-feed" aria-live="polite">
      <header className="flex flex-row items-start justify-between gap-4 px-1 pt-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="feed-title">
            <Inbox size={14} />
            Inbox
            {messages.length > 0 ? (
              <span className="feed-count">{messages.length}</span>
            ) : null}
          </h2>
          <p className="feed-sub">
            {address
              ? "New messages appear here automatically."
              : "Generate an address to start receiving mail."}
          </p>
        </div>
        <button
          type="button"
          className={`btn-secondary whitespace-nowrap ${refreshSuccess ? "text-[var(--color-success)] border-[var(--color-success)]" : ""}`}
          onClick={async () => {
            await onRefresh();
            setRefreshSuccess(true);
            setTimeout(() => setRefreshSuccess(false), 2000);
          }}
          disabled={!address || isLoading || refreshSuccess}
          aria-label="Refresh inbox"
        >
          {refreshSuccess ? <Check size={14} /> : <RefreshCw size={14} className={isLoading ? "spin" : ""} />}
          <span>{refreshSuccess ? "Refreshed!" : "Refresh"}</span>
        </button>
      </header>

      {empty ? (
        <div className="empty-state">
          <span className="empty-mark" aria-hidden>
            <Inbox size={20} />
          </span>
          <p className="empty-title">
            {status === "loading"
              ? "Preparing inbox…"
              : "Listening for new mail"}
          </p>
          <p className="empty-sub">
            {address
              ? "Use this address anywhere — incoming emails will stream in below."
              : "Once an address is ready, messages will appear here."}
          </p>
        </div>
      ) : (
        <ol className="message-list">
          {messages.map((m) => (
            <li key={m.id} className="message-list-item">
              <MessageCard message={m} />
            </li>
          ))}
        </ol>
      )}

      <div ref={sentinelRef} className="feed-sentinel" aria-hidden />

      {!stick && unread > 0 ? (
        <button
          type="button"
          className="new-pill"
          onClick={() => {
            sentinelRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "end",
            });
            setUnread(0);
          }}
        >
          <ArrowDown size={14} />
          {unread} new {unread === 1 ? "message" : "messages"}
        </button>
      ) : null}
    </section>
  );
}
