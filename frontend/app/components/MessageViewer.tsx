"use client";

import { useEffect, useState } from "react";
import { X, User } from "lucide-react";

export default function MessageViewer({
  messageId,
  onClose,
}: {
  messageId: string;
  onClose: () => void;
}) {
  const [message, setMessage] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/messages/${messageId}`)
      .then((r) => r.json())
      .then((data) => {
        setMessage(data);
        setLoading(false);
      });
  }, [messageId]);

  if (loading || !message) return (
    <div className="flex h-full items-center justify-center text-sm text-gray-500">
      <div className="animate-pulse flex flex-col items-center gap-2">
        <div className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-black animate-spin" />
        Loading message...
      </div>
    </div>
  );

  const htmlContent = message.htmlBody
    ? `<base target="_blank"><style>body{font-family:system-ui,sans-serif;padding:0;margin:0;color:#09090b;}</style>${message.htmlBody}`
    : null;

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5 shrink-0">
        <div className="flex items-start gap-4">
          <div className="hidden sm:flex mt-1 h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500">
             <User size={18} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 leading-tight">
              {message.subject || "(No subject)"}
            </h2>
            <div className="mt-1 text-sm font-medium text-gray-800">
              {message.from || "Unknown Sender"}
            </div>
            <div className="mt-0.5 text-xs text-gray-400">
               {new Date(message.receivedAt).toLocaleString(undefined, {
                 weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
               })}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          aria-label="Close message"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-white/40">
        {htmlContent ? (
          <iframe
            sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
            srcDoc={htmlContent}
            className="h-full min-h-[500px] w-full border-0"
            title="email-content"
          />
        ) : message.textBody ? (
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800">
            {message.textBody}
          </pre>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-400 italic">
            No readable content available.
          </div>
        )}
      </div>
    </div>
  );
}
