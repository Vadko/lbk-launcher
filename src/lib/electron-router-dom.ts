import { createElectronRouter } from 'electron-router-dom';

/**
 * electron-vite automatically provides ELECTRON_RENDERER_URL environment variable
 * Default port for electron-vite is 5173
 */
const { Router, registerRoute, settings } = createElectronRouter({
  port: 5173,
  types: {
    ids: ['main'],
  },
});

export { Router, registerRoute, settings };
