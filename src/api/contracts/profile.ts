import { z } from 'zod'
import { passwordRule, usernameRule } from './auth'
import { displayNameRule, emailRule, ensNameRule, nicknameRule } from './fields'

export const profile = z.object({
  userId: z.string(),
  displayName: z.string(),
  username: z.string(),
  email: z.string(),
  ensName: z.string().nullable(),
  nickname: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  version: z.number().int().min(1),
})
export type Profile = z.infer<typeof profile>

export const updateProfileRequest = z.object({
  displayName: displayNameRule,
  username: usernameRule,
  email: emailRule,
  ensName: ensNameRule,
  nickname: nicknameRule,
})
export type UpdateProfileRequest = z.infer<typeof updateProfileRequest>

export const AVATAR_MAX_BYTES = 512 * 1024
export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

/** Avatar como data URL (sem backend de arquivos na simulação). `null` remove. */
export const updateAvatarRequest = z.object({
  avatarUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'Envie uma imagem PNG, JPEG ou WebP.')
    .refine((url) => Math.floor(((url.length - url.indexOf(',') - 1) * 3) / 4) <= AVATAR_MAX_BYTES, 'A imagem deve ter até 512 KB.')
    .nullable(),
})

export const changePasswordRequest = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    newPassword: passwordRule,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem.',
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'A nova senha deve ser diferente da atual.',
  })
export type ChangePasswordRequest = z.infer<typeof changePasswordRequest>
