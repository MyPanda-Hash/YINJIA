# _dm-20261018 — 数据建模目录 + 字段管理面板 + ERP导入日志(金蝶数据补全) 取证

用户口径(2026-10-18,逐条):
1. 「写一个数据建模目录下面的面板有:写个字段管理面板,并且把 erp导入日志从系统管理迁移到数据建模里面去,
   并且去关联金蝶账号的数据写入,先把数据补充完整。还有写个数据字典」
2. 「erp导入日志补充数据只要基础档案有关的,和采购订单与销售订单」(圈定补数范围)

## 交付

| 件 | 位置 |
|---|---|
| 面板与迁移 | `tools/migrate-dm-fields-center-20261018.sql`(两账套已执行) |
| 金蝶补数脚本 | `_seed-erplg-from-kingdee.mjs`(默认 dry-run,`--write` 真写;幂等,IMP- 前缀可整体回退) |
| 菜单 | `frontend/src/business/menus.js` 一级目录 `dm`(数据建模) → 字段管理 / 数据字典 / ERP集成 |
| 后端 | `QueryService`(无 asp_cancel 列自适应、派生列「面板名称」)、`PanelConfigService`(下发 profile)、`ButtonService`(按表结构补审计列 / 无作废列则不做软删 / 派生列不回写) |

## 补进去的数据(现场读金蝶测试沙箱后写入,非造数)

| 批次号 | 导入类型 | 行数 | 目标表 |
|---|---|---|---|
| IMP-20261018-001 | 商品档案 | 3878 | bs_inv |
| IMP-20261018-002 | 仓库档案 | 6 | bs_wh |
| IMP-20261018-003 | 计量单位 | 26 | bs_uom |
| IMP-20261018-004 | 部门档案 | 26 | bs_dept |
| IMP-20261018-005 | 职员档案 | 128 | bs_emp |
| IMP-20261018-006 | 客户档案 | 233 | bs_kh |
| IMP-20261018-007 | 供应商档案 | 155 | bs_gf |
| IMP-20261018-008 | 采购订单 | 2275 | bd_pu_order |
| IMP-20261018-009 | 销售订单 | 3983 | bd_so_order |

合计 **9 个批次 / 10710 行**;`erp_imp_row` 45 行(每批取金蝶首页 5 条真实单号/编码 + 原始 JSON 作凭据)。
两账套(HSDZ_MES / HSDZ_MES_TEST)各写一份。

⚠ 口径说明:本机**没有** 金蝶→MES 的导入程序(yj_panel 里没有任何面板的 line_table 指向这两张表),
所以「导入历史」只能是"按金蝶当前账套里真实存在的档案/单据如实登记",不是拉取流水。
另:live `bd_pu_order` 里 187 行 `asp_user1='试运行'` 是历史导入尾巴;采购订单**唯一标记 = ERP单号非空**(2056 行)。

## 验证

```powershell
node tools/archive/_dm-20261018/_seed-erplg-from-kingdee.mjs          # 计划(dry-run,改前先看)
node tools/archive/_dm-20261018/_v-dm-panels.mjs                     # 接口闭环 12 项,须全 PASS
node tools/archive/_dm-20261018/_v-dm-shots.cjs http://127.0.0.1:5173 # 真实页面截图
```

2026-10-18 实测:12/12 PASS;两个面板在 5173 上均正常渲染(字段管理 4142 行 / ERP导入日志 9 行)。

## 踩坑(都已在源码注释里留痕)

1. **yj_field 面板 = 拿 yj_field 当数据源**:`col_name` 必须是**物理列名**,写成展示名就「列名无效」;
   面板头 `code_col` 同理(写成 `字段名` ⇒ 派生列 LEFT JOIN 成 `pn.panel_code = t.[字段名]`)。
2. **yj_field 没有 asp_cancel / asp_user2 / asp_time2**:查询、存档快照、UPDATE 都硬写过这三样 ⇒ 保存必 500。
   已改为按 `sys.columns` 判定(有才写),业务表行为不变。
3. **派生列「面板名称」**:表上无此列,由 `panel_code` 关联 `yj_panel` 带出(`PanelConfigService` 下发 `profile:panel`);
   保存时一律剔除,绝不回写。
4. **改迁移脚本会触发 DbSync 重跑**:脚本里的 `IF NOT EXISTS` 是按 col_name 判的,首版把显示名当 col_name 插进去后
   再改列名 ⇒ 会多插一份重复字段。改这类脚本前先把该面板的 yj_field 行清掉再重跑(本次已按此处理)。
