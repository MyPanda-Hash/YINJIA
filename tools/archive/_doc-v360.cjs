/**
 * _doc-v360.cjs — 表清单:yj_supplier_account 列数 11→16、说明改写 + 追加 v3.60(2026-10-25)
 * 本次「供应商账号独立成表」:不再写 yj_user,本表自带口令与姓名。
 * 幂等:已有 v3.60 先删再追加;表行按行替换(不做全文替换)。
 */
const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', '..', 'docs', 'development', '数据库表清单.md')
const lines = fs.readFileSync(FILE, 'utf8').split('\n')

const NEW_TABLE_ROW = '| `yj_supplier_account` | 供应商门户账号(**2026-10-24 新增;2026-10-25 起独立成表**):'
  + '一行 = 一个供应商登录账号 → 绑定的供应商编码。**账号、口令(`password_hash`)、姓名(`real_name`)、'
  + '联系电话(`phone`)、启停全部在本表**,与 `yj_user` 无任何行级关联(不再出现在组织架构/用户管理);'
  + '登录命中即整体降权为供应商会话,只留「供应商采购打印」一页。'
  + '维护入口:采购管理 → 供应商门户 → 供应商权限配置(管理员 ∪ 组织架构里勾了「配置供应商账号」的角色) | 16 |'

const ROW = [
  '| v3.60 | 2026-10-25 | **供应商账号独立成表:彻底不再写 `yj_user`**(用户口径「供应商配置的账号不属于用户账号,',
  '单独一个表吧」;`migrate-supplier-account-standalone-20261025.sql`,两账套已执行)。',
  '① `yj_supplier_account` 加 `password_hash nvarchar(200) NULL`(登录口令,与 yj_user 同格式)与 ',
  '`real_name nvarchar(60) NULL`(姓名),**列数 11→16**,两列均写列级中文注明;',
  '② 从 `yj_user` **回填**口令与姓名(存量账号口令不丢、仍能登录),回填成功后**删除 yj_user 里的镜像行**',
  '(仅 is_admin≠Y 且用户名确实在供应商账号表里)⇒ 供应商账号不再被算作"用户账号";',
  '③ `yj_user.[供应商编码]` 列**保留不删**(历史数据可能仍有值,删列有风险),代码侧已不再读写它;',
  '④ 代码:登录 `AuthController.login` 先查 `yj_user`,查不到再 `SupplierPortalService.authenticate` 走本表;',
  '`currentUser` 与之**共用 `supplierSession`**(杜绝"刷新一次权限又变回来"的老坑);改密/删除/启停只碰本表;',
  '`saveAccount` 只写本表,并新增**无口令不许直接启用**的拦截(停用会清空口令,须先在同一窗口设新密码);',
  '新建时仍拦"与内部账号重名"(登录入口唯一,不制造歧义);',
  '⑤ **验证**:`tools/archive/_VerifySupplierStandalone.java` 两账套 `RESULT: PASS`',
  '(两列存在 / yj_user 无镜像行 / 启用账号都有口令 / 与内部账号不重名);',
  '`_v-supplier-account-standalone.cjs` **26/26**(建号→登录→越权 403→改密→停用→启用→重名拒→删除);',
  '回归:面板界面 12/12、面板接口 19/19、勾选弹窗 14/14、账号表单 16/16、权限 25/25 + 10/10。',
  '⚠ 本行手写(理由同 v3.31) |',
].join('')

const out = []
let fixed = false
for (const line of lines) {
  if (line.startsWith('| v3.60 |')) continue
  if (line.startsWith('| `yj_supplier_account` |')) {
    out.push(NEW_TABLE_ROW)
    fixed = true
    continue
  }
  out.push(line)
}
const lastVer = out.map((l, i) => (l.startsWith('| v3.') ? i : -1)).filter((i) => i >= 0).pop()
out.splice(lastVer + 1, 0, ROW)
fs.writeFileSync(FILE, out.join('\n'), 'utf8')
console.log(`v3.60 已插入(位置 ${lastVer + 1});表行已改写=${fixed};总行 ${out.length}`)
