import { WalletProvider as UseWalletProvider, useInitializeProviders, PROVIDER_ID } from '@txnlab/use-wallet-react';
import { DeflyWalletConnect } from '@blockshake/defly-connect';
import { PeraWalletConnect } from '@perawallet/connect';
import algosdk from 'algosdk';
import { NETWORK_CONFIG } from '../config/network';

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const providers = useInitializeProviders({
    providers: [
      { id: PROVIDER_ID.PERA, clientStatic: PeraWalletConnect },
      { id: PROVIDER_ID.DEFLY, clientStatic: DeflyWalletConnect },
    ],
    nodeConfig: {
      network: NETWORK_CONFIG.network,
      nodeServer: NETWORK_CONFIG.algodServer,
      nodePort: '443',
      nodeToken: '',
    },
    algosdkStatic: algosdk,
  });

  return <UseWalletProvider value={providers}>{children}</UseWalletProvider>;
}
