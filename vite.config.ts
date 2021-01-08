import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { join } from 'path'
import { readFileSync } from 'fs'

const root = join(__dirname, './example')

export default defineConfig({
  root,
  alias: [
    {
      find: 'quill',
      replacement: join(__dirname, './src')
    }, {
      find: '@',
      replacement: join(__dirname, './example/src')
    }
  ],
  optimizeDeps: {
    // exclude: ['quill-delta/lib/op'],
    include: ['quill-delta/lib/op']
  },
  plugins: [
    vue(),
    {
      name: 'svg-loader',
      transform(src, id) {
        if (!/\.svg$/.test(id)) return;
        const content = readFileSync(id);
        return `export default \`${content}\``
      }
    }
  ]
})
