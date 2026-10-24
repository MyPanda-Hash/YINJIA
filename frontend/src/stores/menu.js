import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import request from '@core/request'
import { menuTree as BASE_TREE } from '@/business/menus'
import { applyMenuOverrides, pickVisibleTree } from '@/business/menuOverrides'

/**
 * 导航树(2026-10-23):代码基线 + 数据库覆盖(`yj_menu_node`)合并后的真源。
 *
 * 为什么要有 store:左栏 LeftNav、顶栏 TopBar(单据查询)、菜单设计器 三处都要同一棵树;
 * 各自去拉接口会出现「左栏已改、顶栏还是旧的」。这里只拉一次,保存后再 `load(true)` 刷新。
 *
 * 口径:
 *  · 拉不到覆盖(接口失败/未登录/老服务端没有该表)⇒ **一律按代码基线显示**,导航不能因为
 *    一个接口挂了就变空;错误只记在 console,不打扰用户。
 *  · `tree` = 合并结果(含隐藏项,设计器用);`visibleTree` = 去掉隐藏项(导航渲染用)。
 */
export const useMenuStore = defineStore('menu', () => {
  const rows = ref([])          // 覆盖行(后端原样)
  const loading = ref(false)
  const loaded = ref(false)     // 是否成功拉过一次(失败也算拉过,避免每次进页面都重试刷屏)
  const updatedAt = ref('')
  let inflight = null           // 同一次拉取的共享 Promise(见下方 load 头注)

  const tree = computed(() => applyMenuOverrides(BASE_TREE, rows.value))
  const visibleTree = computed(() => pickVisibleTree(tree.value))

  /**
   * 第一次调用会拉接口;之后直接用缓存。`force` 强制重拉(保存后/重置后用)。
   *
   * ⚠ 并发必须**共享同一个 Promise**,不能 `if (loading) return`:页面里 LeftNav 与菜单设计器会同时
   * 调它(实测 2026-10-23 踩过)—— 设计器先 `await` 到一个"立刻返回的空调用",于是拿着**未合并的
   * 代码基线**做工作副本,界面上看不到已保存的改名/隐藏(保存下去还会把定制抹掉)。
   */
  async function load(force = false) {
    if (!force && loaded.value) return
    if (inflight) return inflight
    inflight = (async () => {
      loading.value = true
      try {
        const r = await request.get('/sys/menu/nodes')
        const d = r?.data || {}
        rows.value = Array.isArray(d.nodes) ? d.nodes : []
        updatedAt.value = d.nodes?.[0]?.updatedAt || ''
        loaded.value = true
      } catch (e) {
        // 覆盖层不可用不影响导航:按代码基线渲染,仅留痕
        console.warn('[menu] 读取菜单覆盖失败,按代码基线显示:', e?.message || e)
        loaded.value = true
      } finally {
        loading.value = false
        inflight = null
      }
    })()
    return inflight
  }

  /** 保存/重置后直接塞新数据(不额外往返一次接口) */
  function setRows(list) {
    rows.value = Array.isArray(list) ? list : []
    loaded.value = true
  }

  /** 退出登录时清空,换账号/账套不会带着上一个的菜单 */
  function clear() {
    rows.value = []
    loaded.value = false
    updatedAt.value = ''
  }

  return { rows, loading, loaded, updatedAt, tree, visibleTree, load, setRows, clear }
})
