import { useState, useMemo } from 'react';
import { Token, MAINNET_TOKENS, COMMON_BASES } from '../config/tokens';

interface TokenSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: Token) => void;
  selectedToken?: Token | null;
  disabledToken?: Token | null;
}

export default function TokenSelector({
  isOpen,
  onClose,
  onSelect,
  selectedToken,
  disabledToken,
}: TokenSelectorProps) {
  const [search, setSearch] = useState('');

  const filteredTokens = useMemo(() => {
    if (!search) return MAINNET_TOKENS;

    const query = search.toLowerCase();
    return MAINNET_TOKENS.filter(
      (token) =>
        token.symbol.toLowerCase().includes(query) ||
        token.name.toLowerCase().includes(query) ||
        token.id.toString() === query
    );
  }, [search]);

  if (!isOpen) return null;

  const handleSelect = (token: Token) => {
    onSelect(token);
    onClose();
    setSearch('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-surface rounded-2xl border border-surface-lighter w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-surface-lighter">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Select a token</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-lighter rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or paste ASA ID"
            className="input-field w-full"
            autoFocus
          />
        </div>

        {/* Common bases */}
        <div className="p-4 border-b border-surface-lighter">
          <p className="text-xs text-gray-400 mb-2">Common bases</p>
          <div className="flex flex-wrap gap-2">
            {COMMON_BASES.map((token) => (
              <button
                key={token.id}
                onClick={() => handleSelect(token)}
                disabled={token.id === disabledToken?.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
                  token.id === selectedToken?.id
                    ? 'border-primary-500 bg-primary-500/10'
                    : token.id === disabledToken?.id
                    ? 'border-surface-lighter opacity-50 cursor-not-allowed'
                    : 'border-surface-lighter hover:border-primary-500/50'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center text-xs font-bold">
                  {token.symbol.charAt(0)}
                </div>
                <span className="text-sm font-medium">{token.symbol}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Token list */}
        <div className="flex-1 overflow-y-auto p-2">
          {filteredTokens.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No tokens found
            </div>
          ) : (
            filteredTokens.map((token) => (
              <button
                key={token.id}
                onClick={() => handleSelect(token)}
                disabled={token.id === disabledToken?.id}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                  token.id === selectedToken?.id
                    ? 'bg-primary-500/10'
                    : token.id === disabledToken?.id
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-surface-lighter'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center font-bold">
                  {token.symbol.charAt(0)}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">{token.symbol}</p>
                  <p className="text-sm text-gray-400">{token.name}</p>
                </div>
                {token.verified && (
                  <svg className="w-5 h-5 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
