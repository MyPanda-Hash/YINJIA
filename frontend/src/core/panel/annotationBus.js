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
 *     ask: (fieldKey, start, end, at) => void,              // 标注笔:选了范围 → 弹色盘
 *     erase: (fieldKey, start, end) => void }               // 橡皮擦:擦这一段
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
