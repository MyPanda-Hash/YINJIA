import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { mkdirSync } from 'node:fs'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

/**
 * esbuild 临时目录改到**仓库内**(2026-10-08,落实《开发与质量》§5.5 的 G11)。
 *
 * 症状:`npm run build` 死在 `[vite:esbuild-transpile] remove <TEMP>\esbuild-<hash>: Access is denied.`
 *   根因(这次查到底了):esbuild 的 JS 侧有一条分支 —— `esbuild/lib/main.js` 里
 *   `input.length > 1024 * 1024` 时(即**输入 >1MB**:本项目 element-plus 那块约 2MB 命中),
 *   它把源码写成 `%TEMP%/esbuild-<32字节hex>`,把**路径**交给 Go 服务,由 Go 读完删除。
 *   在本机那个 TEMP(如 `D:\DSHTemp`)上,Go 的删除被拒 ⇒ 整个构建失败。
 *   实测边界:78KB/102KB/512KB 输入正常,2MB 必失败;换成仓库内 `.esbuild-tmp` 后正常。
 *   (排除了两个常见误判:纯 Node 写+立刻删 400 轮全过,esbuild.exe 独立 --version 正常 ——
 *    不是全局文件锁、也不是二进制坏了,坏的只是那条临时文件路径所在的目录。)
 *
 * 为什么写在配置里而不是让人手工 export TEMP:**任何人**跑 `npm run build`/`npx vite build`/
 *   `build-appjar.ps1` 都会先加载本文件,这里在 esbuild 被 require 之前把 TEMP/TMP 定下来,
 *   于是"忘了设 TEMP 就构建不出来"这件事从**记忆负担**变成**配置事实**。
 *   `.esbuild-tmp/` 已在 .gitignore(勿删目录本身:别的脚本也当临时目录用)。
 */
const ESBUILD_TMP = fileURLToPath(new URL('../.esbuild-tmp/', import.meta.url))
try {
  mkdirSync(ESBUILD_TMP, { recursive: true })
  process.env.TEMP = ESBUILD_TMP
  process.env.TMP = ESBUILD_TMP
} catch {
  // 建不出来(只读盘等)就保持系统 TEMP:构建可能仍因 G11 失败,但不该在这里把 vite 打死
}

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
