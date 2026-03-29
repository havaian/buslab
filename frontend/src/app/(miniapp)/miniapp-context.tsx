"use client";

import { createContext, useContext } from "react";

export interface MiniAppUser {
  id: string;
  telegramId: number;
  firstName: string;
  lastName: string;
  username: string;
  role: "user" | "student" | "admin";
}

export interface MiniAppContextValue {
  user: MiniAppUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

export const MiniAppContext = createContext<MiniAppContextValue>({
  user: null,
  token: null,
  loading: true,
  error: null,
});

export const useMiniApp = () => useContext(MiniAppContext);
