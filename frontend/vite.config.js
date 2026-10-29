import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // Keep the React runtime stable across route chunks.
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
              priority: 30,
            },
            // Heavy editor/syntax-highlighting code is only needed by notebook
            // and highlighted-code views. Keep it out of the initial vendor chunk.
            // react-syntax-highlighter punya lazy-loader sendiri (HighlightedCode).
            {
              name: 'editor',
              test: /node_modules[\\/](@tiptap|prosemirror[^\\/]*|refractor|highlight\.js|prismjs|react-syntax-highlighter)[\\/]/,
              priority: 25,
            },
            // Parser HTML lengkap (dipakai rehype-raw) berat dan jarang berubah
            // — dipisah agar bisa diunduh paralel & tetap ter-cache saat
            // markdown ecosystem ikut version bump.
            {
              name: 'html-pipeline',
              test: /node_modules[\\/](parse5|hast-util-raw|web-namespaces)[\\/]/,
              priority: 26,
            },
            // Markdown rendering is used by chat/notebook, not the dashboard.
            {
              name: 'markdown',
              test: /node_modules[\\/](react-markdown|remark[^\\/]*|rehype[^\\/]*|micromark[^\\/]*|mdast[^\\/]*|hast[^\\/]*|unist[^\\/]*|unified|vfile[^\\/]*|property-information|space-separated-tokens|comma-separated-tokens|html-url-attributes|trim-lines|bail|trough|is-plain-obj|decode-named-character-reference|character-entities[^\\/]*|devlop|longest-streak|markdown-table|ccount|escape-string-regexp|zwitch|github-slugger|js-yaml|parse5|entities)[\\/]/,
              priority: 24,
            },
            {
              name: 'katex',
              test: /node_modules[\\/]katex[\\/]/,
              priority: 27,
            },
            {
              name: 'motion',
              test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/,
              priority: 22,
            },
            {
              name: 'query',
              test: /node_modules[\\/]@tanstack[\\/]/,
              priority: 21,
            },
            {
              name: 'icons',
              test: /node_modules[\\/]@material-symbols-svg[\\/]/,
              priority: 20,
            },
            {
              name: 'i18n',
              test: /node_modules[\\/](i18next|react-i18next|i18next-browser-languagedetector)[\\/]/,
              priority: 19,
            },
            {
              name: 'radix',
              test: /node_modules[\\/]@radix-ui[\\/]/,
              priority: 18,
            },
            {
              name: 'vendor',
              test: /node_modules[\\/]/,
              priority: 1,
            },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    hmr: { overlay: true },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/static': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
