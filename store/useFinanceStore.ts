import { create } from "zustand";

// UI-only state. Server data lives in TanStack Query.
interface FinanceUIState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  chatPanelOpen: boolean;
  setChatPanelOpen: (open: boolean) => void;
}

export const useFinanceStore = create<FinanceUIState>((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  chatPanelOpen: false,
  setChatPanelOpen: (open) => set({ chatPanelOpen: open }),
}));
