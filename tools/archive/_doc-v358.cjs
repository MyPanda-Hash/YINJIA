/**
 * _doc-v358.cjs — 数据库表清单:yj_supplier_account 列数 10→11(加 phone)+ 追加 v3.58(2026-10-25)
 * 幂等:已有 v3.58 先删再追加;按行处理,不做字符串替换。
 */
const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', '..', 'docs', 'development', '数据库表清单.md')
const lines = fs.readFileSync(FILE, 'utf8').split('\n')

const ROW = [
  '| v3.58 | 2026-10-25 | **供应商账号加「联系电话」+ 新增弹窗改为「先关联供应商 → 账号默认=供应商编码(可改)」**',
  '(用户口径「供应商权限配置的新增应该弹窗关联供应商,然后选择后账号默认供应商编码(可修改)。可以有联系电话」;',
  '`migrate-supplier-account-phone-20261025.sql` + `i18n-supplier-account-phone-20261025.sql`,两账套已执行)。',
  '① `yj_supplier_account` 加 `[phone] nvarchar(50) NULL`(**列数 10→11**)+ 列级中文注明 + 三条自检;',
  '电话是**供应商侧业务联系方式**(采购部联系该供应商账号负责人),故放本表而非 `yj_user`;老账号该列为 NULL,',
  '列表显示「—」,不影响登录与查询;**可空**、不参与鉴权,搜索关键词也支持按电话模糊匹配。',
  '② 弹窗交互(`SupplierAccount.vue`):字段顺序改为 **供应商 → 账号 → 姓名 → 联系电话 → 登录密码 → 状态 → 备注 → 权限**;',
  '选定供应商后**账号自动填该供应商编码**(仍可手改)、姓名自动带出供应商名称;',
  '自动填充只在「新增 + 账号未被手改过」时生效(`autoFilledUser` 标记)—— 用户已改过的值不会被后续换供应商冲掉;',
  '供应商编码不满足账号规则(3~40 位字母/数字/下划线/点/横线)时不预填,留给人工填。',
  '③ 列表加「联系电话」列;启用/停用、重置密码三处请求体都带上 `phone`,避免这些操作把电话清空。',
  '④ **验证**:界面 e2e `_ui-supplier-account-form.cjs` **16/16**(字段顺序、选中供应商后账号=编码、姓名带出、',
  '手改账号后保存生效、电话落库、列表显示电话、编辑回显);多语言闸门 126 键 × 10 语言全过;',
  '其余供应商门户回归不变(面板 12/12、接口 19/19、采购订单 10/10、权限 25/25 + 10/10、顶栏 5/5、单测 858)。',
  '⚠ 本行手写(理由同 v3.31) |',
].join('')

const out = []
let catalogFixed = false
for (const line of lines) {
  if (line.startsWith('| v3.58 |')) continue
  if (line.startsWith('| `yj_supplier_account` |')) {
    // 列数 10 → 11,并在说明里补「联系电话」
    let fixed = line.replace('| 10 | SUPPLIER_ACCOUNT（供应商权限配置） |', '| 11 | SUPPLIER_ACCOUNT（供应商权限配置） |')
    if (!fixed.includes('联系电话')) {
      fixed = fixed.replace('维护入口:采购管理 → 供应商权限配置',
        '含联系电话 phone(2026-10-25 加);维护入口:采购管理 → 供应商权限配置')
    }
    out.push(fixed)
    if (fixed !== line) catalogFixed = true
    continue
  }
  out.push(line)
}
const lastVer = out.map((l, i) => (l.startsWith('| v3.') ? i : -1)).filter((i) => i >= 0).pop()
out.splice(lastVer + 1, 0, ROW)
fs.writeFileSync(FILE, out.join('\n'), 'utf8')
console.log(`v3.58 已插入(位置 ${lastVer + 1});表行已更新=${catalogFixed};总行 ${out.length}`)
