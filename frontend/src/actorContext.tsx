import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { getActor, setActor } from './api/client';

export type Role = 'admin' | 'app' | 'auditor';

export interface ActorState {
  principal: string;
  role: Role;
}

interface ActorContextValue {
  actor: ActorState;
  update: (next: Partial<ActorState>) => void;
}

const ActorContext = createContext<ActorContextValue | undefined>(undefined);

function readInitialActor(): ActorState {
  const fallback = getActor();
  if (typeof window === 'undefined') {
    return fallback;
  }
  const stored = window.localStorage.getItem('kms-actor');
  if (!stored) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(stored) as Partial<ActorState>;
    if (parsed.principal && parsed.role && ['admin', 'app', 'auditor'].includes(parsed.role)) {
      return parsed as ActorState;
    }
  } catch (error) {
    console.warn('Failed to restore actor from storage', error);
  }
  return fallback;
}

export function ActorProvider({ children }: PropsWithChildren): JSX.Element {
  const [actor, setActorState] = useState<ActorState>(() => readInitialActor());

  useEffect(() => {
    setActor(actor);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('kms-actor', JSON.stringify(actor));
    }
  }, [actor]);

  const update = useCallback((next: Partial<ActorState>) => {
    setActorState((prev) => ({
      principal: next.principal ?? prev.principal,
      role: (next.role as Role | undefined) ?? prev.role,
    }));
  }, []);

  const value = useMemo<ActorContextValue>(
    () => ({
      actor,
      update,
    }),
    [actor, update]
  );

  return <ActorContext.Provider value={value}>{children}</ActorContext.Provider>;
}

export function useActor(): ActorContextValue {
  const context = useContext(ActorContext);
  if (!context) {
    throw new Error('useActor must be used within ActorProvider');
  }
  return context;
}
