import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;

      if (error) {
        console.error('Session check failed:', error);
      }

      setUser(data?.session?.user ?? null);
      setSessionChecked(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      setUser(session?.user ?? null);
      setSessionChecked(true);
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
        setIsAdmin(false);
        setRoleLoading(false);
        return;
      }

      setRoleLoading(true);

      const { data, error } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error('Admin role check failed:', error);
        setIsAdmin(false);
      } else {
        setIsAdmin(Boolean(data));
      }

      setRoleLoading(false);
    }

    checkAdminRole();

    return () => {
      active = false;
    };
  }, [user, sessionChecked]);

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        isAdmin,
        loading: !sessionChecked || roleLoading,
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
