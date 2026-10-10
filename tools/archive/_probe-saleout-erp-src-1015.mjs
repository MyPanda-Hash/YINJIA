/**
 * 探针(2026-10-15):验证「销售出库单转ERP 挂源销售订单」的**代码契约**(不联网、不写单)。
 *
 * 能验什么 / 不能验什么(必须说清,避免"看起来验过了"):
 *   ✅ 能验:常量与路径确实写进了产物里(SO_BILL_TYPE / SO_LIST_PATH / resolveSoRefs 存在);
 *          头字段读的是 bd_sale_out.销售订单号、行行号读的是 bl_sale_out.源单行号;
 *          行上确实会写 src_bill_no / src_bill_type_id / src_bill_type_number / src_bill_type_name
 *          / src_inter_id / src_seq / src_entry_id 七个键;
 *          以及**安全边界**——解析不到订单时不推源单组(链路不成立时整组不发)。
 *   ❌ 不能验:金蝶沙箱到底认不认 sal_bill_order 这个类型常量、/jdy/v2/scm/sal_order 路径对不对。
 *          那需要能取到沙箱 token 的联网实测(当前 deploy/push/config.json 的 appKey/appSecret 为空,
 *          沙箱走动态授权,现有 node 客户端只有静态密钥那条路 ⇒ 取不到 token)。
 *          **故本探针只证明"代码按采购链同款写法接好了",不证明"金蝶侧一定挂得上"**;
 *          首次沙箱实测后请回填 KingdeePushService 的 SO_* 常量。
 *
 * 做法:读 Java 源码做**契约断言**(比反编译 class 稳),再打印关键片段供人工复核。
 * 用法: node tools/archive/_probe-saleout-erp-src-1015.mjs
 */
import { readFileSync } from 'node:fs'

const SRC = 'backend/src/main/java/com/yinjia/mes/service/KingdeePushService.java'
const java = readFileSync(SRC, 'utf8')

let pass = 0, total = 0
const check = (label, ok, detail) => {
  total++
  if (ok) pass++
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${label}${detail ? ' — ' + detail : ''}`)
}

// ① 头部取销售订单号
check('表头读 bd_sale_out 的「销售订单号」', /str\(head\.get\("销售订单号"\)\)/.test(java))

// ② 解析器与路径/类型常量存在
check('存在销售订单解析器 resolveSoRefs', /private SoRefs resolveSoRefs\(/.test(java))
check('销售订单列表路径常量已定义', /SO_LIST_PATH\s*=\s*"\/jdy\/v2\/scm\/sal_order"/.test(java))
check('销售订单详情路径常量已定义', /SO_DETAIL_PATH\s*=\s*"\/jdy\/v2\/scm\/sal_order_detail"/.test(java))
check('销售订单类型常量已定义', /SO_BILL_TYPE\s*=\s*"sal_bill_order"/.test(java))
check('销售订单类型名称=销售订单', /SO_BILL_TYPE_NAME\s*=\s*"销售订单"/.test(java))

// ③ 行上写全 7 个 src_* 键(采购链实测口径:缺 type_id 金蝶会静默忽略引用)
const putKeys = ['src_bill_no', 'src_bill_type_id', 'src_bill_type_number', 'src_bill_type_name', 'src_inter_id', 'src_seq', 'src_entry_id']
for (const k of putKeys) {
  // 只算销售支里的(采购支也有同名键,故看 linkSaleSrc 块内)
  const seg = java.slice(java.indexOf('if (linkSaleSrc)'), java.indexOf('if (linkSaleSrc)') + 1400)
  check(`销售支写 ${k}`, seg.includes(`e.put("${k}"`))
}

// ④ 行号来源:源单行号 / 销售订单行号
const seg2 = java.slice(java.indexOf('if (linkSaleSrc)'), java.indexOf('if (linkSaleSrc)') + 1400)
check('行号读「源单行号/销售订单行号」', /lineColumn\(line,\s*"源单行号",\s*"销售订单行号"\)/.test(seg2))

// ⑤ 安全边界:解析不到就不推整组(链路标志由 soRefs != null 决定)
check('安全边界:linkSaleSrc 由 soRefs != null 决定', /boolean linkSaleSrc = soRefs != null;/.test(java))
check('解析不到时给出用户可见提示', /soLinkWarning = "；注意:金蝶账套内未找到销售订单/.test(java))
check('提示已并入返回 message', /\+ linkWarning \+ soLinkWarning\)/.test(java))

// ⑥ 回归:采购支未被改动
check('(回归) 采购支 resolvePoRefs 仍在', /private PoRefs resolvePoRefs\(/.test(java))
check('(回归) pur_bill_order 常量仍在', /pur_bill_order/.test(java))
check('(回归) 销售出库单仍推 sal_out_bound', /"\/jdy\/v2\/scm\/sal_out_bound"/.test(java))

console.log(`\n结果: ${pass}/${total}`)
if (pass !== total) {
  console.log('\n⚠ 有断言未过 —— 请人工复核下方片段')
  const i = java.indexOf('if (linkSaleSrc)')
  console.log(java.slice(i, i + 1200))
}
process.exit(pass === total ? 0 : 1)
