import { useId, type ReactNode } from 'react'
import Dialog from './Dialog'
import { btnDanger, btnPrimary, btnSecondary } from './ui'

interface ConfirmDialogProps {
  title: string
  children: ReactNode
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  onConfirm(): void
  onCancel(): void
}

export default function ConfirmDialog({ title, children, confirmLabel, cancelLabel = 'Cancel', danger, onConfirm, onCancel }: ConfirmDialogProps) {
  const id = useId()
  return (
    <Dialog
      title={title}
      onClose={onCancel}
      modal
      role="alertdialog"
      describedBy={id}
      width="sm:w-[400px]"
      // a destructive action starts on Cancel, so Enter cannot confirm it by accident
      footer={
        <>
          <button type="button" data-autofocus={danger || undefined} className={btnSecondary} onClick={onCancel}>{cancelLabel}</button>
          <button type="button" data-autofocus={!danger || undefined} className={danger ? btnDanger : btnPrimary} onClick={onConfirm}>{confirmLabel}</button>
        </>
      }
    >
      <div id={id} className="leading-relaxed">{children}</div>
    </Dialog>
  )
}
