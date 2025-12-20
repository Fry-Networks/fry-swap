import { WalletProvider as UseWalletProvider, useInitializeProviders, PROVIDER_ID } from '@txnlab/use-wallet-react';
import { DeflyWalletConnect } from '@blockshake/defly-connect';
import { PeraWalletConnect } from '@perawallet/connect';
import algosdk from 'algosdk';

// Nodely endpoints
const ALGOD_SERVER = 'https://testnet-api.4160.nodely.dev';
const INDEXER_SERVER = 'https://testnet-idx.4160.nodely.dev';

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const providers = useInitializeProviders({
    providers: [
      { id: PROVIDER_ID.PERA, clientStatic: PeraWalletConnect },
      { id: PROVIDER_ID.DEFLY, clientStatic: DeflyWalletConnect },
    ],
    nodeConfig: {
      network: 'testnet',
      nodeServer: ALGOD_SERVER,
      nodePort: '443',
      nodeToken: '',
    },
    algosdkStatic: algosdk,
  });

  return <UseWalletProvider value={providers}>{children}</UseWalletProvider>;
}
