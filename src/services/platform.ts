/**
 * Platform & Runtime Adapter
 * Bridges Web Browser (PWA/SPA) and Universal Native App (Tauri v2 / Electron)
 * Enables 100% shared React components and business logic.
 */

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
  }
}

export interface PlatformCapabilities {
  isNative: boolean;
  isBrowser: boolean;
  platformName: 'tauri' | 'web';
  isMobileDevice: boolean;
  supportsNotifications: boolean;
}

export function isNativeApp(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

export function isBrowser(): boolean {
  return !isNativeApp();
}

export function getAppVersion(): string {
  return '2.1.0';
}

export function getPlatformCapabilities(): PlatformCapabilities {
  const isNative = isNativeApp();
  const isMobileDevice = typeof window !== 'undefined' && (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768
  );
  const supportsNotifications = typeof window !== 'undefined' && 'Notification' in window;

  return {
    isNative,
    isBrowser: !isNative,
    platformName: isNative ? 'tauri' : 'web',
    isMobileDevice,
    supportsNotifications,
  };
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (isNativeApp()) {
    try {
      const tauri = (window as unknown as { __TAURI__?: { notification?: { requestPermission: () => Promise<string>, isPermissionGranted: () => Promise<boolean> } } }).__TAURI__;
      if (tauri?.notification) {
        const granted = await tauri.notification.isPermissionGranted();
        if (granted) return true;
        const res = await tauri.notification.requestPermission();
        return res === 'granted';
      }
    } catch {
      // Fallback
    }
  }

  if ('Notification' in window) {
    const res = await Notification.requestPermission();
    return res === 'granted';
  }

  return false;
}

export async function sendAppNotification(title: string, body: string, icon = '/favicon.svg'): Promise<void> {
  if (typeof window === 'undefined') return;

  if (isNativeApp()) {
    try {
      const tauri = (window as unknown as { __TAURI__?: { notification?: { sendNotification: (options: { title: string; body: string }) => void } } }).__TAURI__;
      if (tauri?.notification) {
        tauri.notification.sendNotification({ title, body });
        return;
      }
    } catch {
      // Fallback
    }
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon,
      badge: icon,
    });
  }
}

export function getStoredPreference(key: string, defaultValue = ''): string {
  try {
    return localStorage.getItem(`academiasync_pref_${key}`) ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setStoredPreference(key: string, value: string): void {
  try {
    localStorage.setItem(`academiasync_pref_${key}`, value);
  } catch {
    // Ignore storage quota or access errors
  }
}
