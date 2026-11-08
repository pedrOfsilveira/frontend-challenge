import type { z } from 'zod'

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {}
  for (const issue of error.issues) result[String(issue.path[0])] ??= issue.message
  return result
}

export function focusError(form: HTMLFormElement | null) {
  requestAnimationFrame(() => form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
}

export const accountButton = 'min-h-10 min-w-[131px] rounded-[3px] bg-copper px-4 text-sm font-bold text-ink hover:bg-copper-light disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-light'
