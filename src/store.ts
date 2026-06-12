import { useState, useCallback } from 'react';
import { Client, ContentItem, ContentStatus } from './types';
import { generateId } from './utils';

const STORAGE_KEY = 'limi_clients';

function loadClients(): Client[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data) as Client[];
  } catch {
    return [];
  }
}

function saveClients(clients: Client[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
}

export function useClients() {
  const [clients, setClients] = useState<Client[]>(() => loadClients());

  const persist = useCallback((updated: Client[]) => {
    setClients(updated);
    saveClients(updated);
  }, []);

  const addClient = useCallback(
    (data: { name: string; imageUrl?: string; about: string }) => {
      const newClient: Client = {
        id: generateId(),
        name: data.name,
        imageUrl: data.imageUrl || undefined,
        about: data.about,
        content: [],
        createdAt: Date.now(),
      };
      persist([...clients, newClient]);
      return newClient;
    },
    [clients, persist]
  );

  const getClient = useCallback(
    (id: string): Client | undefined => {
      return clients.find((c) => c.id === id);
    },
    [clients]
  );

  const addContent = useCallback(
    (
      clientId: string,
      data: {
        title: string;
        driveLink: string;
        driveFileId: string;
        notes?: string;
        status: ContentStatus;
      }
    ) => {
      const newItem: ContentItem = {
        id: generateId(),
        title: data.title,
        driveLink: data.driveLink,
        driveFileId: data.driveFileId,
        notes: data.notes,
        status: data.status,
        createdAt: Date.now(),
      };
      const updated = clients.map((c) =>
        c.id === clientId ? { ...c, content: [...c.content, newItem] } : c
      );
      persist(updated);
      return newItem;
    },
    [clients, persist]
  );

  const updateContentStatus = useCallback(
    (clientId: string, contentId: string, status: ContentStatus) => {
      const updated = clients.map((c) => {
        if (c.id !== clientId) return c;
        return {
          ...c,
          content: c.content.map((item) =>
            item.id === contentId ? { ...item, status } : item
          ),
        };
      });
      persist(updated);
    },
    [clients, persist]
  );

  return {
    clients,
    addClient,
    getClient,
    addContent,
    updateContentStatus,
  };
}
