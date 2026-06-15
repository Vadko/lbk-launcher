import { createElectronRouter } from 'electron-router-dom';

/**
 * electron-vite automatically provides ELECTRON_RENDERER_URL environment variable
 * Default port for electron-vite is 5173
 */
const { registerRoute } = createElectronRouter({
  port: 5173,
  types: {
    ids: ['main'],
  },
});

export { registerRoute };
