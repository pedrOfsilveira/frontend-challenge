import { z } from 'zod'
import { paymentNetwork, walletProvider } from './common'

/** Regras de campo compartilhadas entre formulários (cliente) e validação do mock (servidor). */
export const displayNameRule = z.string().trim().min(2, 'Informe o nome de exibição.').max(60, 'Use no máximo 60 caracteres.')
export const emailRule = z.email('Informe um e-mail válido.').trim().toLowerCase()
export const addressRule = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Use um endereço 0x com 40 caracteres hexadecimais.')
/** Rótulo ENS sem o sufixo (o sufixo `.eth` é escolhido à parte, como no Figma). */
export const ensLabelRule = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{3,}(\.[a-z0-9-]+)*$/, 'Use ao menos 3 caracteres: letras, números, hífen ou ponto.')
export const ensNameRule = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{3,}(\.[a-z0-9-]+)*\.eth$/, 'Informe um nome ENS terminado em .eth.')
export const addressOrEnsRule = z.union([addressRule, ensNameRule], {
  error: 'Informe um endereço 0x ou um nome ENS (.eth).',
})
export const referralCodeRule = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{4,12}$/, 'Use de 4 a 12 letras ou números.')
export const profileNameRule = z.string().trim().min(2, 'Informe o nome do perfil.').max(40, 'Use no máximo 40 caracteres.')
export const nicknameRule = z.string().trim().min(2, 'Informe o apelido.').max(30, 'Use no máximo 30 caracteres.')

/** Campos de carteira do layout (Carteiras e Pagamento usam os mesmos). */
export const walletFields = z.object({
  displayName: displayNameRule,
  nickname: nicknameRule,
  network: paymentNetwork,
  profileName: profileNameRule,
  address: addressRule,
  secondaryAddressOrEns: addressOrEnsRule.nullable(),
  provider: walletProvider,
  referralCode: referralCodeRule,
  email: emailRule,
  ensName: ensNameRule,
})
export type WalletFields = z.infer<typeof walletFields>
