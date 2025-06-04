import React, { createContext, useContext, useState, useCallback } from 'react';
import { useRouter } from 'next/router';

export type DashboardPage = 
  | 'dashboard'
  | 'open-trades'
  | 'top-trades'
  | 'trading-history'
  | 'trade-log'
  | 'checklist'
  | 'account';

interface NavigationItem {
  name: string;
  href: string;
  page: DashboardPage;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  category: 'main' | 'trading' | 'settings';
}

interface DashboardNavigationContextType {
  currentPage: DashboardPage;
  navigateToPage: (page: DashboardPage, updateUrl?: boolean) => void;
  isTransitioning: boolean;
  navigationItems: NavigationItem[];
  getPageFromPath: (path: string) => DashboardPage;
  getPathFromPage: (page: DashboardPage) => string;
}

const DashboardNavigationContext = createContext<DashboardNavigationContextType | undefined>(undefined);

export const useDashboardNavigation = () => {
  const context = useContext(DashboardNavigationContext);
  if (context === undefined) {
    throw new Error('useDashboardNavigation must be used within a DashboardNavigationProvider');
  }
  return context;
};

interface DashboardNavigationProviderProps {
  children: React.ReactNode;
  initialPage?: DashboardPage;
}

export const DashboardNavigationProvider: React.FC<DashboardNavigationProviderProps> = ({
  children,
  initialPage = 'dashboard'
}) => {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState<DashboardPage>(initialPage);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Define navigation items (icons will be imported where needed)
  const navigationItems: NavigationItem[] = [
    { 
      name: 'Dashboard', 
      href: '/dashboard', 
      page: 'dashboard',
      icon: () => null, // Will be filled in components that use this
      description: 'Overview',
      category: 'main' 
    },
    { 
      name: 'Open Trades', 
      href: '/dashboard/open-trades', 
      page: 'open-trades',
      icon: () => null,
      description: 'Active positions',
      category: 'trading' 
    },
    { 
      name: 'Top Trades', 
      href: '/dashboard/top-trades', 
      page: 'top-trades',
      icon: () => null,
      description: 'Best performers',
      category: 'trading' 
    },
    { 
      name: 'Trading History', 
      href: '/dashboard/trading-history', 
      page: 'trading-history',
      icon: () => null,
      description: 'All trades',
      category: 'trading' 
    },
    { 
      name: 'Trade Log', 
      href: '/dashboard/trade-log', 
      page: 'trade-log',
      icon: () => null,
      description: 'Starred trades',
      category: 'trading' 
    },
    { 
      name: 'Checklist', 
      href: '/checklist', 
      page: 'checklist',
      icon: () => null,
      description: 'Trade criteria',
      category: 'settings' 
    },
    { 
      name: 'Account', 
      href: '/dashboard/account', 
      page: 'account',
      icon: () => null,
      description: 'Settings',
      category: 'settings' 
    }
  ];

  const getPageFromPath = useCallback((path: string): DashboardPage => {
    const pathMap: Record<string, DashboardPage> = {
      '/dashboard': 'dashboard',
      '/dashboard/open-trades': 'open-trades',
      '/dashboard/top-trades': 'top-trades',
      '/dashboard/trading-history': 'trading-history',
      '/dashboard/trade-log': 'trade-log',
      '/checklist': 'checklist',
      '/dashboard/checklist': 'checklist',
      '/dashboard/account': 'account'
    };
    return pathMap[path] || 'dashboard';
  }, []);

  const getPathFromPage = useCallback((page: DashboardPage): string => {
    const pageMap: Record<DashboardPage, string> = {
      'dashboard': '/dashboard',
      'open-trades': '/dashboard/open-trades',
      'top-trades': '/dashboard/top-trades',
      'trading-history': '/dashboard/trading-history',
      'trade-log': '/dashboard/trade-log',
      'checklist': '/checklist',
      'account': '/dashboard/account'
    };
    return pageMap[page] || '/dashboard';
  }, []);

  const navigateToPage = useCallback(async (page: DashboardPage, updateUrl: boolean = true) => {
    if (page === currentPage) return;

    setIsTransitioning(true);
    
    // Update URL without triggering page refresh
    if (updateUrl) {
      const newPath = getPathFromPage(page);
      await router.replace(newPath, undefined, { shallow: true });
    }
    
    setCurrentPage(page);
    
    // Allow transition animation to complete
    setTimeout(() => {
      setIsTransitioning(false);
    }, 500);
  }, [currentPage, router, getPathFromPage]);

  const value: DashboardNavigationContextType = {
    currentPage,
    navigateToPage,
    isTransitioning,
    navigationItems,
    getPageFromPath,
    getPathFromPage
  };

  return (
    <DashboardNavigationContext.Provider value={value}>
      {children}
    </DashboardNavigationContext.Provider>
  );
}; 