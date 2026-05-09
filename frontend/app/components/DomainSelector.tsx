"use client";

import { ChevronDown } from "lucide-react";

export const DOMAINS = [ // change to your domain
  "yourdomain.com",
  "yourdomain.com",
  "yourdomain.com",
  "yourdomain.com",
  "yourdomain.com",
];

type DomainSelectorProps = {
  value: string;
  onChange: (domain: string) => void;
  className?: string;
};

export default function DomainSelector({
  value,
  onChange,
  className = "",
}: DomainSelectorProps) {
  return (
    <div className={`field-wrap ${className}`}>
      <select
        className="field appearance-none truncate"
        style={{ paddingRight: "36px" }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {DOMAINS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-fg-muted)]"
      />
    </div>
  );
}
