# 留档：6 张已删除的遗留表（来自快照库 `HSDZ_MES_0909`）

**一句话**：`gscs`、`dm_langue`、`permission`、`s_commdata`、`s_sys`、`s_xtcs` 这 6 张表在正式库
`HSDZ_MES` 与测试库 `HSDZ_MES_TEST` 里已于 **2026-09-29「未用表清理」中删除**（同批共清 244 张），
但本机实例上的快照库 **`HSDZ_MES_0909` 仍然完整保留着它们**。本目录就是从这个快照库导出的
**全量 CSV + 建表脚本**，用来事后查数、比对老译名、必要时在临时库里复原。

---

## 1. 来源与背景

| 项 | 值 |
|---|---|
| 实例 | `localhost`（本机 SQL Server） |
| 来源库 | **`HSDZ_MES_0909`** —— 2026-09-10 从 `HSDZ_MES_damaged_20260910.bak` 恢复的快照库，294 张表 |
| 导出时间 | 2026-10-15 |
| 导出账号 | `yinjia`（对 `HSDZ_MES_0909` 有 SELECT 权限，实测可用） |
| 导出方式 | 只跑 SELECT（`sys.*` 目录视图 + 6 张表全量），**对任何库零写入**；CSV 用 JDBC(UTF-8) 直写，不经 PowerShell 拼字符串 |
| 为什么被删 | `HSDZ_MES`/`HSDZ_MES_TEST` 于 2026-09-29 按 `tools/db-inuse-tables.txt` 口径清理未用表 244 张，这 6 张不在册即被一并删除 |

判定依据与逐表证据见 [`tools/archive/_table-audit/`](../_table-audit/)、清理脚本
[`tools/migrate-drop-unused-tables.sql`](../../migrate-drop-unused-tables.sql)、在册台账
[`tools/db-inuse-tables.txt`](../../db-inuse-tables.txt)。

> ⚠️ **本目录只是留档**。这 6 张表是「判定未用」才删掉的；真想恢复某张表，请按
> [`docs/development/数据库规范.md`](../../../docs/development/数据库规范.md) 重走建表规范，
> 并在 `tools/db-inuse-tables.txt` + [`docs/development/数据库表清单.md`](../../../docs/development/数据库表清单.md) 登记，
> **不要**直接把 `schema.sql` 跑到正式/测试库上（见文件头警告）。

---

## 2. 文件清单

| 文件 | 行数（数据行） | 列数 | 大小 | 说明 |
|---|---:|---:|---:|---|
| [`s_sys.csv`](s_sys.csv) | 5660 | 46 | 1,161,424 B | 老面板引擎的「画面字段元数据表」 |
| [`permission.csv`](permission.csv) | 1529 | 18 | 160,703 B | 老系统 用户×画面 权限明细 |
| [`s_commdata.csv`](s_commdata.csv) | 712 | 28 | 133,720 B | 老移动端推送通知记录 |
| [`dm_langue.csv`](dm_langue.csv) | 15 | 22 | 2,023 B | ⚠ 注释写「语言」，实为微信/移动端在线用户表 |
| [`s_xtcs.csv`](s_xtcs.csv) | 14 | 17 | 1,966 B | 老系统参数 |
| [`gscs.csv`](gscs.csv) | **1** | 55 | 701 B | 老公司参数（单行表，确实只有 1 行） |
| [`schema.sql`](schema.sql) | — | 186 列定义 | 16,555 B | 6 张表的 `CREATE TABLE`（幂等 + 中文列注释；**只用于临时/新库**） |
| [`_export-legacy-tables.java`](_export-legacy-tables.java) | — | — | — | 本次导出器（只读，内置行数/列数自检） |
| [`_verify-export.mjs`](_verify-export.mjs) | — | — | — | 校验脚本（BOM / 列名 / 行宽 / 行数 / schema 逐列比对） |

CSV 约定：**UTF-8 带 BOM**、CRLF、RFC4180 引号规则、表头是**数据库原始列名**（不翻译）。
BOM 是为了 Excel 双击直接打开不乱码；`schema.sql` 也带 BOM，方便 `sqlcmd`/SSMS 直接读中文注释。

---

## 3. 六张表分别是什么，现在被谁取代

| 表 | 它原本是什么 | 现在被谁取代 |
|---|---|---|
| **`s_sys`** | **老面板引擎的「画面字段元数据表」= `yj_field` 的前身**。241 个画面（`SYSMENUNO`，如「明细_用户权限」），每行一个画面字段（`FLIE_NA` 形如 `permission.USERID`），带 `CHS/CHT/ENG/OTH` 四语标签——四语依次是简体/繁体/英文/其他（实测 `OTH` 列装的是越南语，如 `Tên công ty`）。**这是老字段中文名与多语言译名的唯一存底** | `yj_field`（字段元数据）+ `yj_translation`（多语言译名） |
| **`permission`** | 老系统 用户×画面 读写权限明细：`USERID` / `MODULE1`（画面）/ `RW`（**9 位 Y/N 串**，画面内 9 个操作位的开关）/ `GROP`（分组）。实测 31 个用户、230 个画面、7 种 `RW` 组合、13 个分组 | `yj_user` / `yj_role` / `yj_role_panel` |
| **`s_xtcs`** | 老系统参数（`dm` 代码 / `mc` 名称 / `value` 值）。实测 14 条，都是 MES 时代的参数：`FKC` 是否允许负库存、`GXBGXZ` 工序报工前必须领料、`SEXSWS` 税额及含税金额的小数位数、`GDZDDY` 工单是否排产时自动打印、`ZDDYCPBQ` 报工完工时是否自动打印产品标签、`GDMCD/CPMCD` 二维码长度…… | `yj_app_setting` |
| **`s_commdata`** | 老移动端推送通知记录：接收手机号 `JSZ`（实测全为 11 位手机号）/ 发送者 `FSZ` / 提示音 `SYWJ` / 已读标志 `YDF`（712 条里 63 条已读）/ 阅读时间 `YDSJ` | 现系统无对应表（移动端推送链路未迁移） |
| **`gscs`** | 老「公司参数」**单行表**（55 列）：公司名 `gsmc`、网址 `web`、授权用户数 `comqty`/`mobqty`（实测均为 500）、皮肤文件 `pfwj`、小票标题 `xpbt`、结算方式 `jsfs`…… 还留着 `hzb/zzb` 处方打印横纵坐标、`ysys/yspy/ysfh` 预设医生/配药/复核这类**门诊药房味**的字段 | 散落到 `yj_app_setting` / 现系统前端配置；无一对一承接 |
| **`dm_langue`** | ⚠ **表注释写「语言（作废）」是错的**（见第 6 节）。实测 `frm` = 微信ID/手机号（14 行长度 28 的 openid + 1 行 11 位手机号）、`lb_wi` = 在线标志（15 行全为 1）、`asp_time1` = 登录时间、`type` 单一取值 ⇒ 真身是**微信/移动端在线用户表** | 现系统无对应表 |

---

## 4. 行数核对（CSV 数据行数 vs 清库前审计快照口径）

导出时由导出器内置自检打印（`SELFCHECK: rows/cols all match`），事后又用 `_verify-export.mjs` 复核一遍：

| 表 | CSV 数据行 | 期望行数 | 结果 |
|---|---:|---:|---|
| `gscs` | 1 | 1 | ✅ 一致（单行表，确实写出了那 1 行） |
| `dm_langue` | 15 | 15 | ✅ |
| `permission` | 1529 | 1529 | ✅ |
| `s_commdata` | 712 | 712 | ✅ |
| `s_sys` | 5660 | 5660 | ✅ |
| `s_xtcs` | 14 | 14 | ✅ |

---

## 5. 怎么用这个目录

- **想比对老字段中文名/译名** → 看 [`s_sys.csv`](s_sys.csv)：`SYSMENUNO`=画面、`FLIE_NA`=字段（`表.列`）、`CHS`=简体、
  `CHT`=繁体、`ENG`=英文、`OTH`=其他语（实测越南语）；实测四列非空条数 CHS 5567 / CHT 2555 / ENG 1987 / OTH 1883。
  例：

  ```text
  SYSMENUNO,USERNA,FLIE_NA,CHS,CHT,ENG,OTH,LB_TYPE,DISP_YN
  明细_用户权限,0,permission.COMM,公司代号,公司代號,Company Code,Tên công ty,0,0
  明细_用户权限,0,permission.USERID,用户ID,用戶ID,User ID,ID người dùng,0,1
  ```

- **想复原老权限**（谁能看哪个画面） → [`permission.csv`](permission.csv)，`RW` 是 9 位 Y/N 串。
- **想核对老系统参数取值** → [`s_xtcs.csv`](s_xtcs.csv)。
- **想查老推送记录** → [`s_commdata.csv`](s_commdata.csv)。
- **要重建表结构（临时库）** → [`schema.sql`](schema.sql)：
  ```powershell
  # 先造一个临时库，再对它执行；用完即删
  sqlcmd -S localhost -U <user> -P *** -C -f 65001 -Q "CREATE DATABASE tmp_legacy_restore"
  sqlcmd -S localhost -d tmp_legacy_restore -U <user> -P *** -C -f 65001 -i tools\archive\_legacy-tables-from-0909\schema.sql
  ```
  ⚠ **不要**在 `HSDZ_MES` / `HSDZ_MES_TEST` 上执行。
- Excel 直接双击 CSV 即可（UTF-8 BOM）。

---

## 6. 已知坑 / 注释错误（重要）

1. **`dm_langue` 的表注释「语言（作废）」是错的。** 实测数据是微信ID/手机号 + 在线标志 + 登录时间，
   真身是**微信/移动端在线用户表**。[`schema.sql`](schema.sql) 的表头说明已按事实写明，原始错误注释保留备查。
   （注：该表在库里的 `chs/cht/eng/oth` 列与「语言」无关，注释错位大概率来自 `deploy/sync-db-comments.sql`。）
2. **`s_sys.LB_LEFT` 的注释「小数位数」存疑**：同一组里 `LB_TOP`/`LB_WI`/`LB_HI` 是「上坐标/宽度/高度」，
   而 `LB_LEFT` 实测取值 0~200，更像「左坐标」。`schema.sql` 按原样保留该注释，仅加备注，未擅自改写。
3. **注释来源已核对**：`deploy/sync-db-comments.sql` 对这 6 张表收录的注释与快照库
   `sys.extended_properties(MS_Description)` 实测值**无一条文本不符**；该文件另有 3 条
   （`dm_langue.xc`=行序、`dm_langue.bz`=备注、`gscs.bz`=备注）在快照库里没有对应扩展属性，
   本目录一并保留，并在 `schema.sql` 里逐条标注「注释仅见于 deploy/sync-db-comments.sql」。
4. **CSV 是原样导出**：不做 trim、不改编码、不转换类型，`nchar(1)` 等定长列的值与库内一致
   （本项目踩过 `char` 尾空格坑，故不在这里做任何「看起来更干净」的清洗）。
5. `s_sys.csv` 里 `USERNA` 大量为 `0`、部分列为 NULL 是**原样如此**，不是导出丢失。

---

## 7. 复现与再验证

再导一次（只读；`<user>/<pass>` 用能读 `HSDZ_MES_0909` 的账号）：

```powershell
$jar = "tools\lib\mssql-jdbc.jar"
javac -encoding UTF-8 -cp $jar -d $env:TEMP\legacy-export tools\archive\_legacy-tables-from-0909\_export-legacy-tables.java
java -cp "$env:TEMP\legacy-export;$jar" ExportLegacyTables localhost HSDZ_MES_0909 <user> <pass> tools\archive\_legacy-tables-from-0909
# 期望输出 6 行 cols/rows 全 ok + "SELFCHECK: rows/cols all match"
```

校验留档内容（第 2、6 项需要一份 `sys.columns` dump，脚本头注释里给了生成命令）：

```powershell
node tools\archive\_legacy-tables-from-0909\_verify-export.mjs
```

2026-10-15 实测结果：

```text
PASS gscs        BOM=yes 列数=55(列名/顺序与库一致) 数据行=1(期望1) 行宽一致=yes
PASS dm_langue   BOM=yes 列数=22(列名/顺序与库一致) 数据行=15(期望15) 行宽一致=yes
PASS permission  BOM=yes 列数=18(列名/顺序与库一致) 数据行=1529(期望1529) 行宽一致=yes
PASS s_commdata  BOM=yes 列数=28(列名/顺序与库一致) 数据行=712(期望712) 行宽一致=yes
PASS s_sys       BOM=yes 列数=46(列名/顺序与库一致) 数据行=5660(期望5660) 行宽一致=yes
PASS s_xtcs      BOM=yes 列数=17(列名/顺序与库一致) 数据行=14(期望14) 行宽一致=yes
PASS schema.sql   6 张 CREATE TABLE 均带 IF OBJECT_ID 幂等守卫；已建表清单=gscs,dm_langue,permission,s_commdata,s_sys,s_xtcs
PASS schema.sql   逐列 类型/长度/可空性/IDENTITY 与 sys.columns 实况一致（比对 186 列，不符 0 列）

VERIFY: ALL PASS
```

`schema.sql` 的语法另用 `SET PARSEONLY ON`（**只解析不执行**，零写入）过了一遍：无任何错误消息；
同一通路注入一个人为语法错误能正常报「`(`附近有语法错误」，说明该检查有效。
**未做**的是把 `schema.sql` 真的执行起来建表验证——任务约束禁止新建库、也禁止对源库做任何写操作，
所以这一项属于未验证。
