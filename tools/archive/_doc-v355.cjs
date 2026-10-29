/**
 * _doc-v355.cjs — 在数据库表清单里追加 v3.55 维护行 + 修正 yj_supplier_account 的维护入口说明(2026-10-25)
 *
 * 为什么用脚本:上一次用 PowerShell 的 -replace 插入,替换串里的 `$` 被当成"匹配组"引用,
 * 导致同一行被插进多处、文档损坏(已 git checkout 还原)。这里全程**按行处理、无字符串替换语义**。
 * 幂等:已有 v3.55 行则先删再追加;yj_supplier_account 那行按整行重写。
 */
const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', '..', 'docs', 'development', '数据库表清单.md')
const lines = fs.readFileSync(FILE, 'utf8').split('\n')

const ROW = [
  '| v3.55 | 2026-10-25 | **「供应商权限配置」由「仅管理员」改为组织架构按角色授权**',
  '(用户口径「供应商权限配置面版不只是管理员可以来配置,需要能够通过组织架构添加可以配置的账号」;',
  '无建表/加列)。① `PagePanelRegistry.SUPPLIER_ACCOUNT` 的动作集由 `view(可见)` 改为 `supplier(配置供应商账号)`,',
  '于是它出现在「组织架构 → 角色与面板权限 → 智能供应链」组里,可像「自定义字段(field)/预警配置(warn)」那样**逐角色勾选**;',
  '② 真闸门 `SupplierPortalService.requireAccountConfig()` = 管理员 ∪ 该角色在本面板持有 supplier 词',
  '(逐请求现查 `yj_role_panel`,**收回立即生效**、不必等重登);供应商账号自身永远不过(它只能看自己的采购订单);',
  '③ `AuthController` 登录/userinfo 同源下发 `canConfigSupplierAccount` 并为授权账号补 `visiblePanels`/`pagePerms`,',
  '前端菜单项与路由改用 `permKey`(不再是 `adminOnly`/`requireAdmin`);',
  '④ 新增 `i18n-supplier-account-perm-20261025.sql`:已授权 / 配置供应商账号 / 没有该面板的权限 / 说明句 等新文案 9 语言(前端 10 语言包同批);',
  '⑤ **验证**:接口 e2e `_v-supplier-account-perm.cjs` **25/25**(建测试角色账号→未授权时菜单无入口+接口 403+不能建号→',
  '组织架构勾 supplier→非管理员可建供应商账号→收回后旧令牌立即 403→管理员恒可→清理);',
  '界面 e2e `_ui-supplier-account-perm.cjs` **10/10**(矩阵里找到「供应商权限配置 / 配置供应商账号」、授权后菜单出现入口并能进页、',
  '收回后入口消失且直连被送回);前端单测 858/858;两账套 DbSync 执行 0 失败。⚠ 本行手写(理由同 v3.31) |',
].join('')

const out = []
let inserted = false
let catalogFixed = false
for (const line of lines) {
  // 已有的 v3.55 行先去掉(幂等)
  if (line.startsWith('| v3.55 |')) continue
  // 表清单里 yj_supplier_account 那一行:维护入口说明改为「管理员 ∪ 组织架构授权」
  if (line.startsWith('| `yj_supplier_account` |')) {
    const fixed = line.replace(
      '维护入口:采购管理 → 供应商权限配置(管理员专属)',
      '维护入口:采购管理 → 供应商权限配置(管理员 ∪ 组织架构里勾了「配置供应商账号」的角色,2026-10-25 起)',
    )
    out.push(fixed)
    if (fixed !== line) catalogFixed = true
    continue
  }
  out.push(line)
}
// 追加到版本维护表末尾(表最后一行 v3.54 之后)
const lastVer = out.map((l, i) => (l.startsWith('| v3.') ? i : -1)).filter((i) => i >= 0).pop()
if (lastVer === undefined) throw new Error('未找到版本维护表')
out.splice(lastVer + 1, 0, ROW)
inserted = true

fs.writeFileSync(FILE, out.join('\n'), 'utf8')
console.log(`v3.55 行已插入(位置 ${lastVer + 1});表清单维护入口说明已更新=${catalogFixed};总行 ${out.length}`)
console.log('v3.55 行数 =', out.filter((l) => l.startsWith('| v3.55 |')).length)
