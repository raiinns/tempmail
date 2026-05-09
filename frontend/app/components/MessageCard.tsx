"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileText, Paperclip, User } from "lucide-react";
import type { Email } from "../lib/api";

type MessageCardProps = {
  message: Email;
};

const IFRAME_PRELUDE = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>
  html,body{margin:0;padding:0;background:transparent;color:#09090b;font:14px/1.55 -apple-system,BlinkMacSystemFont,Segoe UI,Inter,Roboto,sans-serif;}
  body{padding:8px 4px;}
  img,table{max-width:100%!important;height:auto!important;}
  a{color:#0b5fff;}
  blockquote{margin:0;padding:0 0 0 12px;border-left:2px solid #e4e4e7;color:#52525b;}
  pre,code{white-space:pre-wrap;word-break:break-word;}
</style></head><body>`;

const IFRAME_POSTLUDE = `<script>(function(){
  function sendHeight(){
    try{
      var h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, 80);
      parent.postMessage({ __tempmailHeight: true, h: h, id: ${"%%ID%%"} }, "*");
    }catch(e){}
  }
  window.addEventListener("load", sendHeight);
  if(window.ResizeObserver){ new ResizeObserver(sendHeight).observe(document.body); }
  setTimeout(sendHeight, 200);
  setTimeout(sendHeight, 800);
})();<\/script></body></html>`;

function buildSrcDoc(html: string, id: number): string {
  return (
    IFRAME_PRELUDE + html + IFRAME_POSTLUDE.replace("%%ID%%", JSON.stringify(id))
  );
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageCard({ message }: MessageCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [iframeHeight, setIframeHeight] = useState<number>(120);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!message.bodyHtml) return;
    function onMsg(ev: MessageEvent) {
      const data = ev.data;
      if (
        !data ||
        typeof data !== "object" ||
        !(data as Record<string, unknown>).__tempmailHeight ||
        (data as Record<string, unknown>).id !== message.id
      ) {
        return;
      }
      const h = Number((data as { h: number }).h);
      if (!Number.isFinite(h)) return;
      // Clamp to a sane maximum so a runaway email can't push the page off-screen.
      setIframeHeight(Math.min(Math.max(h, 80), 4000));
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [message.id, message.bodyHtml]);

  return (
    <article className={`message-card ${expanded ? "open" : "collapsed"}`}>
      <header className="message-header">
        <span className="avatar" aria-hidden>
          <User size={14} />
        </span>
        <div className="message-meta">
          <div className="message-from">{message.fromAddress || "Unknown sender"}</div>
          <div className="message-subject">
            {message.subject || "(No subject)"}
          </div>
        </div>
        <div className="message-side">
          <time className="message-time" dateTime={message.receivedAt}>
            {formatTimestamp(message.receivedAt)}
          </time>
          <div className="message-badges">
            {message.bodyHtml ? <span className="badge">HTML</span> : null}
            {!message.bodyHtml && message.bodyText ? (
              <span className="badge">
                <FileText size={11} />
                Text
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="message-toggle"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse message" : "Expand message"}
          >
            <ChevronDown
              size={14}
              className={`chev ${expanded ? "open" : ""}`}
            />
          </button>
        </div>
      </header>
      {expanded ? (
        <div className="message-body">
          {message.bodyHtml ? (
            <iframe
              ref={iframeRef}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              srcDoc={buildSrcDoc(message.bodyHtml, message.id)}
              style={{ height: iframeHeight }}
              className="message-frame"
              title={`Email: ${message.subject || "no subject"}`}
            />
          ) : message.bodyText ? (
            <pre className="message-text">{message.bodyText}</pre>
          ) : (
            <p className="message-empty">No readable content.</p>
          )}
        </div>
      ) : null}
    </article>
  );
}
