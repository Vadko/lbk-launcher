// rollup.config.js inlines a ?raw import as a string, like Vite does for main.
declare module '*?raw' {
  const source: string;
  export default source;
}
