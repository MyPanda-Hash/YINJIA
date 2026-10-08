import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  plugins: [
    vue(),
    // Element Plus 按需引入(模板组件自动注册+按组件带样式;2026-09-28 性能优化,
    // 全量引入时代主包 2.5MB)。JS API(ElMessage/ElMessageBox/ElNotification)与
    // v-loading 指令的样式/注册在 main.js 手动补——resolver 只覆盖模板组件。
    Components({ resolvers: [ElementPlusResolver()], dts: false }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // 通用引擎层（跨项目可复用），业务层用 '@/business/...' 访问
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // vendor 分包:业务代码迭代不击穿框架库的浏览器长效缓存
        manualChunks: {
          'element-plus': ['element-plus'],
          'element-icons': ['@element-plus/icons-vue'],
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
        },
      },
    },
  },
  server: {
    // 局域网可访问（同事浏览器访问 http://<本机IP>:5173；Windows 防火墙需放行 5173）
    host: true,
    port: 5173,
    // 端口钉死:5173 被占用时直接报错,不要静默漂到 5174 ——
    // 后端 8090 / 前端 5173 是约定端口,漂了之后本机代理、同事书签、
    // 探针脚本(写死 5173)会全部指向一个没人监听的地址。
    strictPort: true,
    // 忽略第三方程序(如 DSH Desktop)在源码目录创建的临时文件,避免 chokidar EBUSY 崩溃
    watch: {
      ignored: ['**/*.tmpdir/**', '**/*.tmp'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8090',
        changeOrigin: true,
      },
    },
  },
  // vite preview（构建产物本地预览/共享时同样代理平台）
  preview: {
    host: true,
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://localhost:8090',
        changeOrigin: true,
      },
    },
  },
})
