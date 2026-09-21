import React, { useEffect, useRef, useState } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: number;
  closeOnBackdrop?: boolean;
  fill?: boolean; // 余白なしでほぼ全画面に表示(PDFプレビュー用)
}

export function Modal({ open, onClose, title, children, maxWidth = 480, closeOnBackdrop = true, fill = false }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fillRef = useRef<HTMLDivElement>(null); // dialog自体はフルスクリーン不可(仕様)のため中身に対して要求する
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  const toggleFullscreen = () => {
    const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
    const el = fillRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      if (doc.exitFullscreen) doc.exitFullscreen();
      else doc.webkitExitFullscreen?.();
    } else if (el) {
      if (el.requestFullscreen) el.requestFullscreen();
      else el.webkitRequestFullscreen?.();
    }
  };

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={e => { if (closeOnBackdrop && e.target === dialogRef.current) onClose(); }}
      style={{
        border: 'none',
        borderRadius: isFullscreen ? 0 : 8,
        padding: fill ? 0 : 24,
        maxWidth: fill ? '80vw' : maxWidth,
        width: fill ? '80vw' : '90%',
        height: fill ? '96vh' : undefined,
        overflow: fill ? 'hidden' : undefined,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        margin: 0,
      }}
    >
      {fill ? (
        <div ref={fillRef} style={{ position: 'relative', width: '100%', height: '100%', background: '#fff' }}>
          <div style={{ position: 'absolute', top: 8, right: 12, zIndex: 1, display: 'flex', gap: 6 }}>
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? '全画面を終了' : '全画面表示'}
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(255,255,255,0.9)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
                cursor: 'pointer',
                fontSize: 14,
                color: '#374151',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isFullscreen ? '⤡' : '⤢'}
            </button>
            <button
              onClick={onClose}
              title="閉じる"
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(255,255,255,0.9)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
                cursor: 'pointer',
                fontSize: 16,
                color: '#374151',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ×
            </button>
          </div>
          {children}
        </div>
      ) : (
        <>
          {title && <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#374151', lineHeight: 1.5 }}>{title}</h3>}
          {children}
        </>
      )}
    </dialog>
  );
}
