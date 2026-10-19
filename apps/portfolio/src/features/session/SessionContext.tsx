import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * The portfolio's session.
 *
 * The three services share one signing secret, so a token issued by the auth
 * service is accepted by the other two. The portfolio reflects that: signing in
 * once makes the token available to every tester, instead of a visitor having
 * to copy it by hand from one page to another.
 *
 * The token is held IN MEMORY ONLY. It is never written to storage, never
 * put in the URL, and never sent anywhere except the API being tested. Closing
 * the tab discards it. A page that persisted a token would be storing
 * credentials in the visitor's browser, which is exactly what the auth service
 * exists to avoid.
 */
export interface Session {
  /** The access token, or null when nobody has signed in. */
  token: string | null;
  /** The email of the signed-in user, for display. */
  email: string | null;
  /** Records a successful sign-in. */
  signIn: (token: string, email: string) => void;
  /** Discards the token. */
  signOut: () => void;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const signIn = useCallback((nextToken: string, nextEmail: string) => {
    setToken(nextToken);
    setEmail(nextEmail);
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setEmail(null);
  }, []);

  const value = useMemo<Session>(
    () => ({ token, email, signIn, signOut }),
    [token, email, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** The current session. */
export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error('useSession must be used inside a SessionProvider.');
  }
  return session;
}
