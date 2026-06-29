import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'public',
    emptyOutDir: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/embed/chat-widget-entry.jsx'),
      output: {
        entryFileNames: 'chat-widget.js',
        format: 'iife',
      },
    },
  },
})
