/**
 * make-pending-docs.mjs — 为 UI 取证件造两张单(测试账套):
 *   ① 草稿单(应看到「保存 / 提交审批」)
 *   ② 待二级审批单(一级由冯敏通过;管理员打开应看到「批准通过 / 批准驳回」)
 * 只造数据,不做断言;断言在 probe-twolevel.mjs(接口级)与 ego 截图(界面级)。
 */
import { fetchRetry } from '../_apifetch.mjs'
const API = process.env.YJ_API || 'http://127.0.0.1:8090/api'
const PWD = '123456'

async function login(user) {
  const j = await (await fetchRetry(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: user, password: PWD, factory: 'YJ_TEST' }),
  })).json()
  if (!(j.code === 0 || j.code === 200)) throw new Error(user + ' 登录失败 ' + JSON.stringify(j).slice(0, 150))
  return j.data.token
}
const H = (t) => ({ 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + t })
const cb = async (t, btn, fd) => (await (await fetchRetry(API + '/px/callButton', {
  method: 'POST', headers: H(t), body: JSON.stringify({ panelCode: 'QC_JJF', buttonName: btn, formData: fd || {}, buttonParam: {} }),
})).json())
const ok = (j) => j.code === 0 || j.code === 200

const zfy = await login('zfy')
const fm = await login('fm')

async function makeDoc(tag, submit) {
  const mk = await cb(zfy, '新增流程', {})
  const no = String(mk.data?.['单据编号'] || mk.data?.编号 || '').trim()
  await cb(zfy, '保存', {
    编号: no, 单据编号: no, 物料类型: '外部来料', 物料名称: tag,
    物料编码: 'UI-' + Date.now().toString().slice(-6), 申请放行数量: 500, 批次号: '261112',
    紧急放行原因: 'UI 取证用:' + tag,
  })
  if (submit) {
    const s = await cb(zfy, '提交审批', { 编号: no, 单据编号: no })
    if (!ok(s)) throw new Error('提交失败 ' + JSON.stringify(s).slice(0, 150))
  }
  return no
}

const draftNo = await makeDoc('草稿态', false)
const l2No = await makeDoc('待二级态', true)
const l1 = await cb(fm, '审批通过', { 编号: l2No, 单据编号: l2No, 审批意见: '部门意见已确认' })
if (!ok(l1)) throw new Error('一级审批失败 ' + JSON.stringify(l1).slice(0, 200))
console.log(JSON.stringify({ draftNo, pendingL2No: l2No }))
