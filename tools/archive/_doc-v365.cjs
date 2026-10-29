/**
 * _doc-v365.cjs — 追加 v3.65:供应商重打/作废修复 + 打印前等图片解码(2026-10-29)
 */
const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', '..', 'docs', 'development', '数据库表清单.md')
const lines = fs.readFileSync(FILE, 'utf8').split('\n')

const ROW = [
  '| v3.65 | 2026-10-29 | **供应商「重打/作废」修复 + 打印前等图片解码(治「Edge 无响应」)**(用户报障「打印材料码的时候',
  '作废和重打,都有问题,作废显示成功,时间没有变化,重打就是报错 undefined」+「打印会出现 Edge 无响应,要等较长时间」;',
  '**无数据库变更**,纯代码)。**根因一(重打/作废)**:`SupplierPortalGuardFilter` 上一版只放行了',
  '`puLabel/dialog|print|batchLock`,**漏了 `reprint`/`void`** ⇒ 供应商点这两颗按钮全 403;',
  '而前端 `engine` 用的是 `unwrap`(code≠200 时**不抛错**、只返回 undefined)⇒ 作废"提示成功但记录纹丝不动"、',
  '重打弹「已重打(第 undefined 次) undefined」。**修法**:① 过滤器放行 `reprint`/`void`;',
  '② 控制器这两处改用 `requireMaterialLabelAccessByLabelDoc` —— 收的是**打印单号**(MQ-…),',
  '先反查它属于哪张采购订单(`QueryService.supplierOrderOfLabelDoc`),再核对归属(别人的单 403),',
  '内部账号仍按 PU_ORDER 的修改权;③ 前端 `puLabelReprint`/`puLabelVoid` 改 `unwrapStrict`(失败必须抛错),',
  '`doReprint` 另加"返回体没有打印单号就报错"的兜底,并把刷新推迟到打印结束(同打印口径)。',
  '**根因二(Edge 无响应)**:材料码卡面里有二维码(data URL),原来 `printInPage` 只等一帧就 `window.print()`',
  '⇒ 图片还没解码,浏览器的**打印预览/光栅化要做在 print() 内部**(同步冻结渲染进程),',
  '现场就是"页面整个未响应、等很久才回来"。**修法**:`printInPage` 先看打印层里有没有 `<img>`,',
  '**有图就等 `img.decode()`(整体 3 秒兜底)再打印**,没有图保持原来一帧的节奏(纯文字单据行为不变)。',
  '**验证**:接口 `_v-reprint-void.cjs` **12/12**(重打 200 且**打印次数 1→2**、作废 200 且 `asp_cancel=\'Y\'`、',
  '**可打印量 999→1000 回升**、重打别人的打印单 403、管理员不受影响);界面 `_ui-reprint-void.cjs` 抓到',
  '`/px/puLabel/reprint` 与 `/px/puLabel/void` **均 200**(修复前是 403);',
  '回归:材料码 9/9、面板 19/19、采购订单 10/10、前端单测 **1031/1031**(含 printChannel 三条用例)。',
  '⚠ 本行手写(理由同 v3.31) |',
].join('')

const out = []
for (const line of lines) {
  if (line.startsWith('| v3.65 |')) continue
  out.push(line)
}
const lastVer = out.map((l, i) => (l.startsWith('| v3.') ? i : -1)).filter((i) => i >= 0).pop()
out.splice(lastVer + 1, 0, ROW)
fs.writeFileSync(FILE, out.join('\n'), 'utf8')
console.log(`v3.65 已插入(位置 ${lastVer + 1});v3.65 行数 =`, out.filter((l) => l.startsWith('| v3.65 |')).length)
