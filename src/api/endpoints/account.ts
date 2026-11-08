import {
  profile,
  wallet,
  walletsResponse,
  type ChangePasswordRequest,
  type SaveWalletRequest,
  type UpdateProfileRequest,
  type WalletSlot,
} from '../contracts'
import { http, parse, type RequestOptions } from '../http'

export const profileApi = {
  get: async ({ signal }: RequestOptions = {}) => parse(profile, (await http.get('/profile', { signal })).data),
  update: async (body: UpdateProfileRequest) => parse(profile, (await http.put('/profile', body)).data),
  updateAvatar: async (avatarUrl: string | null) => parse(profile, (await http.put('/profile/avatar', { avatarUrl })).data),
  changePassword: async (body: ChangePasswordRequest) => {
    await http.put('/profile/password', body)
  },
}

export const walletsApi = {
  list: async ({ signal }: RequestOptions = {}) => parse(walletsResponse, (await http.get('/wallets', { signal })).data),
  save: async (slot: WalletSlot, body: SaveWalletRequest) => parse(wallet, (await http.put(`/wallets/${slot}`, body)).data),
  remove: async (slot: WalletSlot) => parse(walletsResponse, (await http.delete(`/wallets/${slot}`)).data),
  connect: async (id: string) => parse(wallet, (await http.post(`/wallets/${encodeURIComponent(id)}/connect`)).data),
  disconnect: async (id: string) => parse(wallet, (await http.post(`/wallets/${encodeURIComponent(id)}/disconnect`)).data),
}
