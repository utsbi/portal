'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface ClientData {
  id: number;
  name: string;
  email: string;
  companyName: string;
  urlSlug: string;
  initials: string;
}

interface ClientContextType {
  client: ClientData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return parts[0]?.substring(0, 2).toUpperCase() || '??';
}

interface ClientProviderProps {
  children: ReactNode;
  urlSlug: string;
  initialClientData?: ClientData | null;
}

export function ClientProvider({ children, urlSlug, initialClientData }: ClientProviderProps) {
  const [client, setClient] = useState<ClientData | null>(initialClientData || null);
  const [isLoading, setIsLoading] = useState(!initialClientData);
  const [error, setError] = useState<string | null>(null);

  const fetchClientData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        setError('Not authenticated');
        setIsLoading(false);
        return;
      }

      // Try clients first
      const { data: clientData } = await supabase
        .from('clients')
        .select('id, name, company_name, url_slug')
        .eq('uid', user.id)
        .eq('url_slug', urlSlug)
        .single();

      if (clientData) {
        const displayName = clientData.name || clientData.company_name || user.email?.split('@')[0] || 'User';
        setClient({
          id: clientData.id,
          name: displayName,
          email: user.email || '',
          companyName: clientData.company_name ?? '',
          urlSlug: clientData.url_slug,
          initials: getInitials(displayName),
        });
        return;
      }

      // Fallback: members (e.g. directors)
      const { data: memberData } = await supabase
        .from('members')
        .select('id, name, url_slug')
        .eq('uid', user.id)
        .eq('url_slug', urlSlug)
        .single();

      if (memberData) {
        const displayName = memberData.name || user.email?.split('@')[0] || 'User';
        setClient({
          id: memberData.id,
          name: displayName,
          email: user.email || '',
          companyName: '',
          urlSlug: memberData.url_slug,
          initials: getInitials(displayName),
        });
        return;
      }

      setError('Client not found');
    } catch (err) {
      setError('Failed to fetch client data');
      console.error('Client data fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch if no initial data was provided, or if urlSlug changed AFTER initial mount
    // For now, let's just use initial data if available
    if (!initialClientData) {
      fetchClientData();
    }
  }, [urlSlug]);

  return (
    <ClientContext.Provider
      value={{
        client,
        isLoading,
        error,
        refetch: fetchClientData,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
}

export function useClient() {
  const context = useContext(ClientContext);
  if (context === undefined) {
    throw new Error('useClient must be used within a ClientProvider');
  }
  return context;
}
