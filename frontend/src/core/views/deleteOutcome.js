/**
 * deleteOutcome.js —— 「删除」按钮的结果提示口径(纯函数,可 node --test 断言)
 *
 * 背景(2026-11-04 用户报障):
 *   「这个单据使用陈秀丽的账号删除单据的时候显示删除成功了,但是实际上还没有删除成功,
 *     我使用管理员账号删除之后才删掉的」
 *
 * 原因:文件类面板(规格书/成型工艺清单/组装工艺清单/出货检验计划表 等)的「删除」对
 *   **非管理员 + 非草稿**单据**不会真删** —— 服务端 `ButtonService.deleteDocFile` 只落一条
 *   「删除申请」(`yj_doc_status.deleting='Y'`),等管理员在「删除审批」里通过才真正作废。
 *   前端却无条件弹「「删除」成功」⇒ 用户以为删掉了,单据其实还在列表里。
 *
 * 口径:**只认服务端回写的真实状态**(`res.单据状态`),不猜、不按"有没有报错"推断。
 *   服务端 ButtonService.docStatusOf 是这套状态的唯一真源,前端只做文案翻译。
 */

/** 「删除」动作的反馈等级:'success' | 'warning' | 'info' */
/**
 * @param {string} status 服务端回写的 `单据状态`(可能为空:老 jar / 非文书面板)
 * @returns {{level:'success'|'warning'|'info', key:string, fallback:string}}
 *   level     —— ElMessage 的等级
 *   key       —— 走 tt() 的中文键(多语言)
 *   fallback  —— 无状态时拼进文案的补充说明(如「（删除申请中）」),空串表示不加
 */
export function deleteOutcome(status) {
  const st = String(status ?? '').trim()
  // 真删了:草稿删除走 voidDoc ⇒ 已作废
  if (st === '已作废') return { level: 'success', key: '单据已删除', fallback: '' }
  // 只是提交了申请:文件类面板非管理员删已归档单据的唯一路径
  if (st === '删除申请中') {
    return { level: 'warning', key: '删除申请已提交，待管理员审批通过后才会真正删除', fallback: '' }
  }
  // 服务端没回状态(老 jar / 非文书面板):如实说"已提交",绝不谎报"已删除"
  return { level: 'info', key: '「删除」已提交', fallback: st ? `（${st}）` : '' }
}
