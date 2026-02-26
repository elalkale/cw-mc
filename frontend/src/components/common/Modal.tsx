import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Contenido del modal */
  children: React.ReactNode;
  /** Ancho máximo Tailwind (p.ej. 'max-w-md'). Por defecto: 'max-w-md' */
  maxWidth?: string;
  darkMode?: boolean;
}

/**
 * Modal accesible reutilizable.
 * - role="dialog" + aria-modal="true"
 * - Focus trap activado mientras está abierto
 * - Cierre con Escape
 * - Click en backdrop cierra el modal
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 'max-w-md',
  darkMode = false,
}: ModalProps) {
  const containerRef = useFocusTrap(open);

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Bloquear scroll del body mientras está abierto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={containerRef as React.RefObject<HTMLDivElement>}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative w-full ${maxWidth} rounded-2xl shadow-2xl border
          ${darkMode
            ? 'bg-gray-900 border-gray-700 text-white'
            : 'bg-white border-gray-200 text-gray-900'
          }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-5 border-b
          ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}
        >
          <h2
            id="modal-title"
            className="text-lg font-semibold"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className={`p-1.5 rounded-lg transition-colors
              ${darkMode
                ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'
              }`}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
