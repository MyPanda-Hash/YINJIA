/**
 * scanFocus.js — PDA 连扫光标(2026-11-16 用户口径)
 *
 * 用户原话:
 *   「手机扫码的所有的扫码都需要做到刚进入和扫码结束后光标在二维码查询的那一栏,
 *     方便 pda 多次扫码使用」
 *   「如果是领料的话,就是填完数量确定后再次回到二维码光标」
 *
 * 为什么需要它:PDA 的扫码枪是**当作键盘**往当前焦点里"打字 + 回车"的。
 *   焦点一旦跑到数量框、按钮或页面空白上,下一次扣扳机就是"打空"——
 *   现场表现为「扫了没反应」,人只能腾出手指去点一下输入框,连扫就断了。
 *   所以这几个扫码页要保证:
 *     ① 进页面 → 光标就在扫码框(不用点);
 *     ② 扫完一条(接口回来、列表刷新后)→ 光标回到扫码框,好接着扫下一条;
 *     ③ 领料页「填数量 → 添加/确定」之后 → 光标同样回到扫码框。
 *
 * 用法(页面里):
 *   const { focusScan } = useScanFocus(() => (wo.value ? matInput : woInput))
 *   // 手写焦点转移(可选):focusScan({ delay: 120 })
 *
 * `getTarget` 可以返回 **ref 对象**、**DOM 元素**、**ElInput 组件实例**,或它们的 getter 结果;
 * 函数形式是为了"目标会变"(先扫工单 → 焦点要去物料框;提交清空后 → 又回到工单框)。
 *
 * ⚠ 两个坑:
 *   1. 必须等 `nextTick`(Element Plus 的 el-input 要等 DOM 那一帧);
 *      行内确认/接口回来之后场景再给一点 delay,免得被 ElMessage / 列表重渲染抢走;
 *   2. 不要 `blur` 之后就完事 —— 也要 `select()`,把上一次的码选中,
 *      否则扫码枪逐字输入会和旧值拼在一起(变成 `0@A0@B` 这种鬼码)。
 */
import { nextTick, onActivated, onMounted } from 'vue'

/**
 * 把焦点(并选中已有内容)放到扫码框上。
 *
 * @param {*} target ref / DOM / ElInput 实例 / 返回它们的函数
 * @param {{delay?:number}} [opts] delay 毫秒后再聚焦(等动画、等消息条、等列表重渲染)
 */
export function focusScanNow(target, { delay = 0 } = {}) {
  const run = () => {
    try {
      const v = typeof target === 'function' ? target() : target
      if (!v) return
      const host = v.$el ?? v // ElInput 组件实例 → 根 DOM;DOM 元素 → 自己
      // el-input 根节点里才是真正的 <input>;直接传 DOM input 时 querySelector 落空就用自己
      const input = host?.querySelector ? (host.querySelector('input, textarea') || host) : host
      input?.focus?.()
      input?.select?.()
    } catch {
      // 聚焦失败不能影响业务(比如页面正在卸载)
    }
  }
  if (delay > 0) {
    setTimeout(() => nextTick(run), delay)
    return
  }
  nextTick(run)
}

/**
 * 页面级扫码聚焦:进页面自动聚焦 + 给页面一个 `focusScan()` 手动调用。
 *
 * @param {Function} getTarget 返回当前该聚焦的扫码框
 * @param {{mountDelay?:number, activateDelay?:number}} [opts]
 */
export function useScanFocus(getTarget, { mountDelay = 350, activateDelay = 150 } = {}) {
  const focusScan = (opts = {}) => focusScanNow(getTarget, opts)
  // keep-alive 缓存的页面:切回来也要落回扫码框(只挂 onMounted 的话第二次进来就没焦点了)
  onMounted(() => focusScan({ delay: mountDelay }))
  onActivated(() => focusScan({ delay: activateDelay }))
  return { focusScan }
}
