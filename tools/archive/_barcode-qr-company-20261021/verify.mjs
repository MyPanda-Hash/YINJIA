/**
 * verify.mjs — 材料仓条码标签二维码口径取证(2026-10-21)
 *
 * 数据 = 正式账套 HSDZ_MES 的 v_barcode_material 实测行(q2.sql 取出,原样抄进来;
 *   探针不连库,便于在任何机器上复跑)。
 * 断言:
 *   ① 材料仓二维码 = 公司代码@存货编码@批号(批号空 → 两段);
 *   ② 码内容列(勾选行键/留痕键)保持 存货编码|批号 不变;
 *   ③ 半成品/成品二维码仍是码内容(本次只改材料仓);
 *   ④ 新码能被扫码领料/工单扫码领料的 parseBarcode 解析回「存货编码+批号」—— 不改坏现有扫码作业。
 * 用法:node tools/archive/_barcode-qr-company-20261021/verify.mjs
 */
import { barcodeLabelOf } from '../../../frontend/src/core/panel/barcodeLabel.js'
import { parseBarcode } from '../../../frontend/src/business/scanPick.js'

const matRows = [
  { 存货编码: 'Y-S-Z', 批号: '20261021004', 码内容: 'Y-S-Z|20261021004', 存货名称: '八水合氧氯化锆', 数量: 100, 计量单位: 'kg', 单据编号: 'PI-2026-10-0026', 单据日期: '2026-10-21', 仓库映射: '(未映射)', 供应商: '江苏文茹科技化工有限公司' },
  { 存货编码: 'YJ-KBL-021', 批号: '20261021001', 码内容: 'YJ-KBL-021|20261021001', 存货名称: '气泡袋', 数量: 100, 计量单位: '个', 单据编号: 'PI-2026-10-0024', 单据日期: '2026-10-21', 仓库映射: '(未映射)', 供应商: '惠州市康佰利包装材料有限公司' },
  // 批号空 → 两段
  { 存货编码: 'M-001', 批号: '', 码内容: 'M-001', 存货名称: '端盖', 数量: 5, 计量单位: '个', 单据编号: 'PI-2026-10-0001', 单据日期: '2026-10-20' },
]
const wipRow = { 码内容: 'S022-4|20261014', 产品名称: 'A+级烧结炭棒/滤芯', 批号: '20261014', 报工数量: 160, 计量单位: '支', 报工单号: 'BG-2026-10-0001', 生产日期: '2026-10-16' }
const finRow = { 码内容: 'TS45|20261014001', 产品名称: 'TS45', 批号: '20261014001', 实收数量: 123, 计量单位: 'kg', 单据编号: 'CPRK-20261014-00005', 单据日期: '2026-10-14', 仓库名称: '恒亿仓' }

let bad = 0
const check = (cond, msg) => { console.log(`${cond ? '[PASS]' : '[FAIL]'} ${msg}`); if (!cond) bad += 1 }

console.log('=== 材料仓 BARCODE_MAT ===')
for (const r of matRows) {
  const lb = barcodeLabelOf('BARCODE_MAT', r)
  const expect = ['0', r.存货编码, r.批号].filter(Boolean).join('@')
  console.log(`  码内容=${lb.code}  二维码=${lb.qrText}`)
  check(lb.code === r.码内容, `码内容列保持原值 ${r.码内容}`)
  check(lb.qrText === expect, `二维码 = ${expect}`)
  const parsed = parseBarcode(lb.qrText)
  check(parsed.ok && parsed.code === r.存货编码 && parsed.batch === r.批号,
    `扫码解析回 编码=${r.存货编码} 批号=${r.批号 || '(空)'}`)
}

console.log('=== 半成品/成品(本次不动)===')
for (const [panel, row] of [['BARCODE_WIP', wipRow], ['BARCODE_FIN', finRow]]) {
  const lb = barcodeLabelOf(panel, row)
  console.log(`  ${panel} 码内容=${lb.code}  二维码=${lb.qrText}`)
  check(lb.qrText === lb.code, `${panel} 二维码仍=码内容`)
}

console.log(bad === 0 ? '\n[OK] 全部通过' : `\n[FAIL] ${bad} 项未通过`)
process.exit(bad === 0 ? 0 : 1)
