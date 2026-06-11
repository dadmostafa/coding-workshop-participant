import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: [
        'src/components/**/*.{js,jsx}',
        'src/context/**/*.{js,jsx}',
        'src/hooks/**/*.{js,jsx}',
        'src/utils/**/*.{js,jsx}',
        'src/services/**/*.{js,jsx}',
      ],
      exclude: ['src/tests/**', 'src/test-setup.js'],
      exclude: [
        'src/tests/**',
        'src/test-setup.js',
        'src/components/Layout.jsx',
        'src/components/StatusSelect.jsx',
        'src/components/TeamNotes.jsx',
        'src/components/Pagination.jsx',
        'src/components/TableSkeleton.jsx',
        'src/services/api.js',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    server: {
      deps: {
        inline: ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled']
      }
    }
  },
})
