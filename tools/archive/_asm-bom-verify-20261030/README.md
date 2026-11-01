# 组装物料清单(bs_asm_bom / ASM_BOM)独立验收 — 2026-10-30

- 验收角色:独立验收工程师 `bom-verify`(只读验收;未修改任何业务文件、迁移脚本、台账、前端文件;未 git commit;未动 8090 服务)
- 验收对象:T1(Lead:建表 + 面板元数据 + 菜单 + 登记)+ T2(bom-import:金蝶 BOM 数据导入),task-1 / task-2 已完成
- 账套:HSDZ_MES(正式)/ HSDZ_MES_TEST(测试),SQL Server 127.0.0.1:1433,yinjia
- 结论(首轮 14:39):**不通过 —— 1 项 FAIL(前端法语语言包:`frontend/src/i18n/locales/fr.js:1443` 引号未转义,导致 `node --check`/esbuild 解析失败)+ 1 项低危文档注释不一致;其余 A/B/C/E 全 PASS,DbNormAudit 两账套与 2026-10-29 基线一致、无 ASM 相关 FAIL。**
- **复验结论(R2,2026-10-30 14:41,Lead 修完 D-1/D-2 后):全部 PASS,两项缺陷关闭,可交付。** 详见 §6。

## 0. 逐条 PASS/FAIL

| 项 | 验收点 | 结论 | 关键证据(本目录文件) |
|---|---|---|---|
| A1 | bs_asm_bom 列数=47、审计四件套、asp_cancel nvarchar(1) NOT NULL、PK、两个索引(两账套) | **PASS** | `A-structure2-HSDZ_MES.txt` / `-HSDZ_MES_TEST.txt`:列数 47;asp_user1/2 nvarchar(50)、asp_time1/2 datetime2、asp_cancel nvarchar(1) NOT NULL;`pk_bs_asm_bom(id)`;`uq_bs_asm_bom_doc_line(单据编号,行序) WHERE asp_cancel<>'Y'`;`ix_bs_asm_bom_prod_process(产品编码,工序) INCLUDE(子件编码,标准用量,用量分子,用量分母)` |
| A2 | 表 MS_Description 1 条 + 每列都有注明(缺注列=0) | **PASS** | 表注明 1 条(见输出);缺注列 0;列/属性 47 条、空文案 0;逐列文案清单见输出 |
| A3 | yj_panel ASM_BOM 形态 | **PASS** | `ASM_BOM / 组装物料清单 / Assembly BOM / 基础档案 / mode=doc / line_table=bs_asm_bom / head_table=NULL / group_col=code_col=单据编号 / pk_col=id / module_group=数据建模 / page_size=100 / detail_key=items` |
| A4 | yj_field 19 行、物理列存在、place 合法、无重复 | **PASS** | 19 行;物理列缺失 0;非法 place 0;同 col 多 place 0;完全重复 0;place 分布 detail 7 / header 7 / query,detail 1 / query,header 4 |
| A5 | yj_translation 面板 9 语言 + 字段 label 全有 en | **PASS** | 面板译名 9 语言(de/en/es/fr/ja/ko/ru/th/vi);字段缺 en = 0(19 个 label 逐个列出) |
| A6 | yj_role_panel ASM_BOM 行数 = yj_role 行数(view,query) | **PASS** | 正式 13/13、测试 7/7;perms 全部 `view,query`;未授权角色 0 |
| B-行数 | 两账套 行数/单据数/产品数 | **PASS** | 两账套均 **1085 行 / 236 单据 / 236 产品**;来源 1085 行全=金蝶BOM引出列表_20261019174847;asp_cancel 全 N;状态全 启用;asp_user1 全 金蝶BOM导入 |
| B-工序 | 工序全部=组装 | **PASS** | 两账套 1085 行全 组装,非组装 0 |
| B-用量 | 标准用量 = ROUND(用量分子/用量分母,4) 全表偏差 0 | **PASS** | 分母=0 行 0;精确不等 0;偏差>0.00005 行 0(两账套) |
| B-行序 | 每单 1..n 连续 | **PASS** | 行序异常单据 0(两账套) |
| B-单据 | 单据编号唯一(每单一个产品) | **PASS** | 一单多产品 0、一产品多单 0 |
| B-Excel | 与 Excel 独立重算对账(全表 + 抽查 10 产品) | **PASS** | `reconcile.py` / `reconcile-report.json` / `reconcile-report.txt`:重算 827 块/817 父产品;逐产品子件数、子件编码序列、标准用量逐行比对 **1085/1085 行 0 差异**;单据编号=Excel 编码 0 差异;抽查 A-32-09/A-42-04/D-01-49/S051-2/T201 + 随机 5 个(C-95-23/B-47-29/C-95-31/B-92-16/T270)全 PASS |
| B-范围 | 244 在产 ∩ Excel 父件 = 236;8 个无 BOM 不在表里 | **PASS** | plang 非作废 distinct dm=244;∩ Excel 父件(817)=236;DB 产品集合与期望集合完全一致(缺 0/多 0);A-32-13/A-32-17/A-32-26/B-65-04/C-95-32/D-01-18/S092-2/T042-6 命中 0 |
| B-多版本 | 默认BOM=是 优先 > _V 最大 | **PASS** | Excel 内多块产品 10 个,在范围内 2 个:D-01-49(V0001/V0002→取 V0002)、S051-2(V0001/V0002→取 V0002),DB 与规则一致 |
| B-单位 | 计量单位回填 | **PASS(正式)/ 记录(测试)** | 正式:空 0 行,且与 bs_inv 单位不符 0 行;测试:**11 行空**(10 个 子件编码 在测试库 bs_inv 中查无此货号,属测试库旧快照,不算失败;清单见 `A-aux.sql` 输出 / `B-unit-test-HSDZ_MES_TEST.txt`) |
| C1 | db-migrations.txt 两条脚本各出现一次、文件存在 | **PASS** | `tools/db-migrations.txt:4396` migrate-asm-bom-20261030.sql、`:4402` migrate-asm-bom-data-20261030.sql;文件均存在(32,514 / 373,976 字节) |
| C2 | tools/db-inuse-tables.txt 含 table:bs_asm_bom | **PASS** | `tools/db-inuse-tables.txt:293`(新增「生产 BOM」段,1 张) |
| C3 | 数据库表清单.md 有 bs_asm_bom 行 + v3.75 维护记录 | **PASS** | `docs/development/数据库表清单.md:101`(§二 bs_ 32→33 张,列数 47)、`:587`(v3.75) |
| C4 | 两账套 yj_schema_log 各 2 条 + content_hash = 文件 SHA-256 | **PASS** | 两账套各 2 条;`257943da…6a74dac`(建表脚本 32,514B)、`70ea3333…c4637050`(数据脚本 373,976B),与 python hashlib 计算值逐字节一致 |
| D1 | DbNormAudit 正式 | **PASS(无本次新增 FAIL)** | `D-dbnorm-prod.txt`:`RESULT: FAIL-3 / WARN 1`,FAIL 项 = 09 缺 en(219)/10 备份临时表(33)/12 迁移链(10 处);与 2026-10-29 基线完全同项同数(见 §2);全文 grep `ASM_BOM|bs_asm_bom|组装物料|Assembly BOM` **零命中**;01/02/04/05/06/07/11/13 全 PASS |
| D2 | DbNormAudit 测试 | **PASS(测试库陈旧债,无本次新增)** | `D-dbnorm-test.txt`:`RESULT: FAIL-8 / WARN 1`;FAIL 项 01/02/03/05/09/10/12/13 与基线同项同数(见 §2);grep ASM 零命中 |
| D3 | node --test frontend/src/business/menus.test.js | **PASS** | `D-menus-test.txt`:tests 24 / pass 24 / fail 0(含新增「组装物料清单 ASM_BOM 挂在数据建模→生产且全树只挂一次」ok 20);另 `frontend/src/i18n/i18n-detect-locale.test.js` 3/3 PASS |
| D4 | node --check 10 个语言包全 OK | **PASS(复验后)** | 首轮 FAIL:`frontend/src/i18n/locales/fr.js:1443` SyntaxError(已由 Lead 修复,`d\'assemblage`);复验见 §6①——10/10 OK、fr.js 可 import、esbuild 可解析(`R2-locale-check.txt`);首轮证据 `D-locale-check.txt` |
| E | 菜单 数据建模(dm)→生产(bprod) 有 ASM_BOM、path/title、全树唯一 | **PASS** | `E-menu-check.txt`:挂载路径 `数据建模 → 生产 → 组装物料清单`;title=组装物料清单、path=/panelx/list/ASM_BOM、code=asmBom;全树 panelCode=ASM_BOM 出现 1 次、同 path 出现 1 次;生产组 9 个叶子列表 |

## 1. 缺陷(首轮记录;两项均已于 2026-10-30 14:40 由 Lead 修复并复验关闭,见 §6)

### D-1(高,阻塞交付；**已修复+复验关闭**)`frontend/src/i18n/locales/fr.js:1443` 语法错误
```js
'组装物料清单': 'Liste des matériaux d'assemblage',
```
单引号字符串内 `d'assemblage` 的撇号未转义 ⇒ 整个 `fr.js` 解析失败。
证据(本次实测):
- `node --check frontend/src/i18n/locales/fr.js` → exit 1,`SyntaxError: Unexpected identifier 'assemblage'`;
- `git show HEAD:frontend/src/i18n/locales/fr.js` 的 HEAD 版本 `node --check` **exit 0** ⇒ 回归由本次新增行引入;
- `node -e "import('./frontend/src/i18n/locales/fr.js')"` → 同一 SyntaxError;
- esbuild(vite 使用的解析器)对该文件 `Transform failed … Expected "}" but found "assemblage"` ⇒ **`npm run build` 会因此失败**,法语语言包也无法加载(其余 9 个语言包 node --check 全 OK)。
建议修法(仅建议,未改):`'组装物料清单': 'Liste des matériaux d\'assemblage',`(或改用双引号/反引号)。

### D-2(低,文档；**已修复+复验关闭**)`tools/db-migrations.txt:4394` 注释列数与实际不符
注释写 `列=46(id/20业务列/5审计列/20备用列)`,实际建表 **47 列**(20 业务列 + `备注` + 5 asp_* + 备用1..20;建表脚本 `:64-67` 已有 2026-10-30 补列 `备注` 的说明,执行结果与口述验收口径均为 47)。建议把注释改为 `47(id/20业务列/备注/5审计列/20备用列)`。

### 观测项(不阻塞)
- 测试账套 `bs_asm_bom` 有 11 行计量单位为空:对应 10 个 子件编码(`B-85-07**TB`、`YJ-GL-047/048/049`、`YJ-JPL-068`、`YJ-KG-JC-B03`、`YJ-TB-011/012/013`、`YJ-YCYX-055`)在测试库 `bs_inv` 中 **0 行**(测试库是旧快照),非导入脚本缺陷;正式库 0 行空、且与 `bs_inv` 单位 0 行不符。
- 测试库 `yj_role` 只有 7 行(正式 13),因此 ASM_BOM 授权行 7(正式 13)——与角色数一致,符合验收口径。

## 2. DbNormAudit 与本次前基线对比(基线来源:`tools/archive/_proc-card-verify/dbnorm_HSDZ_MES*.log`,2026-10-29 独立验收留档)

| 项 | 2026-10-29 基线 | 本次(2026-10-30) | 判定 |
|---|---|---|---|
| 正式 汇总 | FAIL 3 / WARN 1,`RESULT: FAIL-3` | FAIL 3 / WARN 1,`RESULT: FAIL-3` | 不变 |
| 正式 08 | WARN 11 处 | WARN 11 处 | 不变 |
| 正式 09 | FAIL 219(面板 17/字段 202) | FAIL 219(面板 17/字段 202) | 不变 |
| 正式 10 | FAIL 33 | FAIL 33 | 不变 |
| 正式 12 | FAIL 8 处(清单 649/文件 680) | FAIL **10** 处(清单 663/文件 696) | 明细 +2,见下 |
| 测试 汇总 | FAIL 8 / WARN 1,`RESULT: FAIL-8` | FAIL 8 / WARN 1,`RESULT: FAIL-8` | 不变 |
| 测试 01/02/03/05/09/10/13 | 1/1/4/14/222/11/6 处 | 1/1/4/14/222/11/6 处 | 全部不变 |
| 测试 12 | FAIL 8 处 | FAIL 10 处 | 明细 +2,见下 |

- 两账套 FAIL 项名与数量除 12 明细外与基线逐项一致;**本次新增对象未出现在任何 FAIL 明细中**(全文 grep `ASM_BOM|bs_asm_bom|组装物料|Assembly BOM` 零命中),01 表命名 / 02 表注明 / 04 PK+审计 / 05 元数据漂移 / 06 面板指向 / 07 重复字段 / 13 pk_col 全 PASS。
- 12 明细由 8→10 的 +2 是 `cleanup-rd-prod-20261029.sql`、`migrate-record-group-20261028.sql` 两个**未登记**脚本(来自 commit `5502f5b3`,非本任务;本次两条 ASM 脚本均已登记且文件存在)。属其它并行任务遗留,记录不算本次失败。

## 3. 关键数字

- Excel:数据行 3641 / 块 827 / 父产品 817;plang 在产 distinct dm 244;交集 **236** 产品。
- DB:两账套均 **1085 行 / 236 单据 / 236 产品**;工序 组装 1085/1085;标准用量偏差 0/1085;行序异常 0;一单多产品 0;一产品多单 0。
- 默认BOM=是 的行 23 条(按块选择后保留),其余空;版本号取自 BOM 编码 `_V` 后缀。
- bs_asm_bom 47 列;MS_Description 表 1 + 列 47;索引 3 个(1 PK + 2 二级,含 1 唯一过滤索引)。
- 面板 ASM_BOM:1 行;字段 19 行;面板译名 9 语言;授权 13(正式)/7(测试),全部 `view,query`。
- 迁移链:`yj_schema_log` 两账套各 2 条,content_hash 与文件 SHA-256 一致。

## 4. 复跑方式(只读)

```powershell
# 结构/数据/日志(每段 SQL 用 GO 分隔,适配 Q.java 只读查询器)
cd D:\workspace\yinjia\tools
java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar archive\_1019-questions\Q.java HSDZ_MES archive\_asm-bom-verify-20261030\A-structure2.sql
java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar archive\_1019-questions\Q.java HSDZ_MES archive\_asm-bom-verify-20261030\B-data.sql
java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar archive\_1019-questions\Q.java HSDZ_MES archive\_asm-bom-verify-20261030\B-dump.sql   # 分页 400/批,避免 Q.java 500 行截断
java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar archive\_1019-questions\Q.java HSDZ_MES archive\_asm-bom-verify-20261030\C-schema-log.sql
# Excel 独立对账(openpyxl;需要先有 B-dump-*.txt 与 B-plang-HSDZ_MES.txt)
"C:\Users\...\dependencies\python\python.exe" archive\_asm-bom-verify-20261030\reconcile.py
# 防线
$env:YINJIA_SQL_PASS='Yinjia@2026'; java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar verify\DbNormAudit.java
$env:YINJIA_SQL_DB='HSDZ_MES_TEST'; java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar verify\DbNormAudit.java
cd ..; node --test frontend/src/business/menus.test.js
node --check frontend/src/i18n/locales/fr.js   # 首轮 FAIL;复验(修复后)OK
node tools/archive/_asm-bom-verify-20261030/E-menu-check.mjs
```

## 5. 本目录文件

| 文件 | 内容 |
|---|---|
| `A-structure2.sql` / `A-structure2-HSDZ_MES*.txt` | A1~A6 结构查询与两账套原始输出 |
| `A2-orphan.sql`、`A-aux.sql` | 列注明归属核对、asp_cancel 类型/行长核对、测试库空计量单位清单 |
| `B-plang.sql` / `B-plang-HSDZ_MES*.txt` | plang 在产清单(244)原始输出 |
| `B-data.sql` / `B-data-HSDZ_MES*.txt` | B 数据统计/抽查/8 个无 BOM/产品清单 |
| `B-dump.sql` / `B-dump-HSDZ_MES*.txt` | 全表逐行 dump(分页 400,供 Excel 对账) |
| `B-unit-prod.sql` / `B-unit-test.sql`、`B-unit-test-HSDZ_MES_TEST.txt` | 计量单位回填核对(正式一致/测试缺 bs_inv 快照) |
| `C-schema-log.sql` / `C-schema-log-HSDZ_MES*.txt` | 两账套 yj_schema_log 2 条 + content_hash |
| `reconcile.py` / `reconcile-report.json` / `reconcile-report.txt` | Excel 独立重算对账(全表 1085 行 + 抽查 10 产品 + 产品集合 + 多版本规则) |
| `D-dbnorm-prod.txt` / `D-dbnorm-test.txt` | DbNormAudit 两账套原始输出 |
| `D-menus-test.txt` | `node --test frontend/src/business/menus.test.js` 原始输出(24/24) |
| `D-locale-check.txt` | 10 个语言包 `node --check` 结果(fr.js FAIL,首轮) |
| `E-menu-check.mjs` / `E-menu-check.txt` | 菜单树独立检查(挂载位置/path/title/唯一性) |
| `_probe-encoding.sql`、`_plang-probe.sql` | 编码与 plang 结构探针 |
| `R2-locale-check.txt` | 复验:10 个语言包 `node --check` 全 OK |
| `R2-menus-test.txt` | 复验:`menus.test.js` 24/24 |
| `R2-spot.sql` / `R2-spot-HSDZ_MES*.txt` | 复验:两账套 ASM 结构/数据/授权/schema_log 抽查未回归 |
| `R2-build-check.txt` | 复验:`npm run build` 产物核查(dist 14:40:54 完整重建、fr chunk 含修复文案、入口含 ASM_BOM 菜单) |

> 只读声明:本验收未修改 `tools/migrate-asm-bom-20261030.sql`、`tools/migrate-asm-bom-data-20261030.sql`、`frontend/**`、台账、`docs/**` 中的任何业务文件;新写文件全部在本目录;未 git commit;未操作 8090 服务。

## 6. 复验(R2,Lead 修复后)— 2026-10-30 14:40~14:42

Lead 修复了首轮两项缺陷,复验**全部 PASS,缺陷关闭**:

| # | 复验项 | 结论 | 证据 |
|---|---|---|---|
| ① | 10 个语言包 `node --check` 全 OK;`fr.js` 可 import 且词条值正确 | **PASS** | `R2-locale-check.txt`:en/ja/de/es/fr/ko/ru/th/vi/zh-TW 全 `=> OK`;`import('./locales/fr.js')` 成功,`组装物料清单 = "Liste des matériaux d'assemblage"`;`esbuild.transformSync(fr.js)` 亦 OK(首轮该文件报 SyntaxError,已修复) |
| ② | `git diff` 范围:fr.js 只 +1 行(撇号转义);db-migrations.txt 仅注释 46→47 | **PASS** | `git diff --numstat`:fr.js `1 0`;db-migrations.txt `11 0` 且仅 1 个 hunk(整段 asm 块相对 HEAD 新增);文件内 `列=46` 已零命中、`行 4394 = 列=47(id/20业务列/备注/5审计列/20备用列)`;两条脚本条目仍各 1 次(4396 / 4402) |
| ③ | `npm run build`(vite/esbuild)产物完整、无报错 | **PASS(产物实证)** | `frontend/dist` 于 **14:40:54** 完整重建:150 个文件全部新时间戳(仅 `favicon.svg` 为静态旧文件)、`index.html` 在、`dist/assets/fr-CL5W97mF.js` 内含修复后文案 `Liste des matériaux d'assemblage`、入口 `index-CxhUHD0O.js` 内含 `ASM_BOM`/`组装物料清单`/`panelx/list/ASM_BOM`;未发现单独构建日志文件(Lead 若后续落盘日志可复核) |
| ④ | A/B/C/E 未回归抽查(两账套) | **PASS** | `R2-spot-HSDZ_MES.txt` / `-HSDZ_MES_TEST.txt`:面板 1 行、yj_field **19** 行且物理列缺失 0;数据 **1085 行 / 236 单据 / 236 产品**;非组装 0;用量偏差 0;行序异常 0;一单多产品 0;面板译名 9 语言;字段缺 en 0;授权 13/13(正式)、7/7(测试);yj_schema_log 两条哈希与首轮完全一致。另 `E-menu-check.mjs` 重跑 RESULT: PASS(数据建模→生产→组装物料清单,全树唯一) |
| ⑤ | 迁移脚本未被修复改动 | **PASS** | 两脚本 SHA-256 复算仍为 `257943da…6a74dac` / `70ea3333…c4637050`(与 yj_schema_log 一致) |

**复验结论:可交付。**
