import { create } from 'zustand';

export type ViewMode = 'beginner' | 'advanced';
export type Theme = 'light' | 'dark';

interface AppState {
  viewMode: ViewMode;
  theme: Theme;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;

  // Probed pixel across linked views
  probedPixel: { x: number; y: number; r: number; s?: number } | null;
  setProbedPixel: (pixel: { x: number; y: number; r: number; s?: number } | null) => void;

  // Histogram range brush [minR, maxR]
  brushedRange: [number, number] | null;
  setBrushedRange: (range: [number, number] | null) => void;
}

const getInitialViewMode = (): ViewMode => {
  if (typeof window === 'undefined') return 'beginner';
  const urlParams = new URLSearchParams(window.location.search);
  const viewParam = urlParams.get('view');
  if (viewParam === 'advanced' || viewParam === 'beginner') {
    return viewParam;
  }
  const stored = localStorage.getItem('viewMode');
  return stored === 'advanced' ? 'advanced' : 'beginner';
};

const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const useAppStore = create<AppState>((set) => ({
  viewMode: getInitialViewMode(),
  theme: getInitialTheme(),

  setViewMode: (mode) => {
    localStorage.setItem('viewMode', mode);
    // sync to URL without reloading
    const url = new URL(window.location.href);
    url.searchParams.set('view', mode);
    window.history.replaceState({}, '', url.toString());
    set({ viewMode: mode });
  },

  toggleViewMode: () => {
    set((state) => {
      const next = state.viewMode === 'beginner' ? 'advanced' : 'beginner';
      localStorage.setItem('viewMode', next);
      const url = new URL(window.location.href);
      url.searchParams.set('view', next);
      window.history.replaceState({}, '', url.toString());
      return { viewMode: next };
    });
  },

  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    set({ theme });
  },

  toggleTheme: () => {
    set((state) => {
      const next = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', next);
      if (next === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return { theme: next };
    });
  },

  probedPixel: null,
  setProbedPixel: (pixel) => set({ probedPixel: pixel }),

  brushedRange: null,
  setBrushedRange: (range) => set({ brushedRange: range }),
}));
