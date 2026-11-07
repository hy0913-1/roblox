import { defineConfig } from 'vite';

// base './' : 어느 경로(itch.io, GitHub Pages 등)에 올려도 동작하게 상대 경로로 빌드한다.
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1600 },
  server: { host: true },
});
