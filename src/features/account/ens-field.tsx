import { cn } from 'cn'
import chevronIcon from '@/assets/figma/account-chevron.svg'

/** The layout offers only .eth; the fixed prefix is not a pretend dropdown. */
export function AccountEnsField({ id, value, onChange, error, className }: { id: string; value: string; onChange: (value: string) => void; error?: string; className?: string }) {
  return <div className={cn('flex flex-col gap-2.5', className)}>
    <label htmlFor={id} className="flex min-h-[29px] items-center text-[15px]">Nome ENS <span aria-hidden className="text-[22px] text-[#f0805f]">*</span></label>
    <div className="flex gap-2.5"><span className="flex h-10 w-[78px] shrink-0 items-center justify-around rounded-[3px] border border-border text-[15px]">.eth<img src={chevronIcon} alt="" width={20} height={20} /></span><input id={id} required aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} value={value.replace(/\.eth$/, '')} onChange={(e) => onChange(e.target.value ? `${e.target.value}.eth` : '')} className="h-10 min-w-0 flex-1 rounded-[3px] border border-border bg-transparent px-3 text-sm aria-invalid:border-[#ff8a7a] focus-visible:border-copper focus-visible:outline-none" /></div>
    {error && <p id={`${id}-error`} className="text-xs text-[#ff8a7a]">{error}</p>}
  </div>
}
