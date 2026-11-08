import type { ChangePasswordRequest, Profile, SaveWalletRequest, WalletSlot, Wallet, WalletsResponse } from '@/api/contracts'
import type { Db, DbUser, DbWallet } from '../db/types'
import { MockError, nowIso } from '../lib'
import { hashPassword, verifyPassword } from '../passwords'
import { assertUnique } from './auth'
import { summarize } from './catalog'

export function viewProfile(user: DbUser): Profile {
  return {
    userId: user.id,
    displayName: user.displayName,
    username: user.username,
    email: user.email,
    ensName: user.ensName,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    version: user.profileVersion,
  }
}

export function updateProfile(db: Db, user: DbUser, input: { displayName: string; username: string; email: string; ensName: string; nickname: string }) {
  assertUnique(db, input, user.id)
  Object.assign(user, input)
  user.profileVersion += 1
}

export function updateAvatar(user: DbUser, avatarUrl: string | null) {
  user.avatarUrl = avatarUrl
  user.profileVersion += 1
}

export async function changePassword(user: DbUser, input: ChangePasswordRequest) {
  if (!(await verifyPassword(input.currentPassword, user.password))) {
    throw new MockError('VALIDATION_FAILED', 'Senha atual incorreta.', { fields: { currentPassword: 'Senha atual incorreta.' } })
  }
  user.password = await hashPassword(input.newPassword)
  user.profileVersion += 1
}

const viewWallet = ({ userId: _userId, ...wallet }: DbWallet): Wallet => wallet

export function listWallets(db: Db, userId: string): WalletsResponse {
  const own = db.wallets.filter((w) => w.userId === userId)
  const primary = own.find((w) => w.slot === 'primary')
  const secondary = own.find((w) => w.slot === 'secondary')
  return { primary: primary ? viewWallet(primary) : null, secondary: secondary ? viewWallet(secondary) : null }
}

export function saveWallet(db: Db, userId: string, slot: WalletSlot, input: SaveWalletRequest): Wallet {
  if (slot === 'secondary' && !db.wallets.some((w) => w.userId === userId && w.slot === 'primary')) {
    throw new MockError('VALIDATION_FAILED', 'Cadastre a carteira principal antes da secundária.')
  }
  const existing = db.wallets.find((w) => w.userId === userId && w.slot === slot)
  if (existing) {
    // Trocar endereço, rede ou provedor exige reconectar.
    const reconnect = existing.address !== input.address || existing.network !== input.network || existing.provider !== input.provider
    Object.assign(existing, input, { version: existing.version + 1, updatedAt: nowIso() })
    if (reconnect) existing.connection = 'disconnected'
    return viewWallet(existing)
  }
  const created: DbWallet = { ...input, id: `wallet_${userId}_${slot}`, userId, slot, connection: 'disconnected', version: 1, updatedAt: nowIso() }
  db.wallets.push(created)
  return viewWallet(created)
}

export function removeWallet(db: Db, userId: string, slot: WalletSlot) {
  if (slot === 'primary') throw new MockError('VALIDATION_FAILED', 'A carteira principal não pode ser removida; edite os dados dela.')
  db.wallets = db.wallets.filter((w) => !(w.userId === userId && w.slot === slot))
  return listWallets(db, userId)
}

export function ownWallet(db: Db, userId: string, walletId: string) {
  const wallet = db.wallets.find((w) => w.id === walletId)
  // Carteira de outro usuário responde como inexistente: não confirma que ela existe.
  if (!wallet || wallet.userId !== userId) throw new MockError('NOT_FOUND', 'Carteira não encontrada.')
  return wallet
}

export function connectWallet(db: Db, userId: string, walletId: string): Wallet {
  const wallet = ownWallet(db, userId, walletId)
  if (db.settings.walletConnection === 'reject') {
    wallet.connection = 'disconnected'
    throw new MockError('WALLET_REJECTED', 'A conexão foi recusada na carteira. Tente novamente ou escolha outra carteira.')
  }
  wallet.connection = 'connected'
  wallet.updatedAt = nowIso()
  return viewWallet(wallet)
}

export function disconnectWallet(db: Db, userId: string, walletId: string): Wallet {
  const wallet = ownWallet(db, userId, walletId)
  wallet.connection = 'disconnected'
  wallet.updatedAt = nowIso()
  return viewWallet(wallet)
}

export function favorites(db: Db, userId: string) {
  const ids = (db.favorites[userId] ?? []).filter((id) => db.nfts.some((n) => n.id === id))
  return { ids, items: ids.map((id) => summarize(db.nfts.find((n) => n.id === id)!)) }
}

export function setFavorite(db: Db, userId: string, nftId: string, on: boolean) {
  if (!db.nfts.some((n) => n.id === nftId)) throw new MockError('NOT_FOUND', 'NFT não encontrado.')
  const current = new Set(db.favorites[userId] ?? [])
  if (on) current.add(nftId)
  else current.delete(nftId)
  db.favorites[userId] = [...current]
  return favorites(db, userId)
}
