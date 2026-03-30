import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SessionPayload } from '../../../shared/types/auth';

type SessionState = {
  session: SessionPayload | null;
  setSession: (session: SessionPayload | null) => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
    }),
    { name: 'openaiteach-session' }
  )
);
