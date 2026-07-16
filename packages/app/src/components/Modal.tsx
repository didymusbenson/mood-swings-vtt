import { useEffect, useState } from 'react';
import type React from 'react';

/** Shared modal shell: dimmed backdrop, click-outside / Escape to dismiss. */
function ModalShell({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="dbx-modal__backdrop" onClick={onClose} role="presentation">
      <div className="dbx-modal" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

interface PromptModalProps {
  title: string;
  label: string;
  initialValue?: string;
  confirmLabel?: string;
  placeholder?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/** A modal that asks for a single line of text (replaces window.prompt). */
export function PromptModal({ title, label, initialValue = '', confirmLabel = 'Save', placeholder, onConfirm, onCancel }: PromptModalProps) {
  const [value, setValue] = useState(initialValue);
  const trimmed = value.trim();
  return (
    <ModalShell label={title} onClose={onCancel}>
      <header className="dbx-modal__head">
        <h3 className="dbx-modal__title">{title}</h3>
        <button type="button" className="dbx-modal__close" onClick={onCancel} aria-label="Close">
          ×
        </button>
      </header>
      <label className="modal-field">
        {label}
        <input
          autoFocus
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && trimmed) onConfirm(trimmed);
          }}
        />
      </label>
      <div className="dbx-import__actions">
        <button type="button" className="btn btn--primary" disabled={!trimmed} onClick={() => onConfirm(trimmed)}>
          {confirmLabel}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}

interface ConfirmModalProps {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A yes/no confirmation modal (replaces window.confirm). */
export function ConfirmModal({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <ModalShell label={title} onClose={onCancel}>
      <header className="dbx-modal__head">
        <h3 className="dbx-modal__title">{title}</h3>
        <button type="button" className="dbx-modal__close" onClick={onCancel} aria-label="Close">
          ×
        </button>
      </header>
      <p className="modal-message">{message}</p>
      <div className="dbx-import__actions">
        <button type="button" className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}
