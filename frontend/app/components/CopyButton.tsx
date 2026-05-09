"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

type CopyButtonProps = {
  text: string;
  label?: string;
  size?: "sm" | "md";
};

export default function CopyButton({
  text,
  label,
  size = "md",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers or non-HTTPS network IPs
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);
        
        if (!successful) throw new Error("Fallback copy failed");
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  const dim = size === "sm" ? 14 : 16;

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`btn-ghost inline-flex items-center gap-2 ${
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-2 text-sm"
      }`}
      aria-label={label ? `Copy ${label}` : "Copy"}
      title={label ? `Copy ${label}` : "Copy"}
    >
      <span className="relative inline-flex h-4 w-4 items-center justify-center">
        <Copy
          size={dim}
          className={`absolute transition-all duration-200 ${
            copied ? "scale-0 opacity-0" : "scale-100 opacity-100"
          }`}
        />
        <Check
          size={dim}
          strokeWidth={3}
          className={`absolute transition-all duration-200 ${
            copied ? "scale-100 opacity-100" : "scale-0 opacity-0"
          }`}
        />
      </span>
      {label ? <span>{copied ? "Copied" : label}</span> : null}
    </button>
  );
}
