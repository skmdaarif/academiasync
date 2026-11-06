import { ThemeKey } from '../types';

export interface ThemeConfig {
  name: string;
  key: ThemeKey;
  icon: string;
  bgGradient: string;
  headerBg: string;
  cardBg: string;
  cardBorder: string;
  accent: string;
  accentHover: string;
  accentGlow: string;
  badgeBg: string;
  textPrimary: string;
  textSecondary: string;
  bodyBg: string;
}

export const THEMES: Record<ThemeKey, ThemeConfig> = {
  'dark-slate': {
    name: 'Dark Slate Pro',
    key: 'dark-slate',
    icon: '🌙',
    bodyBg: '#0b0f19',
    bgGradient: 'radial-gradient(ellipse at top, #1e1b4b 0%, #0b0f19 70%)',
    headerBg: 'rgba(15, 23, 42, 0.85)',
    cardBg: 'rgba(30, 41, 59, 0.6)',
    cardBorder: 'rgba(255, 255, 255, 0.08)',
    accent: '#6366f1',
    accentHover: '#4f46e5',
    accentGlow: 'rgba(99, 102, 241, 0.25)',
    badgeBg: 'rgba(99, 102, 241, 0.15)',
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
  },
  'midnight-oled': {
    name: 'Midnight OLED',
    key: 'midnight-oled',
    icon: '✨',
    bodyBg: '#000000',
    bgGradient: 'radial-gradient(ellipse at top, #0f172a 0%, #000000 80%)',
    headerBg: 'rgba(0, 0, 0, 0.9)',
    cardBg: 'rgba(15, 23, 42, 0.75)',
    cardBorder: 'rgba(56, 189, 248, 0.2)',
    accent: '#38bdf8',
    accentHover: '#0284c7',
    accentGlow: 'rgba(56, 189, 248, 0.3)',
    badgeBg: 'rgba(56, 189, 248, 0.15)',
    textPrimary: '#ffffff',
    textSecondary: '#94a3b8',
  },
  'cyberpunk': {
    name: 'Cyberpunk Neon',
    key: 'cyberpunk',
    icon: '⚡',
    bodyBg: '#090514',
    bgGradient: 'radial-gradient(circle at 50% 0%, #3b0764 0%, #090514 75%)',
    headerBg: 'rgba(18, 10, 36, 0.9)',
    cardBg: 'rgba(29, 15, 53, 0.65)',
    cardBorder: 'rgba(236, 72, 153, 0.3)',
    accent: '#f43f5e',
    accentHover: '#e11d48',
    accentGlow: 'rgba(244, 63, 94, 0.35)',
    badgeBg: 'rgba(236, 72, 153, 0.2)',
    textPrimary: '#fdf4ff',
    textSecondary: '#d8b4fe',
  },
  'emerald-forest': {
    name: 'Emerald Matrix',
    key: 'emerald-forest',
    icon: '🌲',
    bodyBg: '#021814',
    bgGradient: 'radial-gradient(ellipse at top, #064e3b 0%, #021814 75%)',
    headerBg: 'rgba(4, 30, 24, 0.9)',
    cardBg: 'rgba(6, 44, 35, 0.65)',
    cardBorder: 'rgba(16, 185, 129, 0.25)',
    accent: '#10b981',
    accentHover: '#059669',
    accentGlow: 'rgba(16, 185, 129, 0.3)',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    textPrimary: '#ecfdf5',
    textSecondary: '#a7f3d0',
  },
  'sunset-amber': {
    name: 'Sunset Amber',
    key: 'sunset-amber',
    icon: '🌅',
    bodyBg: '#120d0a',
    bgGradient: 'radial-gradient(ellipse at top, #451a03 0%, #120d0a 75%)',
    headerBg: 'rgba(28, 19, 14, 0.9)',
    cardBg: 'rgba(43, 29, 21, 0.65)',
    cardBorder: 'rgba(245, 158, 11, 0.25)',
    accent: '#f59e0b',
    accentHover: '#d97706',
    accentGlow: 'rgba(245, 158, 11, 0.3)',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    textPrimary: '#fffbeb',
    textSecondary: '#fde68a',
  },
  'light-minimal': {
    name: 'Clean Minimalist',
    key: 'light-minimal',
    icon: '☀️',
    bodyBg: '#f8fafc',
    bgGradient: 'radial-gradient(ellipse at top, #e2e8f0 0%, #f8fafc 80%)',
    headerBg: 'rgba(255, 255, 255, 0.9)',
    cardBg: 'rgba(255, 255, 255, 0.85)',
    cardBorder: 'rgba(203, 213, 225, 0.8)',
    accent: '#4f46e5',
    accentHover: '#4338ca',
    accentGlow: 'rgba(79, 70, 229, 0.15)',
    badgeBg: 'rgba(79, 70, 229, 0.1)',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
  }
};
