"use client";

import { Sparkles } from "lucide-react";
import CopyButton from "./CopyButton";

type AddressBarProps = {
  address: string | null;
  loading: boolean;
  onRandomize: () => void;
};

export default function AddressBar({
  address,
  loading,
  onRandomize,
}: AddressBarProps) {
  return (
    <section className="surface address-card">
      <div className="address-row">
        <div className="address-text-wrap">
          <span className="eyebrow">Your temporary inbox</span>
          <div className="address-text" title={address ?? undefined}>
            {address ?? (
              <span className="address-placeholder">generating address…</span>
            )}
          </div>
        </div>
        <div className="address-actions shrink-0">
          {address ? <CopyButton text={address} label="Copy" /> : null}
          <button
            type="button"
            className="btn-primary"
            onClick={onRandomize}
            disabled={loading}
          >
            <Sparkles size={14} />
            <span>Randomize</span>
          </button>
        </div>
      </div>
    </section>
  );
}
