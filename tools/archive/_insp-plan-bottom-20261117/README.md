# 出货检验计划表:不合格应对措施挪到表格最下层 + 检查频率下拉瘦身(2026-11-17)

用户两条口径(同一条需求记录里的第 1、2 条):

1. 「出货检验计划表下拉框的数据过多,修改为下面的修改,1%/一个生产批次、1PCS/一个生产批次、
   1PCS/一个工单、型式检验。下拉款中内容可自行增加。」
2. 「不合格应对措施放置表格最下层,因为当前的不合格措施都是一样的。」
   (配图另有一句「检验方法内容适当调宽一点」。)

## 改了什么

| 位置 | 改动 |
|---|---|
| `frontend/src/core/views/recordSheetConfigs.js` `RD_INSP_PLAN` | `不合格应对措施`从可见列撤出(留 `hiddenCol`,值照旧逐行往返);新增 `footerField` = 表格最下层一条满宽合并格;6 列重分列宽(检验方法 144 → 310,合计仍 1187);检查频率 `stdLib` 改 `INSP_FREQ_OQC`;内置兜底库的检测频率文案同步成新词表。 |
| `frontend/src/core/views/RecordSheetPanels.vue` | 新增 `footerFieldValue/setFooterFieldValue`(显示取第一行非空值、编辑写回**全部行**)、模板里渲染合并行、`addRow` 让新行继承同一份文本、`STD_LIB_CODES` 加 `INSP_FREQ_OQC`、`loadStdLibs` 按 `seq` 重排。 |
| `tools/migrate-insp-freq-oqc-20261117.sql` | 新建标准库 `INSP_FREQ_OQC`(6 条)+ 把 `RD_INSP_PLAN.检测频率` 的 `dict_sql` 指过去;共用库 `INSP_FREQ` 原样保留(制程/首件/组装成品三张单照旧)。两个账套均已执行。 |
| `frontend/src/core/views/inspPlanFooterField.test.js` | 新增:钉住「6 列 + 合计 1187 + 合并格跨满全表 + 编辑写回全部行 + 新行继承 + 专属频率库」。 |
| `frontend/src/core/views/recordSheetConfigs.keys.test.js` | 断言 ⑧ 由「7 列」改为「6 列 + footerField」,并加三条 footerField 约束。 |

## 取证(ego 浏览器,脚本与截图都在 `ego/`)

| 证据 | 文件 |
|---|---|
| 6 列(序 号/检验项目/检验要求/检验方法/检查频率/备注),表宽 1187、列宽 110/200/240/310/165/162 | `ego/round-01.png`、`ego/round-02.png`(控制台实测 `dtWidth=1187.8`,`colgroup` 逐列宽度) |
| 表格最下层出现「不合格应对措施」满宽合并行,下方接表尾注 | `ego/round-02.png`(生产库已归档单据,只读) |
| 检查频率下拉 = 6 条,顺序与用户所列一致(1%/一个生产批次 → 1PCS/一个生产批次 → 1PCS/一个工单 → 型式检验 → 半年/一年一次) | `ego/round-29-dropdown.png` |
| 编辑合并格 → 保存 → 库里**两行**都是同一段新文本(不是只写第一行) | 下方 SQL 取证 + `ego/round-25-before-save.png` / `ego/round-25-after-save.png` |
| 先填合并格、再加两行 ⇒ 三行都带同一段文本(新行继承) | `ego/round-26.mjs` 输出:`measures` 三行相同 |
| 修订记录页不受影响(合并格只出现在检验项目页) | `ego/round-31.mjs` 输出:`footerFields: 1` |
| 纸上观感(已归档单据,只读态) | `ego/round-30-preview-bottom.png`、`ego/round-32-prod-final.png`(正式库 YJ 同一张单) |

> ⚠ 仓库对 `*.png` 统一忽略(见 `.gitignore` 第 134 行),所以**截图不入库**,只在本机
> `C:/Users/vigna/ego/insp-plan-bottom-20261117/` 与 `tools/archive/_insp-plan-bottom-20261117/ego/`
> 本地留存;入库的是**可复跑的取证脚本**(`ego/round-*.mjs`,逐个重跑即可再出同样的截图与断言)。

保存后逐行落库的取证(`HSDZ_MES_TEST`,验证完已用 `cleanup-my-test-draft.sql` 清掉测试草稿):

```sql
SELECT d.id, LEFT(d.[不合格应对措施], 45) AS measure_head, LEN(d.[不合格应对措施]) AS len
FROM rd_insp_plan_detail d JOIN rd_insp_plan_head h ON h.[单据编号] = d.[单据编号]
WHERE h.[单据编号] = N'IP-2026-11-0012' AND ISNULL(d.[表区], N'') <> N'修订记录';
-- 111 | 【合并格验证】1. 暂停该批次继续生产 2. 100% 全检并隔离 3. 复核检验方法 | 43
-- 112 | 【合并格验证】1. 暂停该批次继续生产 2. 100% 全检并隔离 3. 复核检验方法 | 43
```

## 复跑

```bash
# 频次库与字段指向(两个账套)
cd tools
export YINJIA_SQL_PASS='***'
java -cp lib/mssql-jdbc.jar DbSync.java run migrate-insp-freq-oqc-20261117.sql
YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib/mssql-jdbc.jar DbSync.java run migrate-insp-freq-oqc-20261117.sql

# 单测
cd frontend && node --test src/core/views/inspPlanFooterField.test.js src/core/views/recordSheetConfigs.keys.test.js

# 界面(5173 = 源码即时生效;测试账套里 ?new=1 建草稿,验证完记得清)
ego-browser nodejs -e "await import('file:///C:/Users/<name>/ego/insp-plan-bottom-20261117/round-29.mjs')"
```

## 已知边界

- 合并格是「显示合并、存储逐行」:旧单据里若某几行的措施**不一致**,合并格显示第一行的非空值;
  一旦在合并格里编辑,就会把全部行刷成同一段(用户口径本来就是"都是一样的",符合预期)。
- 存量数据里 `生产量*1%`(15 行)没有自动改写成新词表 `1%/一个生产批次` —— 下拉只是候选,
  已录入文本按原样显示/打印,不动业务数据。需要统一的话另开一次数据订正。
