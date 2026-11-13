# 角色字段视图（`yj_field_view`）— 实现与验证归档（2026-11-13）

## 一、用户口径（本次唯一的验收标准）

> ① 「不同的角色可以同一面版可以自己调整单据的字段……每个角色都可以独立看到不同的字段」
> ② 「两层就够了，从系统到角色的定制，不用在角色下单独区分账号，同一角色看的是一样的」
> ③ 「没有保密的诉求」
> ④ 「要保留原来表格调整的功能不变，并且确保现在做的调整不会回退。然后定制的表格调整是在原来表格调整的基础上，再做修改的显示或者隐藏」

因此：**系统整体（`yj_field`，原「表格调整/表头调整」照写不误）→ 角色（`yj_field_view`，只存显隐）**，
同一角色所有账号共用一套，不做个人层，不做字段级权限。

## 二、交付清单

| 层 | 内容 |
|---|---|
| DB | `tools/migrate-role-field-view-20261113.sql`（建表 + 表级/逐列中文注明 + 自检 + 打印 `yj_field` 行数/校验和）；两账套已执行 |
| 后端 | `service/PanelFieldViewService`（角色解析 / 合并 / 保存 / 恢复继承）；`PanelConfigService.buildConfig` 取一次覆盖；`PxController` 新增 `/px/fieldView`、`/px/saveRoleFieldView`、`/px/resetRoleFieldView`，`/px/getPanelConfig` 支持 `view=system` |
| 前端 | `PanelxList.vue`：表格调整 / 表头调整顶部作用域条；`UiSettingsDialog.vue`：界面设置「字段视图」；`stores/app.js`：`fieldScope` + 广播重载；`business/engine.js`：`getFieldView` / `saveRoleFieldView` / `resetRoleFieldView`、`getPanelConfig` 带 `view` |
| 多语言 | 17 条新文案 × 10 语言（`tools/archive/_role-field-view-i18n-20261113.mjs`，幂等） |
| 台账 | `tools/db-migrations.txt`、`tools/db-inuse-tables.txt`、`docs/development/数据库表清单.md`（§一 29→30 张 + 维护记录 v3.95） |

## 三、零回退的证据（用户红线 ④）

| 检查 | 正式库 `HSDZ_MES` | 测试库 `HSDZ_MES_TEST` |
|---|---|---|
| `yj_field` 行数 / `CHECKSUM_AGG` 迁移前后 | 4976 / −956433662（**一致**） | 4977 / 534593652（**一致**） |
| `FourDocAudit`（采购四单字段基线） | `[PASS]` 12/12 全 0 | `[PASS]` 全 0 |
| `yj_field_view` 覆盖行（收尾） | 0 | 0 |
| `DbNormAudit` | FAIL-7（与改动前同项的存量债：02/03/04/05/09/10/12，**无一项指向 `yj_field_view`**；迁移链 17 处未登记脚本也不是本脚本） | 同上 FAIL-7 |

> 迁移脚本只做「建表 + 注明 + 自检」，**没有一条语句写 `yj_field`** —— 这是"保留原表格调整功能、现在做的调整不回退"的结构性保证，不是靠自觉。

## 四、验证（可复跑）

```powershell
# 1) 接口闭环(PASS 16 / FAIL 0)
node tools/archive/_role-view-20261113/_api-verify.mjs http://127.0.0.1:8091

# 2) 数据库对账(临时账号已删,覆盖行 0,校验和与迁移前一致)
cd tools; java -cp lib\mssql-jdbc.jar archive\_role-view-20261113\QClean.java
#   → 输出在 tools/archive/_role-view-20261113/_q-clean-out.txt
```

接口闭环覆盖的五条真相：藏 2 列 → 本角色少 2 列；同账号 `view=system` 两列仍在（证 `yj_field` 未动）；
另一个角色（仓库管理）完全不受影响；只有被改的两行标 `overridden`；恢复继承后清零。

### ego 浏览器走查（截图在 `ego/`）

| round | 验的是什么 | 结论 |
|---|---|---|
| 03 | 测试库 + 销售账号登录，打开 QC_RECV | 25 列（含 单价/金额） |
| 08 | 表格调整默认落「本角色（销售）」，拖拽/箭头/栏名禁用，必填行勾选框置灰 | ✅ 与设计一致 |
| 09 | 取消勾选 单价 + 金额 → 保存 | toast「本角色字段视图已保存」，列表 25→**23** 列 |
| 12 | 界面设置 → 字段视图切「系统整体」 | 即时重载，列回到 **25**（`mes_field_scope=system`） |
| 13 | 切回「本角色定制」 | 列又变 23 |
| 14 | 恢复继承（含确认框） | toast「已恢复继承（系统整体）」，列回 25，徽标「已定制 0 个面板」 |
| 15~17 | 表头调整藏「供应商」 | 纸面该格**消失并回流版式**；恢复继承后回到纸上 |

> 走查用的两个临时账号（`zz_fv_a` 销售 / `zz_fv_b` 仓库管理，仅存在于**测试库**）已用
> `QClean.java` 删除；`QSeedUsers.java` 里的口令哈希是一次性口令的 bcrypt，明文不落库。

## 五、实现要点（踩过的坑）

1. **`yj_user.enabled` 是 `'1'/'0'`，不是 `'Y'/'N'`** —— 第一版按 `='Y'` 写，所有账号都查不到角色，
   界面表现是「角色列恒空、保存报未分配角色」。已改成 `ISNULL(enabled,'1') <> '0'`。
2. **只改渲染真正读的那个位**：表头看 `hidden`、明细列看 `visible`。明细里存在
   「`hidden=1` 但 `visible=1`」的字段（纸张不印、表格要显示），两个位一起写会把这类字段从表格里误删。
3. **必填字段不可隐藏**：写入侧静默跳过并回报标签，合并侧再兜一次（历史脏行 / 整体后改为必填）。
   界面上该行勾选框直接置灰。
4. **与整体相同即删行**：保存时把"和整体一样"的项删掉而不是存冗余行，因此整体以后改了，角色自动跟上；
   对话框里也能准确显示"已定制"。
5. **`PanelRegistry` 的 30 秒快照不掺角色数据**：合并发生在 `buildConfig` 的入参，注册表保持全员一致。

## 六、边界（刻意不做，写清楚免得被当 bug）

- **只存显隐**：顺序（`seq`）与栏名（`alias`）仍由系统整体决定，角色作用域下这三项交互被禁用。
- **查询条件（`place=query`）不参与**：本次只做表头与明细两层。
- **纸张/报表模板独立**：角色隐藏只影响界面/列集，不影响打印模板里显式写死的格子（隐藏是在"字段级"生效）。
- **不是权限**：隐藏 ≠ 看不到数据（无保密诉求）。真要挡数据必须做字段级权限（后端列剔除 + 导出/报表剔除）。
