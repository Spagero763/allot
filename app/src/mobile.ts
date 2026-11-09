import { createDefaultAuthorizationCache, createDefaultChainSelector, createDefaultWalletNotFoundHandler, registerMwa } from '@solana-mobile/wallet-standard-mobile'
import { CLUSTER } from './lib/config'

const chain = CLUSTER === 'mainnet' ? 'solana:mainnet' : CLUSTER === 'devnet' ? 'solana:devnet' : null

if (chain && typeof window !== 'undefined' && /android/i.test(navigator.userAgent)) {
  registerMwa({
    appIdentity: { name: 'Allot', uri: window.location.origin, icon: 'icon-512.png' },
    chains: [chain],
    authorizationCache: createDefaultAuthorizationCache(),
    chainSelector: createDefaultChainSelector(),
    onWalletNotFound: createDefaultWalletNotFoundHandler(),
  })
}
