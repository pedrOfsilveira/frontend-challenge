import { categoryIds, type Category, type Network } from '@/api/contracts'
import { eth } from '@/lib/eth'
import { seededRandom } from '../lib'
import { hashPassword } from '../passwords'
import type { Db, DbEdition, DbNft, DbWallet } from './types'

export const SCHEMA_VERSION = 1

/** Credenciais fictícias documentadas no README. */
export const DEMO_USERS = [
  { email: 'nova@kurio.dev', password: 'kurio123' },
  { email: 'leo@kurio.dev', password: 'kurio123' },
] as const

type Art = 'shades' | 'bucket' | 'baron' | 'headphones'

const COLLECTIONS: Record<Art, { id: string; name: string; creator: string }> = {
  shades: { id: 'kurio-apes', name: 'Kurio Apes', creator: 'Nova Sato' },
  bucket: { id: 'nomad-club', name: 'Nomad Club', creator: 'Íris Valença' },
  baron: { id: 'baron-society', name: 'Baron Society', creator: 'Caio Mendel' },
  headphones: { id: 'signal-sound', name: 'Signal Sound', creator: 'Lumi Okafor' },
}

const ATTRIBUTES: Record<Art, string[]> = {
  shades: ['Óculos', 'Esmeralda', 'Jaqueta college'],
  bucket: ['Chapéu bucket', 'Moletom', 'Sereno'],
  baron: ['Gola alta', 'Blazer', 'Olhar firme'],
  headphones: ['Fones', 'Jaqueta creme', 'Sorriso'],
}

const image = (art: Art) => `/assets/nfts/${art}.webp`

/** Os oito NFTs que aparecem no Figma, com os preços do layout. */
const FEATURED: { name: string; art: Art; price: string; compareAt?: string; category: Category; network: Network; badges: DbNft['badges'] }[] = [
  { name: 'Emerald Ape #042', art: 'shades', price: '1.19', category: 'digital-art', network: 'ethereum', badges: ['rare'] },
  { name: 'Sage Nomad #009', art: 'bucket', price: '1.69', category: 'digital-art', network: 'ethereum', badges: ['featured', 'limited'] },
  { name: 'Neon Vessel #552', art: 'baron', price: '1.99', compareAt: '2.29', category: 'collectibles', network: 'polygon', badges: ['limited'] },
  { name: 'Cosmic Bloom #118', art: 'bucket', price: '1.29', category: 'generative', network: 'ethereum', badges: [] },
  { name: 'Violet Nomad #314', art: 'bucket', price: '1.39', category: 'digital-art', network: 'polygon', badges: [] },
  { name: 'Ivory Baron #088', art: 'baron', price: '1.79', category: '3d-art', network: 'ethereum', badges: ['rare'] },
  { name: 'Golden Beat #207', art: 'headphones', price: '0.99', category: 'music', network: 'ethereum', badges: [] },
  { name: 'Golden Signal #160', art: 'headphones', price: '0.39', category: 'music', network: 'solana', badges: [] },
]

const PREFIXES = ['Amber', 'Cobalt', 'Copper', 'Crimson', 'Dune', 'Ember', 'Jade', 'Lunar', 'Onyx', 'Rust', 'Saffron', 'Solar', 'Terra', 'Velvet', 'Mossy', 'Pearl']
const NOUNS: { noun: string; art: Art }[] = [
  { noun: 'Ape', art: 'shades' },
  { noun: 'Nomad', art: 'bucket' },
  { noun: 'Bloom', art: 'bucket' },
  { noun: 'Baron', art: 'baron' },
  { noun: 'Vessel', art: 'baron' },
  { noun: 'Monk', art: 'baron' },
  { noun: 'Beat', art: 'headphones' },
  { noun: 'Signal', art: 'headphones' },
  { noun: 'Echo', art: 'headphones' },
  { noun: 'Drifter', art: 'shades' },
]

const slug = (name: string) => name.toLowerCase().replace(/#/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function editionsFor(id: string, basePrice: string, random: () => number, options: { soldOut?: boolean; openEdition: boolean }) {
  const pick = (max: number) => (options.soldOut ? 0 : Math.floor(random() * (max + 1)))
  const editions: DbEdition[] = [
    { id: `${id}-1-1`, label: '1/1', supply: 1, available: options.soldOut ? 0 : random() < 0.5 ? 0 : 1, priceEth: eth.times(basePrice, 5) },
    { id: `${id}-1-10`, label: '1/10', supply: 10, available: pick(10), priceEth: eth.times(basePrice, 2) },
    { id: `${id}-1-50`, label: '1/50', supply: 50, available: options.soldOut ? 0 : Math.max(3, pick(50)), priceEth: eth.normalize(basePrice) },
  ]
  if (options.openEdition) {
    editions.push({ id: `${id}-open`, label: 'Aberta', supply: null, available: 999, priceEth: eth.percent(basePrice, 6000) })
  }
  return editions
}

function buildNft(index: number, input: { name: string; art: Art; price: string; compareAt?: string; category: Category; network: Network; badges: DbNft['badges'] }, random: () => number, soldOut = false): DbNft {
  const id = slug(input.name)
  const number = input.name.split('#')[1] ?? String(index)
  const collection = COLLECTIONS[input.art]
  const listedAt = new Date(Date.UTC(2026, 9, 30, 12) - index * 2 * 86_400_000).toISOString()
  const editions = editionsFor(id, input.price, random, { soldOut, openEdition: !soldOut && index % 3 === 0 })
  return {
    id,
    name: input.name,
    tokenId: `#${number.padStart(4, '0')}`,
    image: image(input.art),
    images: [image(input.art), image(input.art), image(input.art), image(input.art)],
    category: input.category,
    network: input.network,
    compareAtPriceEth: input.compareAt ?? null,
    badges: input.badges,
    description: `Um colecionável digital finalizado à mão da coleção ${collection.name}, verificado na ${input.network === 'solana' ? 'Solana' : input.network === 'polygon' ? 'Polygon' : 'Ethereum'}, com arte desbloqueável e acesso para colecionadores.`,
    story: [
      `${input.name} é uma obra digital da coleção ${collection.name}. Cada atributo fica armazenado nos metadados do token e verificado na rede.`,
      `A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência. ${collection.creator} recebe 5% de direitos autorais nas vendas secundárias.`,
    ],
    collection: { id: collection.id, name: collection.name },
    creator: { name: collection.creator, royaltyBps: 500 },
    contractAddress: `0x7A42${(index * 7919).toString(16).padStart(34, '0').toUpperCase()}19E8`,
    attributes: [...ATTRIBUTES[input.art], ...(input.badges.includes('rare') ? ['Raro'] : [])],
    rating: { average: (4 + Math.floor(random() * 10) / 10).toFixed(1), count: 5 + Math.floor(random() * 40) },
    editions,
    defaultEditionId: `${id}-1-50`,
    listedAt,
    trendingScore: Math.floor(random() * 100),
    version: 1,
  }
}

function buildCatalog(): DbNft[] {
  const random = seededRandom(20261108)
  const nfts = FEATURED.map((item, index) => buildNft(index, item, random))
  // Valores fixos do Figma para o primeiro NFT (avaliações e atributos).
  nfts[0]!.rating = { average: '4.8', count: 19 }
  nfts[0]!.attributes = ['Óculos', 'Esmeralda', 'Raro']
  nfts[0]!.trendingScore = 96

  const used = new Set(nfts.map((n) => n.name))
  let index = FEATURED.length
  while (nfts.length < 48) {
    const prefix = PREFIXES[Math.floor(random() * PREFIXES.length)]!
    const { noun, art } = NOUNS[Math.floor(random() * NOUNS.length)]!
    const name = `${prefix} ${noun} #${String(Math.floor(random() * 900) + 100)}`
    if (used.has(name)) continue
    used.add(name)
    const hundredths = 2 + Math.floor(random() * 1229)
    const price = eth.normalize(`${Math.floor(hundredths / 100)}.${String(hundredths % 100).padStart(2, '0')}`)
    const roll = random()
    const networkId: Network = roll < 0.55 ? 'ethereum' : roll < 0.85 ? 'polygon' : 'solana'
    const badges: DbNft['badges'] = random() < 0.15 ? ['rare'] : random() < 0.1 ? ['limited'] : []
    const compareAt = random() < 0.12 ? eth.percent(price, 11500) : undefined
    // Um NFT inteiramente esgotado, para o estado "indisponível".
    const soldOut = nfts.length === 20
    nfts.push(
      buildNft(index, { name, art, price, compareAt, category: categoryIds[Math.floor(random() * categoryIds.length)]!, network: networkId, badges }, random, soldOut),
    )
    index++
  }
  return nfts
}

function wallet(userId: string, slot: DbWallet['slot'], fields: Omit<DbWallet, 'id' | 'userId' | 'slot' | 'connection' | 'version' | 'updatedAt'>): DbWallet {
  return { ...fields, id: `wallet_${userId}_${slot}`, userId, slot, connection: 'disconnected', version: 1, updatedAt: '2026-10-01T12:00:00.000Z' }
}

export async function createSeed(): Promise<Db> {
  const [novaHash, leoHash] = await Promise.all([
    hashPassword(DEMO_USERS[0].password, '6b7572696f2d6e6f76612d73616c7421'),
    hashPassword(DEMO_USERS[1].password, '6b7572696f2d6c656f2d73616c742121'),
  ])
  return {
    schemaVersion: SCHEMA_VERSION,
    sequence: 1000,
    nfts: buildCatalog(),
    users: [
      { id: 'user_nova', email: 'nova@kurio.dev', username: 'nova.sato', displayName: 'Nova Sato', avatarUrl: null, ensName: 'nova.kurio.eth', nickname: 'Nova', password: novaHash, profileVersion: 1 },
      { id: 'user_leo', email: 'leo@kurio.dev', username: 'leo.martins', displayName: 'Leo Martins', avatarUrl: null, ensName: 'leo.kurio.eth', nickname: 'Leo', password: leoHash, profileVersion: 1 },
    ],
    sessions: [],
    carts: [
      {
        id: 'cart_user_leo',
        ownerId: 'user_leo',
        version: 1,
        items: [{ id: 'line_seed_1', nftId: 'golden-beat-207', editionId: 'golden-beat-207-1-50', quantity: 1 }],
        couponCode: null,
        updatedAt: '2026-10-01T12:00:00.000Z',
      },
    ],
    coupons: [
      { code: 'KURIO10', label: 'Cupom KURIO10 (10%)', kind: 'percent', value: '1000', minSubtotalEth: '1', expiresAt: '2027-12-31T23:59:59.000Z' },
      { code: 'LANCAMENTO', label: 'Desconto do lançamento', kind: 'fixed', value: '0.05', minSubtotalEth: '0', expiresAt: '2027-12-31T23:59:59.000Z' },
      { code: 'EXPIRADO25', label: 'Cupom de 2025', kind: 'percent', value: '2500', minSubtotalEth: '0', expiresAt: '2025-12-31T23:59:59.000Z' },
    ],
    wallets: [
      wallet('user_nova', 'primary', {
        displayName: 'Nova Sato', nickname: 'Cofre principal', network: 'ethereum', profileName: 'nova', provider: 'metamask',
        address: '0x7a42c9d1e8b3f40a6c2d9e1b7f3a8c4d2e6b19e8', secondaryAddressOrEns: null, referralCode: 'NOVA2026', email: 'nova@kurio.dev', ensName: 'nova.kurio.eth',
      }),
      wallet('user_leo', 'primary', {
        displayName: 'Leo Martins', nickname: 'Coinbase', network: 'polygon', profileName: 'leo', provider: 'coinbase',
        address: '0x3b19f0a2c4d6e8f1a3b5c7d9e0f2a4b6c8d0e1f2', secondaryAddressOrEns: null, referralCode: 'LEO2026', email: 'leo@kurio.dev', ensName: 'leo.kurio.eth',
      }),
      wallet('user_leo', 'secondary', {
        displayName: 'Leo Martins', nickname: 'Reserva', network: 'ethereum', profileName: 'leo', provider: 'walletconnect',
        address: '0x9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b', secondaryAddressOrEns: 'leo.kurio.eth', referralCode: 'LEO2026', email: 'leo@kurio.dev', ensName: 'leo.kurio.eth',
      }),
    ],
    favorites: { user_leo: ['neon-vessel-552', 'golden-beat-207'], user_nova: [] },
    quotes: {},
    orders: [],
    settings: { paymentOutcome: 'confirm', paymentDelayMs: 2500, walletConnection: 'accept' },
  }
}
