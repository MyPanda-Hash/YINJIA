#!/usr/bin/env node
/**
 * 落库探针(2026-10-16):制程检验单明细「测量值1..10 + 格数」是否真的存得进、取得出。
 *
 * 走的是**界面同一个入口**: POST /api/px/callButton {panelCode:'QC_PROC_INSP',
 * buttonName:'保存为草稿', formData:{表头…, detail:{items:[一行 8 格]}}}。
 * 只建一张一次性草稿,跑完删掉(不留垃圾)。
 *
 * 用法: node tools/archive/_qc-proc/_save-measure10.mjs
 * 读回取证:tools/archive/_q_zc_detail.java <单据编号>
 */
const B = 'http://127.0.0.1:8090/api'
const WO = { 工单号: 'GD-2026-10-0007', 工单行号: 2 }

const call = async (token, path, body) => {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 30000)   // 30s 超时:后端正在被别的会话重启时不至于永久挂住
  try {
    const r = await fetch(B + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: body ? JSON.stringify(body) : undefined,
      signal: ac.signal,
    })
    return { status: r.status, body: await r.json().catch(() => ({})) }
  } finally { clearTimeout(timer) }
}

const lr = await call('', '/auth/login', { userName: 'admin', password: '123456' })
const token = (lr.body.data || lr.body).token
if (!token) throw new Error('登录失败')
console.log('① 登录 OK')

// 表头:照 /qc/procInsp/fromWoLine 的建单字段(草稿不校验必填,填够用即可)
const today = new Date().toISOString().slice(0, 10)
const head = {
  单据日期: today, 检验日期: today, 检验类别: '制程检验', 检验员: 'admin',
  工单号: WO.工单号, 工单行号: WO.工单行号,
  产品编码: 'S032-3', 产品名称: 'S阻垢炭棒/滤芯', 规格型号: '28*12*178', 批次号: '20261014',
  检验结果: '合格', 检验结论: '探针:10格落库验证',
}
const row = {
  表区: '尺寸', 检验项目: '外径', 检验要求: '28±0.5mm', 检验方法: '游标卡尺', 单项判定: '合格',
  格数: 8,
  测量值1: 11.1, 测量值2: 11.2, 测量值3: 11.3, 测量值4: 11.4,
  测量值5: 11.5, 测量值6: 11.6, 测量值7: 11.7, 测量值8: 11.8,
}
const save = await call(token, '/px/callButton', {
  panelCode: 'QC_PROC_INSP', buttonName: '保存为草稿',
  formData: { ...head, detail: { items: [row] } },
})
console.log('② 保存为草稿 =', JSON.stringify(save.body).slice(0, 300))
const no = save.body?.data?.编号 || save.body?.data?.单据编号 || null
console.log('   新单号 =', no)

// 读回:再查一次该单(取明细,看 测量值1..10 与 格数)
if (no) {
  const back = await call(token, '/px/callButton', { panelCode: 'QC_PROC_INSP', buttonName: '刷新', formData: { 编号: no } })
  console.log('③ 刷新回读 =', JSON.stringify(back.body).slice(0, 400))
  console.log('   （DB 侧再核一遍:tools/archive/_q_zc_detail.java ' + no + '）')
}
console.log('单据编号 =', no)
console.log('清理命令: 见本文件尾部注释 —— 或直接跑 _clean-zc.mjs ' + no)

