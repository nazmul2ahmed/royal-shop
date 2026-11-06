import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [adminCheck, setAdminCheck] = useState({
    userId: null,
    isAdmin: false,
    checked: false,
  });
  const [recoveryUserId, setRecoveryUserId] = useState(null);

  useEffect(() => {
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      setUser(session?.user ?? null);
      setSessionChecked(true);

      if (event === 'PASSWORD_RECOVERY' && session?.user?.id) {
        setRecoveryUserId(session.user.id);
      }

      if (event === 'SIGNED_OUT') {
        setRecoveryUserId(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function checkAdminRole() {
      if (!sessionChecked) return;

      if (!user) {
        setAdminCheck({
          userId: null,
          isAdmin: false,
          checked: true,
        });
        return;
      }

      setAdminCheck({
        userId: user.id,
        isAdmin: false,
        checked: false,
      });

      try {
        const { data, error } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!active) return;

        if (error) {
          console.error('Admin role check failed:', error.message);
          setAdminCheck({
            userId: user.id,
            isAdmin: false,
            checked: true,
          });
          return;
        }

        setAdminCheck({
          userId: user.id,
          isAdmin: Boolean(data),
          checked: true,
        });
      } catch (error) {
        if (!active) return;

        console.error('Admin role check exception:', error.message);

        setAdminCheck({
          userId: user.id,
          isAdmin: false,
          checked: true,
        });
      }
    }

    checkAdminRole();

    return () => {
      active = false;
    };
  }, [user, sessionChecked]);

  const isAdmin = Boolean(
    user &&
    adminCheck.userId === user.id &&
    adminCheck.checked &&
    adminCheck.isAdmin
  );

  const loading = Boolean(
    !sessionChecked ||
    (
      user &&
      (
        adminCheck.userId !== user.id ||
        !adminCheck.checked
      )
    )
  );

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        isAdmin,
        recoveryUserId,
        loading,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);

  if (!context) {
    throw new Error(
      'useAdminAuth must be used inside AdminAuthProvider.'
    );
  }

  return context;
}
