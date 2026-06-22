import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  arrayUnion,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import { Client, ContentItem, ContentStatus } from './types';
import { generateId } from './utils';

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'clients'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data: Client[] = snapshot.docs.map((docSnap) => ({
          ...(docSnap.data() as Omit<Client, 'id'>),
          id: docSnap.id,
        }));
        setClients(data);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const addClient = useCallback(
    async (data: { name: string; imageUrl?: string; about: string }) => {
      await addDoc(collection(db, 'clients'), {
        name: data.name,
        imageUrl: data.imageUrl || '',
        about: data.about,
        content: [],
        createdAt: Date.now(),
      });
    },
    []
  );

  const addContent = useCallback(
    async (
      clientId: string,
      data: {
        title: string;
        driveLink: string;
        driveFileId: string;
        notes?: string;
        status: ContentStatus;
        scheduledAt?: number;
      }
    ) => {
      const newItem: ContentItem = {
        id: generateId(),
        title: data.title,
        driveLink: data.driveLink,
        driveFileId: data.driveFileId,
        notes: data.notes || '',
        status: data.status,
        createdAt: Date.now(),
        scheduledAt: data.scheduledAt || 0,
      };
      await updateDoc(doc(db, 'clients', clientId), {
        content: arrayUnion(newItem),
      });
    },
    []
  );

  const updateContent = useCallback(
    async (
      clientId: string,
      contentId: string,
      data: {
        title: string;
        driveLink: string;
        driveFileId: string;
        notes?: string;
        scheduledAt?: number;
      }
    ) => {
      const client = clients.find((c) => c.id === clientId);
      if (!client) return;
      const updatedContent = client.content.map((item) =>
        item.id === contentId
          ? {
              ...item,
              title: data.title,
              driveLink: data.driveLink,
              driveFileId: data.driveFileId,
              notes: data.notes || '',
              scheduledAt: data.scheduledAt || 0,
            }
          : item
      );
      await updateDoc(doc(db, 'clients', clientId), { content: updatedContent });
    },
    [clients]
  );

  const deleteContent = useCallback(
    async (clientId: string, contentId: string) => {
      const client = clients.find((c) => c.id === clientId);
      if (!client) return;
      const updatedContent = client.content.filter((item) => item.id !== contentId);
      await updateDoc(doc(db, 'clients', clientId), { content: updatedContent });
    },
    [clients]
  );

  const updateContentStatus = useCallback(
    async (clientId: string, contentId: string, status: ContentStatus) => {
      const client = clients.find((c) => c.id === clientId);
      if (!client) return;
      const updatedContent = client.content.map((item) =>
        item.id === contentId ? { ...item, status } : item
      );
      await updateDoc(doc(db, 'clients', clientId), { content: updatedContent });
    },
    [clients]
  );

  return { clients, loading, addClient, addContent, updateContent, deleteContent, updateContentStatus };
}
