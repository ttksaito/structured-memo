import React, { useEffect, useRef } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={e => { if (e.target === dialogRef.current) onClose(); }}
      style={{
        border: 'none',
        borderRadius: 8,
        padding: 24,
        maxWidth: 480,
        width: '90%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        margin: 0,
      }}
    >
      <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>{title}</h3>
      {children}
    </dialog>
  );
}
