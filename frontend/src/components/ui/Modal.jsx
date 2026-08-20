import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from '@/icons';
import { cn } from '@/utils';

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw]',
};

export const ModalClose = Dialog.Close;

export function Modal({
  open,
  onClose,
  onOpenChange,
  title,
  description,
  size = 'md',
  children,
  footer,
  hideClose = false,
  contentClassName,
  bodyClassName,
}) {
  const isOpen = open ?? true;

  const handleOpenChange = (v) => {
    if (!v) {
      if (onClose) onClose();
      else if (onOpenChange) onOpenChange(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md"
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              forceMount
              aria-describedby={undefined}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                className={cn(
                  'glass-elevated w-full overflow-hidden max-h-[90vh] flex flex-col',
                  SIZES[size],
                  contentClassName
                )}
              >
                {title ? (
                  <div className="divider-gradient-b relative flex items-center justify-between gap-3 bg-white/[0.03] px-4 py-3 shrink-0">
                    <div className="min-w-0">
                      <Dialog.Title className="font-semibold text-text truncate">{title}</Dialog.Title>
                      {description && (
                        <Dialog.Description className="text-xs text-text-muted mt-0.5">
                          {description}
                        </Dialog.Description>
                      )}
                    </div>
                    {!hideClose && (
                      <Dialog.Close asChild>
                        <button
                          type="button"
                          aria-label="Tutup"
                          className="text-text-muted hover:text-text transition-colors rounded-btn p-1 hover:bg-white/[0.06] shrink-0"
                        >
                          <X size={18} />
                        </button>
                      </Dialog.Close>
                    )}
                  </div>
                ) : (
                  <>
                    <Dialog.Title className="sr-only">Dialog</Dialog.Title>
                    {!hideClose && (
                      <Dialog.Close asChild>
                        <button
                          type="button"
                          aria-label="Tutup"
                          className="absolute right-3 top-3 z-10 text-text-muted hover:text-text transition-colors rounded-btn p-1 hover:bg-white/[0.06]"
                        >
                          <X size={18} />
                        </button>
                      </Dialog.Close>
                    )}
                  </>
                )}

                <div className={cn('flex-1 overflow-y-auto', bodyClassName)}>{children}</div>

                {footer && (
                  <div className="relative flex items-center justify-end gap-2 border-t border-white/10 bg-white/[0.03] px-4 py-3 shrink-0">
                    {footer}
                  </div>
                )}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
