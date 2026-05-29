import { useEffect } from 'react';
import { useAppStore } from '../stores/app-store';

export const useShortcuts = (openConnection: () => void, toggleTransfers: () => void, requestDownload: () => void): void => {
  const store = useAppStore();
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        openConnection();
      }
      if (mod && event.key.toLowerCase() === 'u') {
        event.preventDefault();
        void store.chooseUploadFiles();
      }
      if (mod && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        requestDownload();
      }
      if (event.key === 'F5') {
        event.preventDefault();
        void store.refresh();
      }
      if (event.key === 'Delete') {
        event.preventDefault();
        void store.deleteSelected();
      }
      if (mod && event.key.toLowerCase() === 'j') {
        event.preventDefault();
        toggleTransfers();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openConnection, requestDownload, store, toggleTransfers]);
};
