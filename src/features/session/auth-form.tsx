import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect, useId, useRef, useState } from 'react'
import { cn } from 'cn'
import { loginRequest, registerRequest, type AuthResponse } from '@/api/contracts'
import { authApi } from '@/api/endpoints'
import { isApiError } from '@/api/errors'
import { guestCart, sessionStore } from '@/api/session-store'
import closeIcon from '@/assets/figma/close.svg'
import hideIcon from '@/assets/figma/auth-hide.svg'
import googleGreen from '@/assets/figma/auth-88a3c.svg'
import googleGreenRight from '@/assets/figma/auth-75804.svg'
import googleYellow from '@/assets/figma/auth-a3c98.svg'
import googleBlue from '@/assets/figma/auth-1c266.svg'
import googleBlueRight from '@/assets/figma/auth-1174b.svg'
import googleRed from '@/assets/figma/auth-5f1dc.svg'
import googleRedRight from '@/assets/figma/auth-e1073.svg'
import facebook from '@/assets/figma/auth-5561e.svg'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { focusRing } from '@/features/checkout/fields'
import { switchSession } from './session'

type Fields = 'username' | 'email' | 'password' | 'confirmPassword'
type Errors = Partial<Record<Fields, string>>

export function AuthForm({ register, redirect, expired, onModeChange }: {
  register: boolean
  redirect: string
  expired: boolean
  onModeChange: (register: boolean) => void
}) {
  const id = useId()
  const form = useRef<HTMLFormElement>(null)
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()
  const active = useRef(true)
  const startingToken = useRef(sessionStore.getToken())
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])
  const [values, setValues] = useState({ username: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [visible, setVisible] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  // Notice of an availability adjustment is shown before leaving login, never silently dropped.
  const [authenticated, setAuthenticated] = useState<AuthResponse | null>(null)
  const finish = async () => {
    await router.invalidate()
    await router.navigate({ href: redirect, replace: true })
  }
  const mutation = useMutation({
    mutationFn: (body: { email: string; password: string; username: string }) =>
      register ? authApi.register({ ...body, displayName: body.username }) : authApi.login(body),
    onSuccess: async (result) => {
      // Leaving this form or a newer identity established elsewhere abandons this attempt.
      if (!active.current || sessionStore.getToken() !== startingToken.current) return
      await switchSession(queryClient, { token: result.token, userId: result.user.id, expiresAt: result.expiresAt })
      guestCart.clear()
      setValues((old) => ({ ...old, password: '', confirmPassword: '' }))
      if (result.cartMerge.length) setAuthenticated(result)
      else await finish()
    },
    onError: (error) => {
      if (isApiError(error)) setErrors(error.fields)
    },
  })
  const change = (field: Fields, value: string) => {
    if (mutation.isPending) return
    setValues((old) => ({ ...old, [field]: value }))
    setErrors((old) => ({ ...old, [field]: undefined }))
    mutation.reset()
  }
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (mutation.isPending) return
    const parsed = (register ? registerRequest : loginRequest).safeParse({ ...values, displayName: values.username })
    const next: Errors = {}
    if (!parsed.success) for (const issue of parsed.error.issues) next[issue.path[0] as Fields] ??= issue.message
    if (register && values.password !== values.confirmPassword) next.confirmPassword = 'As senhas não conferem.'
    setErrors(next)
    if (Object.keys(next).length) {
      requestAnimationFrame(() => form.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus())
      return
    }
    mutation.mutate({ ...values, email: values.email.trim().toLowerCase() })
  }
  const field = (name: Fields, label: string, placeholder: string, password = false) => (
    <div className="relative">
      <label htmlFor={`${id}-${name}`} className="sr-only">{label}</label>
      <input
        id={`${id}-${name}`} name={name} value={values[name]} onChange={(e) => change(name, e.target.value)}
        type={password ? (visible ? 'text' : 'password') : name === 'email' ? 'email' : 'text'}
        autoComplete={name === 'password' ? (register ? 'new-password' : 'current-password') : name === 'confirmPassword' ? 'new-password' : name}
        placeholder={placeholder} required aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `${id}-${name}-error` : undefined}
        className="h-[50px] w-full rounded-[10px] border border-border bg-transparent px-4 text-sm text-cream placeholder:text-sand aria-invalid:border-[#ff8a7a] focus-visible:border-copper focus-visible:outline-none lg:h-10 lg:rounded-[5px]"
      />
      {password && name === 'password' && <button type="button" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={visible} onClick={() => setVisible(!visible)} className={cn('absolute top-1 right-1 grid size-10 place-items-center rounded lg:top-0 lg:size-10', focusRing)}><img src={hideIcon} alt="" width={15.38} height={13.33} /></button>}
      {errors[name] && <p id={`${id}-${name}-error`} className="mt-1 text-xs text-[#ff8a7a]">{errors[name]}</p>}
    </div>
  )

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !mutation.isPending) void navigate({ to: '/' }) }}>
      <DialogContent showCloseButton={false} overlayClassName="bg-transparent" className={cn('fixed inset-0 top-0 left-0 flex h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none border-0 bg-ink p-0 text-cream shadow-none sm:max-w-none lg:inset-auto lg:top-[160px] lg:left-1/2 lg:h-auto lg:max-h-[calc(100dvh-176px)] lg:w-[500px] lg:-translate-x-1/2 lg:rounded-lg lg:bg-surface-card lg:shadow-xl', register ? 'lg:min-h-[min(656px,calc(100dvh-176px))]' : 'lg:min-h-[min(600px,calc(100dvh-176px))]')}>
        <Link to="/" aria-label="Fechar e voltar ao mercado" aria-disabled={mutation.isPending} onClick={(event) => { if (mutation.isPending) event.preventDefault() }} className={cn('absolute top-3 right-3 grid size-8 place-items-center rounded', focusRing)}><img src={closeIcon} alt="" width={18} height={17.35} /></Link>
        <div className="flex shrink-0 flex-col gap-10 px-7 pt-20 lg:gap-0 lg:px-0 lg:pt-12">
          <Link to="/" aria-disabled={mutation.isPending} onClick={(event) => { if (mutation.isPending) event.preventDefault() }} className={cn('flex h-[136px] items-center justify-center text-[32px] font-bold tracking-[3.2px] lg:hidden', focusRing)}>KURIO</Link>
          <div className="hidden justify-center gap-2 text-xl leading-4 font-medium lg:flex">
            <button type="button" aria-pressed={!register} disabled={mutation.isPending} onClick={() => onModeChange(false)} className={cn(focusRing, !register && 'text-copper-light')}>Entrar</button>
            <span aria-hidden className="text-[#f0805f]">|</span>
            <button type="button" aria-pressed={register} disabled={mutation.isPending} onClick={() => onModeChange(true)} className={cn(focusRing, register && 'text-copper-light')}>Criar conta</button>
          </div>
          <DialogTitle className="text-center text-lg leading-5 font-bold lg:sr-only">{register ? 'Criar perfil de colecionador' : 'Entrar'}</DialogTitle>
          <DialogDescription className="sr-only lg:not-sr-only lg:mt-10 lg:px-12 lg:text-center lg:text-[13px] lg:leading-4 lg:text-cream">{register ? 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.' : 'Entre para gerenciar sua carteira, coleção e perfil de criador.'}</DialogDescription>
          <form ref={form} onSubmit={submit} noValidate aria-label={register ? 'Cadastro' : 'Login'} className="flex flex-col lg:mt-6 lg:px-20">
            {expired && <p role="status" className="mb-3 text-sm text-copper-light">Sua sessão expirou. Entre novamente para retomar de onde parou.</p>}
            {authenticated ? <div role="status" className="flex flex-col gap-4 text-sm"><p>Conta conectada. Ajustamos itens do carrinho à disponibilidade atual:</p><ul>{authenticated.cartMerge.map((item) => <li key={`${item.nftId}:${item.editionId}`}>{item.name}: {item.kept} de {item.requested} unidades preservadas.</li>)}</ul><button type="button" onClick={() => void finish()} className={cn('rounded bg-copper p-3 font-bold text-ink', focusRing)}>Continuar</button></div> : <>
              <fieldset disabled={mutation.isPending} className="flex flex-col gap-3">
                {register && field('username', 'Nome de usuário', 'Nome de usuário')}
                {field('email', 'E-mail', register ? 'Digite seu e-mail' : 'contato@email.com')}
                {field('password', 'Senha', 'Senha', true)}
                {register && field('confirmPassword', 'Confirmar senha', 'Confirmar senha', true)}
                {!register && <button type="button" onClick={() => setNotice('Recuperação de senha indisponível nesta demonstração. Use as credenciais fictícias documentadas.')} className={cn('self-end text-sm leading-4 text-copper-light', focusRing)}>Esqueceu a senha?</button>}
              </fieldset>
              {mutation.error && <p role="alert" className="mt-3 text-sm text-[#ff8a7a]">{mutation.error.message}</p>}
              <button type="submit" disabled={mutation.isPending} className={cn('mt-10 h-[60px] rounded-[10px] bg-copper text-base font-bold text-ink hover:bg-copper-light disabled:opacity-60 lg:mt-6 lg:h-[45px] lg:rounded-[5px]', focusRing)}>{mutation.isPending ? 'Aguarde…' : register ? <><span className="lg:hidden">Criar perfil</span><span className="hidden lg:inline">Criar conta</span></> : 'Entrar'}</button>
            </>}
          </form>
        </div>
        {!authenticated && <>
          <div className="mt-10 flex shrink-0 flex-col gap-4 px-7 lg:mt-6 lg:gap-3 lg:px-0">
            <div className="flex items-center gap-3 text-[13px] leading-4 before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">Ou continue com</div>
            <div className="flex flex-col gap-4 lg:gap-3 lg:px-20">
              {(['Google', 'Facebook'] as const).map((provider) => <button key={provider} type="button" aria-describedby={`${id}-social`} onClick={() => setNotice(`Login com ${provider} indisponível nesta demonstração. Entre com e-mail e senha.`)} className={cn('flex h-10 items-center justify-center gap-3 rounded-[5px] border border-border text-[13px] font-medium text-sand-light', focusRing)}>{provider === 'Google' ? <GoogleMark /> : <img src={facebook} alt="" width={20} height={20} />}Continuar com {provider}</button>)}
            </div>
          </div>
          <p id={`${id}-social`} className="sr-only">Login social não faz parte da demonstração.</p>
          <button type="button" disabled={mutation.isPending} onClick={() => onModeChange(!register)} className={cn('mx-7 mt-10 mb-6 text-center text-[15px] text-sand-light lg:hidden', focusRing)}>{register ? 'Já tem uma conta? Entre' : 'Novo na Kurio? Crie uma conta'}</button>
        </>}
        {notice && <p role="status" className="mx-7 mt-4 mb-6 text-sm text-sand-light lg:mx-12">{notice}</p>}
        <div aria-hidden className="mt-auto hidden min-h-2.5 shrink-0 bg-copper lg:block" />
      </DialogContent>
    </Dialog>
  )
}

function GoogleMark() {
  const pieces = [
    { src: googleGreen, box: 'inset-[57.68%_17.83%_0_7.11%]' },
    { src: googleGreenRight, box: 'inset-[71.33%_17.83%_0_50%]' },
    { src: googleYellow, box: 'inset-[24.69%_75.25%_24.69%_0]' },
    { src: googleBlue, box: 'inset-[38.28%_0_11.97%_47.07%]' },
    { src: googleBlueRight, box: 'inset-[38.28%_0_11.97%_50%]' },
    { src: googleRed, box: 'inset-[0_17.01%_57.68%_7.11%]' },
    { src: googleRedRight, box: 'inset-[0_17.01%_70.51%_50%]' },
  ]
  return <span aria-hidden className="relative size-5 shrink-0">{pieces.map(({ src, box }) => <span key={src} className={cn('absolute', box)}><img src={src} alt="" className="block size-full" /></span>)}</span>
}
