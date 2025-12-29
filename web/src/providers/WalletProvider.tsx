import { WalletProvider as UseWalletProvider, WalletId, WalletManager } from '@txnlab/use-wallet-react';
import { NetworkId } from '@txnlab/use-wallet-react';
import { NETWORK_CONFIG } from '../config/network';

// Create wallet manager with supported wallets
const walletManager = new WalletManager({
  wallets: [
    WalletId.PERA,
    WalletId.DEFLY,
  ],
  network: NetworkId.MAINNET,
  algod: {
    baseServer: NETWORK_CONFIG.algodServer,
    port: '',
    token: '',
  },
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <UseWalletProvider manager={walletManager}>
      {children}
    </UseWalletProvider>
  );
}
