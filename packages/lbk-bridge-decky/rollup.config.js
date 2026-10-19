import deckyPlugin from '@decky/rollup';

export default deckyPlugin({
  // lucide-react marks its modules "use client", which only a server-components bundler reads.
  onwarn(warning, warn) {
    if (warning.code !== 'MODULE_LEVEL_DIRECTIVE') {
      warn(warning);
    }
  },
});
