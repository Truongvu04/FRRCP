import { createContext, useContext } from "react";

export type AuthModalMode = "login" | "register" | "forgot";

type AuthModalContextType = {
  openLogin: boolean;
  setOpenLogin: React.Dispatch<React.SetStateAction<boolean>>;
  authMode: AuthModalMode;
  setAuthMode: React.Dispatch<React.SetStateAction<AuthModalMode>>;
};

export const AuthModalContext = createContext<AuthModalContextType | null>(null);

export const useAuthModal = () => {
  const context = useContext(AuthModalContext);

  if (!context) {
    throw new Error("useAuthModal must be used inside AuthModalContext.Provider");
  }

  return context;
};