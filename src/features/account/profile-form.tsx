import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { cn } from 'cn'
import { AVATAR_MAX_BYTES, AVATAR_TYPES, changePasswordRequest, updateProfileRequest, type Profile, type UpdateProfileRequest } from '@/api/contracts'
import { profileApi } from '@/api/endpoints'
import { isApiError } from '@/api/errors'
import { queryKeys } from '@/api/query-keys'
import { sessionStore } from '@/api/session-store'
import avatarIcon from '@/assets/figma/account-image.svg'
import hideIcon from '@/assets/figma/account-hide.svg'
import { TextField, focusRing } from '@/features/checkout/fields'
import { usePrivateScope } from '@/features/session/use-session'
import { accountButton, fieldErrors, focusError } from './form'
import { AccountEnsField } from './ens-field'

export function ProfileForm({ profile }: { profile: Profile }) {
  const id = useId()
  const form = useRef<HTMLFormElement>(null)
  const queryClient = useQueryClient()
  const key = queryKeys.private.profile(usePrivateScope())
  const [draft, setDraft] = useState({ displayName: profile.displayName, username: profile.username, email: profile.email, ensName: profile.ensName ?? '', nickname: profile.nickname ?? '' })
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<string | null>(null)
  const [visible, setVisible] = useState<Record<string, boolean>>({})
  const avatarInput = useRef<HTMLInputElement>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [readingAvatar, setReadingAvatar] = useState(false)

  const save = useMutation({
    mutationFn: async ({ details, withPassword }: { details: UpdateProfileRequest; withPassword: boolean }) => {
      const updated = await profileApi.update(details)
      queryClient.setQueryData(key, updated)
      if (withPassword) {
        if (sessionStore.get()?.userId !== profile.userId) throw new Error('A sessão mudou. Entre novamente para alterar a senha.')
        setStatus('Dados do perfil salvos. Atualizando a senha…')
        await profileApi.changePassword(password)
      }
      return { updated, withPassword }
    },
    onSuccess: ({ updated, withPassword }) => {
      setDraft({ displayName: updated.displayName, username: updated.username, email: updated.email, ensName: updated.ensName ?? '', nickname: updated.nickname ?? '' })
      setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setStatus(withPassword ? 'Perfil e senha atualizados.' : 'Perfil atualizado.')
      void queryClient.invalidateQueries({ queryKey: key })
    },
    onError: (error) => {
      if (isApiError(error)) setErrors(error.fields)
      focusError(form.current)
    },
  })
  const avatar = useMutation({
    mutationFn: profileApi.updateAvatar,
    onSuccess: (updated) => {
      queryClient.setQueryData(key, updated)
      setAvatarError(null)
      setStatus(updated.avatarUrl ? 'Avatar atualizado.' : 'Avatar removido.')
    },
  })
  const uploadAvatar = async (file: File | undefined) => {
    setAvatarError(null)
    avatar.reset()
    if (!file) return
    if (!(AVATAR_TYPES as readonly string[]).includes(file.type) || file.size > AVATAR_MAX_BYTES) {
      setAvatarError('Envie uma imagem PNG, JPEG ou WebP de até 512 KB.')
      return
    }
    setReadingAvatar(true)
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Arquivo inválido.'))
        reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
        reader.readAsDataURL(file)
      })
      // Verify the file actually decodes as an image before persisting it.
      const image = new Image()
      image.src = data
      await image.decode()
      if (sessionStore.get()?.userId === profile.userId) avatar.mutate(data)
    } catch { setAvatarError('Não foi possível abrir a imagem. Escolha outro arquivo.') }
    finally { setReadingAvatar(false) }
  }
  const busy = save.isPending || avatar.isPending || readingAvatar
  const change = (field: keyof typeof draft, value: string) => {
    setDraft((old) => ({ ...old, [field]: value }))
    setErrors((old) => ({ ...old, [field]: '' }))
    setStatus(null)
    save.reset()
  }
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    setStatus(null)
    const details = updateProfileRequest.safeParse(draft)
    const withPassword = Object.values(password).some(Boolean)
    const parsedPassword = withPassword ? changePasswordRequest.safeParse(password) : null
    const next = { ...(details.success ? {} : fieldErrors(details.error)), ...(parsedPassword && !parsedPassword.success ? fieldErrors(parsedPassword.error) : {}) }
    setErrors(next)
    if (!details.success || (parsedPassword && !parsedPassword.success)) { focusError(form.current); return }
    save.mutate({ details: details.data, withPassword })
  }
  const input = (name: keyof typeof draft, label: string, autoComplete?: string) => <TextField id={`${id}-${name}`} label={label} required value={draft[name]} onChange={(value) => change(name, value)} error={errors[name]} autoComplete={autoComplete} className="gap-2.5" />

  return <form ref={form} onSubmit={submit} noValidate aria-label="Perfil do colecionador" className="flex flex-col gap-8">
    <h1 className="text-base leading-4 font-bold">Perfil do colecionador</h1>
    <fieldset disabled={busy} className="grid min-w-0 gap-x-7 gap-y-6 md:grid-cols-2">
      <legend className="sr-only">Dados do perfil</legend>
      {input('displayName', 'Nome de exibição', 'name')}
      {input('username', 'Nome de usuário', 'username')}
      {input('email', 'E-mail', 'email')}
      <AccountEnsField id={`${id}-ensName`} value={draft.ensName} onChange={(value) => change('ensName', value)} error={errors.ensName} />
      {input('nickname', 'Apelido da carteira')}
      <div className="flex min-w-0 flex-col gap-2.5">
        <p className="text-[15px]">Avatar</p>
        <div className="flex flex-wrap items-center gap-5">
          {profile.avatarUrl ? <img src={profile.avatarUrl} alt="Seu avatar" className="size-[50px] rounded-full object-cover" /> : <span className="grid size-[50px] shrink-0 place-items-center rounded-full border border-border bg-surface-raised"><img src={avatarIcon} alt="Sem avatar" width={20} height={20} /></span>}
          <input ref={avatarInput} type="file" accept={AVATAR_TYPES.join(',')} aria-label="Arquivo de avatar" className="sr-only" disabled={busy} onChange={(e) => { void uploadAvatar(e.target.files?.[0]); e.target.value = '' }} />
          <button type="button" onClick={() => avatarInput.current?.click()} className={cn(accountButton, 'min-w-[98px]')}>Alterar</button>
          <button type="button" disabled={!profile.avatarUrl} onClick={() => avatar.mutate(null)} className={cn('min-h-10 text-sm disabled:opacity-50', focusRing)}>Remover</button>
        </div>
        {(avatarError || avatar.error) && <p role="alert" className="text-xs text-[#ff8a7a]">{avatarError ?? avatar.error?.message}</p>}
        <p className="sr-only">PNG, JPEG ou WebP, até 512 KB.</p>
      </div>
    </fieldset>
    <fieldset disabled={busy} className="flex min-w-0 flex-col gap-6">
      <legend className="mb-6 text-base leading-4 font-medium">Alterar senha</legend>
      {(Object.entries({ currentPassword: 'Senha atual', newPassword: 'Nova senha', confirmPassword: 'Confirmar nova senha' }) as [keyof typeof password, string][]).map(([field, label]) => <div key={field} className="relative w-full md:max-w-[417px]">
        <TextField id={`${id}-${field}`} label={label} value={password[field]} onChange={(value) => { setPassword((old) => ({ ...old, [field]: value })); setErrors((old) => ({ ...old, [field]: '' })); save.reset(); setStatus(null) }} type={visible[field] ? 'text' : 'password'} autoComplete={field === 'currentPassword' ? 'current-password' : 'new-password'} error={errors[field]} className="gap-3 [&_input]:pr-11" />
        <button type="button" onClick={() => setVisible((old) => ({ ...old, [field]: !old[field] }))} aria-label={`${visible[field] ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`} aria-pressed={Boolean(visible[field])} className={cn('absolute top-[27px] right-0 grid size-10 place-items-center rounded', focusRing)}><img src={hideIcon} alt="" width={16.67} height={14.4} /></button>
      </div>)}
    </fieldset>
    {status && <p role="status" className="text-sm text-copper-light">{status}</p>}
    {save.error && <p role="alert" className="text-sm text-[#ff8a7a]">{save.error.message}</p>}
    <button type="submit" disabled={busy} className={cn(accountButton, 'self-start')}>{save.isPending ? 'Salvando…' : 'Salvar'}</button>
  </form>
}
