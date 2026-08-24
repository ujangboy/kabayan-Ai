/**
 * Tooltip — keterangan (title) konsisten untuk tombol icon-only di seluruh UI.
 * Berbasis @radix-ui/react-tooltip, sehingga konsisten di semua halaman.
 */
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/utils';

export function TooltipProvider({ children, delayDuration = 300 }) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

/**
 * Penggunaan:
 *   <Tooltip label="Hapus">
 *     <button className="p-1.5 ..."><Icon name={ICONS.actions.delete} size={16} /></button>
 *   </Tooltip>
 */
export function Tooltip({ label, children, side = 'top', align = 'center', ...props }) {
  if (!label) return children;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild {...props}>
        {children}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          className={cn(
            'z-[9999] px-2.5 py-1.5 rounded-lg text-xs font-medium text-text bg-slate-800/95 backdrop-blur-sm',
            'border border-white/10 shadow-xl select-none'
          )}
        >
          {label}
          <TooltipPrimitive.Arrow className="fill-slate-800" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}