import { useStore } from './useStore';

// A failed sync still leaves the local catalog readable
export const isCatalogReady = () => {
  const { syncStatus } = useStore.getState();
  return syncStatus === 'ready' || syncStatus === 'error';
};
