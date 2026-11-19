# `_instr-summary-20261119` —— 实验室仪器使用记录表「使用记录汇总」页签取证

> 用户口径(2026-11-19):「为当前的实验室使用记录表增加一个汇总表格。汇总表需要查看的内容就这样查看吧。」
> 表样列:仪器名称/型号 | 日期 | 起止时间 | 仪器状态 | 是否内校 | 项目名称/内容 | 数量 | 使用人 | 备注。

## 一、实现摘要

- `RD_INSTR_USE`(仪器使用记录表)面板新增第 2 页签「使用记录汇总」;第 1 页仍是原登记表。
- 汇总页配置:`frontend/src/core/views/recordSheetConfigs.js` → `RD_INSTR_USE.pages[1].ledger`
  - `endpoint: '/px/instrUseSummary'`, `headMode: 'report'`, `showHead: false`
  - 9 列,列宽合计 815px(纸面内容区约 845px)→ 一屏看全,无横向滚动条、日期/起止时间不折行
- 渲染:`RecordSheetPanels.vue` 的 ledger 块(`loadLedger` 支持 `ledger.endpoint` 分支)
- 后端:`POST /api/px/instrUseSummary` → `QueryService.instrUseSummary`
  - 行源 `rd_instr_use_head × rd_instr_use_detail`(一行 = 一条使用记录,跨全部单据)
  - 仪器名/日期:明细优先、表头兜底;头/行 `asp_cancel='Y'` 都过滤
  - 只读派生视图,不落库、不建表;权限 `requirePanelView("RD_INSTR_USE")`
  - 日期用 `ISDATE` + `CONVERT` 兜底(nvarchar 日期),**不用 TRY_CONVERT**(本机 SQL Server 兼容级别不认)
- 多语言:`使用记录汇总 / 仪器使用记录 / 暂无使用记录` 已补 en.js
- 设计契约:`docs/design/实验室仪器使用记录汇总表.md`

## 二、取证

### 接口(测试账套,造 3 条记录)

```
POST /api/px/instrUseSummary {}
→ 200 { list: [3 行], totalSize: 3 }
   ICPMS-01   2026-11-19 09:00-10:00 √ √ 水质重金属检测 5 张三 正常
   分光光度计 2026-11-18 10:00-11:00 √ √ 色度检测       3 王五 复核
   ICPMS-01   2026-11-18 14:00-15:30 √ - pH测定         2 李四
YJ 正式账套: 0 行(无数据)
```

### ego 浏览器(8090,测试库,admin)

- 面板页签 = 「仪器使用记录 / 使用记录汇总」;
- 汇总页标题 = 「实验室仪器使用记录表」,表头 = 用户表样 9 列;
- 3 行数据、日期倒序、明细优先仪器名/表头兜底、作废过滤均实测;
- 表格宽 816px ≤ 内容区,9 列一屏可见(截图 `round-06-8090-fit.png`)。

运行方式:

```bash
ego-browser nodejs -e "await import('file:///D:/workspace/yinjia/tools/archive/_instr-summary-20261119/ego/round-06.mjs')"
```

### 造数/清理(测试账套)

```sql
UPDATE rd_instr_use_head SET [仪器名称/型号] = N'ICPMS-01', [单据日期] = N'2026-11-19'
 WHERE [单据编号] = N'IU-2026-11-0001';
DELETE FROM rd_instr_use_detail WHERE 单据编号 IN (N'IU-2026-11-0001', N'IU-2026-11-0002');
DELETE FROM rd_instr_use_head   WHERE 单据编号 = N'IU-2026-11-0002';
UPDATE rd_instr_use_head SET [仪器名称/型号] = NULL, [单据日期] = N'2026-11-19'
 WHERE [单据编号] = N'IU-2026-11-0001';
```

> 测试账套的 `IU-2026-11-0001` 是另一并行会话留下的空草稿;本轮只临时造 3 行验证,结束后已清空,
> 草稿本身保留(未删单)。

## 三、构建 / 测试

- `frontend: node --test src/core/views/recordSheetInstrSummary.test.js` → 5/5 pass
- `backend: JAVA_HOME=.../ms-25.0.4 mvn -q -DskipTests compile` → 0
- `frontend: npm run build` → OK
- 本机 8090 已 `rebuild-prod.ps1` 重打包重启,换 jar 自检通过。

## 四、未做

- 未加日期/仪器筛选控件(接口已预留 dateFrom/dateTo/instrument)。
- 未加导出 Excel(需要时按样品检验汇总表同款前端导出)。
- 未改登记表、未加菜单、未改数据库结构。
