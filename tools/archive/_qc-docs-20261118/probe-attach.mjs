/**
 * probe-attach.mjs — 「可附图片」章节附件位端到端验收(2026-11-18)
 *
 * 验证:上传(multipart)→ 列表 → 单头 [附件] 列同步文件名 → 纸面组件可读 → 删除清空。
 * 锚点 = panelCode + 单据编号 + field_key「附件」(AttachmentService 表头附件口径)。
 * 跑在测试账套(YJ_TEST),用探针建出来的草稿单,验完删除附件并清理单据。
 */
import { fetchRetry } from '../_apifetch.mjs'
import { writeFileSync, readFileSync } from 'node:fs'

const API = process.env.YJ_API || 'http://127.0.0.1:8090/api'
const PANEL = 'QC_BHZ'
const PWD = '123456'
let pass = 0, fail = 0
const chk = (c, m, x) => { if (c) { pass++; console.log('  [PASS] ' + m) } else { fail++; console.log('  [FAIL] ' + m + (x === undefined ? '' : ' → ' + JSON.stringify(x))) } }
const S = (v) => (v == null ? '' : String(v).trim())

async function login(user) {
  const j = await (await fetchRetry(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: user, password: PWD, factory: 'YJ_TEST' }),
  })).json()
  if (!(j.code === 0 || j.code === 200)) throw new Error(user + ' 登录失败')
  return j.data.token
}
const H = (t) => ({ Authorization: 'Bearer ' + t })
const postJson = async (t, path, body) => (await fetchRetry(API + path, { method: 'POST', headers: { ...H(t), 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) })).json()
const ok = (j) => j.code === 0 || j.code === 200

const tok = await login('zfy')

// 造一张草稿单(BHZ)
const mk = await postJson(tok, '/px/callButton', { panelCode: PANEL, buttonName: '新增流程', formData: {}, buttonParam: {} })
const no = S(mk.data?.['单据编号'] || mk.data?.编号)
chk(!!no, '建单', mk)
await postJson(tok, '/px/callButton', { panelCode: PANEL, buttonName: '保存为草稿', formData: { 编号: no, 单据编号: no, 问题描述: '附件探针' }, buttonParam: {} })

// 上传
const tmp = 'C:/Users/vigna/ego/jjf-twolevel-20261117/attach-probe.txt'
writeFileSync(tmp, 'attachment probe 2026-11-18')
const fd = new FormData()
fd.append('file', new Blob([readFileSync(tmp)], { type: 'text/plain' }), '可附图片-探针.txt')
const url = `${API}/attachment/upload?panelCode=${encodeURIComponent(PANEL)}&docNo=${encodeURIComponent(no)}&field=${encodeURIComponent('附件')}`
const up = await (await fetchRetry(url, { method: 'POST', headers: H(tok), body: fd })).json()
chk(ok(up), '上传附件', up)
chk(Array.isArray(up.data?.files) && up.data.files.length === 1, '上传后文件数=1', up.data)
chk(S(up.data?.names).includes('可附图片-探针.txt'), '返回的文件名串含原名', up.data?.names)

// 列表
const ls = await (await fetchRetry(`${API}/attachment/list?panelCode=${encodeURIComponent(PANEL)}&docNo=${encodeURIComponent(no)}&field=${encodeURIComponent('附件')}`, { headers: H(tok) })).json()
chk(ok(ls) && (ls.data || []).length === 1, '列表可读到 1 个附件', ls.data)

// 单头列已同步(附件名进纸面/列表)
const doc = await (async () => {
  const j = await postJson(tok, '/px/queryFormDataList', { panelCode: PANEL, pageNo: 1, pageSize: 100 })
  return (j.data?.list || []).find((r) => S(r['单据编号']) === no)
})()
chk(S(doc?.['附件']).includes('可附图片-探针.txt'), '单据头 [附件] 列已同步文件名(WYSIWYG 打印)', doc?.['附件'])

// 删除
const id = ls.data[0].id
const del = await postJson(tok, '/attachment/delete', { id })
chk(ok(del), '删除附件', del)
chk((del.data?.files || []).length === 0, '删除后文件数=0', del.data)

console.log(`\n════ 结果: PASS ${pass} / FAIL ${fail }   单号 ${no} ════`)
process.exit(fail ? 1 : 0)
