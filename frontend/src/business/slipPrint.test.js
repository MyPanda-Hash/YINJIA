/**
 * slipPrint.test.js — 三张扫码单纸面报表的口径单测(2026-11-16)
 *
 * 钉住三件事:
 *  ① kind → 面板/打印类型/标题 的对应(其他退料与生产退料**同面板不同 kind**,最容易串);
 *  ② 二维码的「对应关系」:`YJSLIP:KIND:DOCNO` 能原样解析回来,别的东西(物料码/工单码)不许误认;
 *  ③ 载荷字段:标题、单号、部门、日期、二维码内容、明细(原样透传,不二次翻译键名)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SLIP_KINDS, SLIP_QR_PREFIX, isSlipKind, panelOfKind, typeOfKind, titleOfKind,
  slipQrText, parseSlipQr, buildSlipPayload,
} from './slipPrint.js'

test('三种报表 → 面板 / 打印类型 / 标题', () => {
  assert.deepEqual(Object.keys(SLIP_KINDS), ['OTHER_PICK', 'OTHER_RET', 'MAT_RET'])
  assert.equal(panelOfKind('OTHER_PICK'), 'OTHER_OUT', '其他领料落其他出库单')
  assert.equal(panelOfKind('OTHER_RET'), 'MATERIAL_RET', '其他退料落生产退料单')
  assert.equal(panelOfKind('MAT_RET'), 'MATERIAL_RET', '生产退料也落生产退料单')

  // 打印类型必须与后端 PrintStationController.PRINT_TYPES 的键逐字一致
  assert.equal(typeOfKind('OTHER_PICK'), 'OTHER_PICK_SLIP')
  assert.equal(typeOfKind('OTHER_RET'), 'OTHER_RET_SLIP')
  assert.equal(typeOfKind('MAT_RET'), 'MAT_RET_SLIP')

  assert.equal(titleOfKind('OTHER_PICK'), '其他领料单')
  assert.equal(titleOfKind('OTHER_RET'), '其他退料单')
  assert.equal(titleOfKind('MAT_RET'), '生产退料单')

  // 非法 kind:一律空串(调用方据此报错,绝不猜成别的报表)
  assert.equal(panelOfKind('PICK'), '')
  assert.equal(typeOfKind(''), '')
  assert.equal(titleOfKind('other_pick'), '', 'kind 大小写敏感')
  assert.equal(isSlipKind('OTHER_PICK'), true)
  assert.equal(isSlipKind('NOPE'), false)
})

test('二维码内容 ↔ 解析 往返一致', () => {
  for (const kind of ['OTHER_PICK', 'OTHER_RET', 'MAT_RET']) {
    const text = slipQrText(kind, 'OO-2026-11-0005')
    assert.equal(text, `${SLIP_QR_PREFIX}:${kind}:OO-2026-11-0005`)
    assert.deepEqual(parseSlipQr(text), { kind, docNo: 'OO-2026-11-0005' })
  }
  // 参数不全 ⇒ 不出码(宁可没有码,也不要出一个扫了没用的码)
  assert.equal(slipQrText('OTHER_PICK', ''), '')
  assert.equal(slipQrText('NOPE', 'OO-1'), '')
  assert.equal(slipQrText('', 'OO-1'), '')
})

test('解析:只认自己的前缀,不误认物料码与工单码', () => {
  // 物料条码(存货编码|批号)/ 公司代码式 —— 都必须当成"不是单据码"
  assert.equal(parseSlipQr('YJ-KBL-012|PC0000'), null)
  assert.equal(parseSlipQr('0@GD-2026-11-0010@1001'), null, '工单二维码不能被当单据码')
  // 前缀对但内容不对
  assert.equal(parseSlipQr('YJSLIP:OTHER_PICK'), null, '缺单号')
  assert.equal(parseSlipQr('YJSLIP::OO-1'), null, '缺 kind')
  assert.equal(parseSlipQr('YJSLIP:PICK:OO-1'), null, '不认识的 kind')
  assert.equal(parseSlipQr('XXX:OTHER_PICK:OO-1'), null, '前缀不对')
  assert.equal(parseSlipQr(''), null)
  assert.equal(parseSlipQr(null), null)
  // 大小写/空白容错(扫码枪偶尔带空格,前缀大小写也可能被输入法改)
  assert.deepEqual(parseSlipQr('  yjslip:other_pick:OO-2026-11-0005  '),
    { kind: 'OTHER_PICK', docNo: 'OO-2026-11-0005' })
})

test('载荷:标题/单号/部门/日期/二维码内容齐,明细原样透传', () => {
  const rows = [{ 材料名称: 'PP棉', 规格: '45*16*109', 单位: '支', 请领数量: 0, 实发数量: 3, 备注: 'PC0000 / 恒亿仓' }]
  const p = buildSlipPayload({
    kind: 'OTHER_RET',
    docNo: 'TL-2026-11-0007',
    data: { 单据编号: 'TL-2026-11-0007', 单据日期: '2026-11-16', 部门: '系统管理员', 明细: rows },
  })
  assert.equal(p.标题, '其他退料单')
  assert.equal(p.领料单号, 'TL-2026-11-0007')
  assert.equal(p.领料部门, '系统管理员')
  assert.equal(p.打印日期, '2026-11-16', '纸面日期用单据日期,补打印隔几天也不会显示成打印当天')
  assert.equal(p.二维码内容, 'YJSLIP:OTHER_RET:TL-2026-11-0007')
  assert.deepEqual(p.明细, rows, '明细必须原样透传(键是代理要的那一套,不能二次翻译)')

  // 后端没给日期时用调用方给的今天;都没有就留空(不瞎写)
  assert.equal(buildSlipPayload({ kind: 'OTHER_PICK', docNo: 'OO-1', data: {}, today: '2026-11-16' }).打印日期, '2026-11-16')
  assert.equal(buildSlipPayload({ kind: 'OTHER_PICK', docNo: 'OO-1', data: {} }).打印日期, '')
  // 单号优先取入参,其次后端返回值
  assert.equal(buildSlipPayload({ kind: 'OTHER_PICK', docNo: '', data: { 单据编号: 'OO-9' } }).领料单号, 'OO-9')
  // 明细缺失时给空数组,纸面走空白表而不是 undefined 崩
  assert.deepEqual(buildSlipPayload({ kind: 'MAT_RET', docNo: 'TL-1', data: {} }).明细, [])
})
