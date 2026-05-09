"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import DomainSelector from "./DomainSelector";

type AdvancedControlsProps = {
  defaultDomain: string;
  disabled: boolean;
  onCreateCustom: (localPart: string, domain: string) => void;
  onOpenExisting: (address: string) => void;
};

const LOCAL_PART_RE = /^[a-zA-Z0-9._-]+$/;

export default function AdvancedControls({
  defaultDomain,
  disabled,
  onCreateCustom,
  onOpenExisting,
}: AdvancedControlsProps) {
  const [localPart, setLocalPart] = useState("");
  const [domain, setDomain] = useState(defaultDomain);
  const [openAddress, setOpenAddress] = useState("");

  const localValid = localPart.length > 0 && LOCAL_PART_RE.test(localPart);
  const openValid = openAddress.includes("@") && openAddress.length > 2;

  return (
    <div className="advanced-grid">
      <form
        className="advanced-section"
        onSubmit={(e) => {
          e.preventDefault();
          if (!localValid || disabled) return;
          onCreateCustom(localPart.trim(), domain);
        }}
      >
        <span className="section-label">Create custom inbox</span>
        <div className="field-row">
          <input
            className="field flex-1 min-w-0"
            placeholder="username"
            value={localPart}
            onChange={(e) => setLocalPart(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          <span className="field-suffix shrink-0">@</span>
          <DomainSelector className="flex-1 min-w-0" value={domain} onChange={setDomain} />
        </div>
        <button
          type="submit"
          className="btn-primary"
          disabled={disabled || !localValid}
        >
          Create
          <ArrowRight size={14} />
        </button>
      </form>

      <form
        className="advanced-section"
        onSubmit={(e) => {
          e.preventDefault();
          if (!openValid || disabled) return;
          onOpenExisting(openAddress.trim());
        }}
      >
        <span className="section-label">Open existing inbox</span>
        <input
          className="field"
          placeholder="name@kanop.site"
          value={openAddress}
          onChange={(e) => setOpenAddress(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={disabled || !openValid}
        >
          Open
          <ArrowRight size={14} />
        </button>
      </form>
    </div>
  );
}
