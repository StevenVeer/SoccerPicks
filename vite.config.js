import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { oddsApiPlugin } from './server/oddsApi.js';

export default defineConfig({
  plugins: [react(), oddsApiPlugin()],
});
