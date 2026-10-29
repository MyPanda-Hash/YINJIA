/**
 * annotationBus.js —— 「标注笔/橡皮擦」状态的注入总线。
 *
 * 【为什么用 provide/inject 而不是逐层传 prop】
 * 标注要落在**纸面每个只读值格**上,而纸面由 RecordSheetPanels 渲染、侧栏按钮由 PanelxList 渲染,
 * 两者隔着好几层。逐层透传 annotation/mode/回调要给每个中间组件加 3 个 prop;
 * provide/inject 让纸面里的 AnnotatedText 直接拿到上下文 ⇒ 每处渲染点只改一行模板。
 *
 * 注入对象形状(由 PanelxList 提供):
 *   { anns: Ref<{[fieldKey]: [{start,end,color,bold}]}>,   // 当前单据的标注
 *     mode: Ref<'pen'|'eraser'|null>,                       // 当前模式(决定是否可交互)
 *     active: Ref<boolean>,                                 // 是否已载单据(没单据不标注)
 *     penReady: Ref<boolean>,                               // 纸面可直接划选标注吗(2026-10-27 新增)
 *     ask: (fieldKey, start, end, at) => void,              // 标注笔:选了范围 → 弹色盘
 *     erase: (fieldKey, start, end) => void }               // 橡皮擦:擦这一段
 *
 * penReady 与 mode 的分工(2026-10-27 #11「字体颜色标注调出易误操作,需要简化」):
 *   旧实现把"能否划选"绑死在 mode==='pen' 上 ⇒ 必须先点「标注笔」进模式,而进模式会把
 *   **整张草稿纸切成只读**,用户以为点坏了、还容易忘了退出(这正是"易误操作"）。
 *   现在"能否划选"独立成 penReady:
 *     · 纸面本来就只读(已审核/已归档)⇒ penReady=true,直接划字就出色盘(少一步);
 *     · 纸面可编辑 ⇒ 仍要明确开「标注笔」,否则鼠标划选无法区分"选字改内容"与"要标注"。
 *   未提供 penReady 的旧调用方自动退回 mode 判据(AnnotatedText 内部兜底),零影响。
 */
import { inject, provide } from 'vue'

export const ANN_KEY = Symbol('mes-doc-annotation')

export function provideAnnotations(ctx) {
  provide(ANN_KEY, ctx)
}

/** 纸面里用:拿不到上下文(独立使用纸面组件/看板嵌入)时返回 null,渲染退化为纯文本 */
export function useAnnotations() {
  return inject(ANN_KEY, null)
}

/** 取某字段的标注数组(永远返回数组,调用方不用判空) */
export function annsOf(ctx, fieldKey) {
  if (!ctx || !ctx.anns || !fieldKey) return []
  return ctx.anns.value?.[fieldKey] || []
}
