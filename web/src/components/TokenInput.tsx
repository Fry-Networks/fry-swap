import { ChevronDownIcon } from './Icons';

interface Token {
  id: number;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
}

interface TokenInputProps {
  label: string;
  token: Token | null;
  amount: string;
  onAmountChange: (amount: string) => void;
  onTokenSelect: () => void;
  balance?: string;
  readonly?: boolean;
}

export default function TokenInput({
  label,
  token,
  amount,
  onAmountChange,
  onTokenSelect,
  balance,
  readonly = false,
}: TokenInputProps) {
  return (
    <div className="swap-input">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">{label}</span>
        {balance && (
          <span className="text-sm text-gray-400">
            Balance: {balance}
            <button
              onClick={() => onAmountChange(balance)}
              className="ml-2 text-primary-500 hover:text-primary-400"
            >
              MAX
            </button>
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          value={amount}
          onChange={(e) => {
            const value = e.target.value;
            if (/^\d*\.?\d*$/.test(value)) {
              onAmountChange(value);
            }
          }}
          placeholder="0.00"
          readOnly={readonly}
          className="flex-1 bg-transparent text-2xl font-medium outline-none placeholder:text-gray-600"
        />

        <button
          onClick={onTokenSelect}
          className="token-selector"
        >
          {token ? (
            <>
              <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center text-xs font-bold">
                {token.symbol.charAt(0)}
              </div>
              <span className="font-medium">{token.symbol}</span>
            </>
          ) : (
            <span className="text-primary-500 font-medium">Select token</span>
          )}
          <ChevronDownIcon className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {token && amount && (
        <div className="mt-2 text-sm text-gray-500">
          ≈ $0.00
        </div>
      )}
    </div>
  );
}
