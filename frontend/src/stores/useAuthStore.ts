import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { jwtDecode } from 'jwt-decode';

interface User {
  id: number;
  email: string;
  full_name?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
      isAuthenticated: () => {
        const token = get().token;
        if (!token) return false;
        try {
          const decoded: any = jwtDecode(token);
          const currentTime = Date.now() / 1000;
          return decoded.exp > currentTime;
        } catch (e) {
          return false;
        }
      },
    }),
    {
      name: 'lurio-auth-storage',
    }
  )
);
