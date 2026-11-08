import { eth } from './eth'

/** "1.19 ETH": ponto decimal e no mínimo duas casas, como no Figma. */
export const formatEth = (value: string) => `${eth.format(value)} ETH`
