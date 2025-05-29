import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { AuthProvider } from '../contexts/AuthContext';
import { WalletSelectionProvider } from '../contexts/WalletSelectionContext';
import { NotificationProvider } from '../contexts/NotificationContext';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <WalletSelectionProvider>
        <NotificationProvider>
          <Component {...pageProps} />
        </NotificationProvider>
      </WalletSelectionProvider>
    </AuthProvider>
  );
}

export default MyApp; 