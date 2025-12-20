import Logo from './Logo';

export default function Footer() {
  return (
    <footer className="border-t border-surface-lighter py-8 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo className="w-8 h-8" />
            <span className="text-gray-400">
              FrySwap &copy; {new Date().getFullYear()} Fry Networks
            </span>
          </div>

          <div className="flex items-center gap-6 text-gray-400">
            <a
              href="https://docs.fryswap.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Docs
            </a>
            <a
              href="https://github.com/Fry-Foundation/fry-swap"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://twitter.com/FryNetworks"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Twitter
            </a>
            <a
              href="https://discord.gg/frynetworks"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Discord
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
