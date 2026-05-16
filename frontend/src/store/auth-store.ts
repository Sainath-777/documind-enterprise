import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setToken, clearToken, loginUser } from "@/lib/api-client";
import type { LoginRequest } from "@/types/api";

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (data: LoginRequest) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (data: LoginRequest): Promise<boolean> => {
        set({ isLoading: true, error: null });
        try {
          const response = await loginUser(data);
          setToken(response.access_token);
          set({
            token: response.access_token,
            isAuthenticated: true,
            isLoading: false,
          });
          return true;
        } catch (err: unknown) {
          set({
            error: (err as Error).message ?? "Authentication failed",
            isLoading: false,
            isAuthenticated: false,
          });
          return false;
        }
      },

      logout: () => {
        clearToken();
        set({ token: null, isAuthenticated: false, error: null });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "documind-auth",
      partialize: (state) => ({
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
