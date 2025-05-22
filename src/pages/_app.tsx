import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { AuthProvider } from '../contexts/AuthContext';
import { WalletSelectionProvider } from '../contexts/WalletSelectionContext';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <WalletSelectionProvider>
        <Component {...pageProps} />
      </WalletSelectionProvider>
    </AuthProvider>
  );
}

export default MyApp; 