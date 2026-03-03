'use client';

import { createContext, useContext, useCallback, useSyncExternalStore } from 'react';
import { IconSun, IconMoon } from '@/lib/icons';

const ThemeContext = createContext({
    theme: 'light',
    toggleTheme: () => { },
    setTheme: () => { },
});

export function useTheme() {
    return useContext(ThemeContext);
}

// External store for theme state — avoids setState-in-effect issues
let currentTheme = 'light';
let listeners = new Set();

function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function getSnapshot() {
    return currentTheme;
}

function getServerSnapshot() {
    return 'light';
}

function setThemeValue(newTheme) {
    currentTheme = newTheme;
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('printflow_theme', newTheme);
    listeners.forEach(l => l());
}

export function ThemeProvider({ children }) {
    const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    // Initialize from localStorage/system preference on first client render
    if (typeof window !== 'undefined' && currentTheme === 'light') {
        const saved = localStorage.getItem('printflow_theme');
        if (saved && saved !== currentTheme) {
            currentTheme = saved;
        } else if (!saved) {
            localStorage.setItem('printflow_theme', 'light');
            document.documentElement.setAttribute('data-theme', 'light');
        }
    }

    const setTheme = useCallback((newTheme) => {
        setThemeValue(newTheme);
    }, []);

    const toggleTheme = useCallback(() => {
        setThemeValue(currentTheme === 'dark' ? 'light' : 'dark');
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

/**
 * Toggle button component
 */
export function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label="Toggle theme"
        >
            {theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
        </button>
    );
}
