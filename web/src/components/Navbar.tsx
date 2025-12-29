import { Link, NavLink } from 'react-router-dom';
import { useWallet } from '@txnlab/use-wallet-react';
import Logo from './Logo';

export default function Navbar() {
  const { activeAccount, activeWallet, wallets } = useWallet();

  const handleConnect = async () => {
    // Try Pera first, then Defly
    const peraWallet = wallets?.find((w) => w.id === 'pera');
    if (peraWallet) {
      await peraWallet.connect();
    } else if (wallets && wallets.length > 0) {
      await wallets[0].connect();
    }
  };

  const handleDisconnect = async () => {
    if (activeWallet) {
      await activeWallet.disconnect();
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <nav className="border-b border-surface-lighter bg-surface/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <Logo className="w-10 h-10" />
            <span className="text-xl font-bold bg-fry-gradient bg-clip-text text-transparent">
              FrySwap
            </span>
          </Link>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <NavLink
              to="/swap"
              className={({ isActive }) =>
                `nav-link ${isActive ? 'nav-link-active' : ''}`
              }
            >
              Swap
            </NavLink>
            <NavLink
              to="/pools"
              className={({ isActive }) =>
                `nav-link ${isActive ? 'nav-link-active' : ''}`
              }
            >
              Pools
            </NavLink>
          </div>

          {/* Wallet */}
          <div>
            {activeAccount ? (
              <button
                onClick={handleDisconnect}
                className="btn-secondary flex items-center gap-2"
              >
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                {formatAddress(activeAccount.address)}
              </button>
            ) : (
              <button onClick={handleConnect} className="btn-primary">
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
