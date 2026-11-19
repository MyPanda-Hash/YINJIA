# 送样登记表/检验委托单 2026-11-19 五项修订 —— 取证

> 用户 2026-11-19 口径（5 条）：
> 1. 送样登记表明细，换成「内部检测目录」；
> 2. 送样登记表的数据替换为 `提供系统更新版2026.11.17(1).xls` 的「内部检测目录」数据；
> 3. 检验委托单「委托单编号」处增加横杠（填写提示样式）；
> 4. 检验委托单金额：收费是「一个样/元」⇒ 总金额 = 行表收费合计 × 样品数量 × 1.06；
> 5. 明细工具栏「+ 新增数据」的新增要能在权限里去掉（取消面板「新增保存」= add 词）。

## 一、数据侧结论（先给事实）

- 新文件 `提供系统更新版2026.11.17(1).xls` 的「内部检测目录」sheet 与旧
  `提供系统更新版2026.11.17.xls` 的 Sheet1 **逐格内容一致**（xlsx 逐格 diff：0 差异）。
- 两账套 `qc_sample_reg` 在册 **55 行**（54 检测项 + 外送部分），与源表一致；
  仅「外送部分」是设计上补的尾行（源表用两句说明表达，不编号）。
- 仍按用户口径出了一版**在册复核/部署**迁移：
  `tools/migrate-sample-catalog-rev-20261119.sql`（生成器
  `tools/archive/_sample-catalog-20261119/gen-migration.mjs`），两账套已执行、`yj_schema_log` 已记账。
- 明细页签标题走数据驱动：`yj_panel.config.detailTabLabel = "内部检测目录"`（迁移
  `tools/migrate-sample-reg-detail-tab-20261119.sql`），后端 `PanelRegistry.PanelDef.detailTabLabel()`
  + `PanelConfigService.buildArchiveConfig`；列表与纸面两处同源。

## 二、ego 浏览器实测（8090 打包版，admin / 测试库）

脚本在 `ego/`，截图在同目录；执行方式：

```bash
ego-browser nodejs -e "await import('file:///D:/workspace/yinjia/tools/archive/_sample-reg-insp-20261119/ego/round-01.mjs')"
```

| 轮次 | 场景 | 结果 |
|---|---|---|
| round-01 | `#/panelx/list/SAMPLE_REG`（admin，正式库） | 明细页签 = **内部检测目录**；共 **55 条**；绿色「新增数据」可见（admin） |
| round-02 | `#/panelx/list/INSP_COMMISSION`（正式库既有单 14，已审核） | 纸面只读；「委托单编号：14」；总金额 106.00（样品数量 1，旧单） |
| round-06 | 测试库 `WT-2026-11-9009` 草稿（样品数量=10，1 行收费 100） | 编号输入框 `border-bottom = 0.888889px solid rgb(138,138,138)`；总金额 **1060.00**（100×10×1.06） |
| round-10 | 测试库 yyt（角色 1040 临时去掉 SAMPLE_REG 的 add） | 页签仍是 **内部检测目录**；`panelPerms.SAMPLE_REG = view,query,modify,modlog,del,export`；**「新增数据」按钮 0 颗** |

原始测试数据（round-06 的草稿行）与 round-10 的角色权限**已还原**：

```sql
-- 测试库已执行
UPDATE yj_role_panel SET perms = N'view,query,add,modify,modlog,del,export,print,field,warn'
 WHERE role_id = 1040 AND panel_code = N'SAMPLE_REG';
DELETE FROM qc_insp_commission_detail WHERE 单据编号 = N'WT-2026-11-9009';
UPDATE qc_insp_commission_head SET 样品数量 = NULL, 合计收费 = NULL WHERE 单据编号 = N'WT-2026-11-9009';
```

## 三、后端权限二道闸实测

`perm-off-api.mjs`（测试库、yyt、角色去 add）：

```
login 200 success factory YJ_TEST perms view,query,modify,modlog,del,export
callButton HTTP 200
{"code":403,"message":"当前角色无该面板「新增保存」权限，不能新增数据行","data":null}
```

⇒ 直调 `/api/px/callButton` 也塞不进新行；带 id 的改已有行不在该闸门内（归 `modify`）。

## 四、构建/测试

- `frontend: npm run build` ✅（入口 `dist/index.html`，25s 左右）
- `frontend: node --test src/core/qc/inspCommissionVat.test.js src/core/auth/panelAccess.test.js src/core/views/sampleRegAddPerm.test.js src/core/views/inspSheetPrint.test.js` → **42/42 pass**
- `backend: JAVA_HOME=.../ms-25.0.4 mvn -q -DskipTests compile` ✅
- 本机 8090 已用 `tools/scripts/rebuild-prod.ps1` 重打包并重启（换 jar 自检通过，fat jar 129 条 lib）。

## 五、未做 / 风险

- **未部署生产服务器**（用户本轮未要求；仅本机 8090 与新迁移已就绪）。
- 目录「色度」源表未给收费（落空）与「高浓度银」序号与「高浓度铅」同为 28 是**源表事实**，不是迁移遗漏。
- 旧单若样品数量是纯数字/计件单位，打开后会按新口径重算总金额（这正是需求 4）；`2L`、`2L/3支`
  这类容积/多段写法按 1 件（不猜，避免多收）。
