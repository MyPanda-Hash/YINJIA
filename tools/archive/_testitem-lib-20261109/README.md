# _testitem-lib-20261109 —— 「测试项目」标准库:服务器 5 个 / 本地 3 个 的核实与补齐

> 用户报障(2026-11-09):「实际服务器是有 5 个测试项目的,本地只有 3 个」

## 核实(接口 + 界面双证)

| 侧 | 加标水「测试项目」下拉 |
|---|---|
| 服务器 `36.140.66.163:8090` | `NSF 53-除铅（PH8.5）` / `NSF 53-除汞（PH8.5）` / `NSF 53-除VOC` / **`NSF 42-余氯`** / **`NSF 42氯胺`** (5) |
| 本机 `127.0.0.1:8090`(补齐前) | 前 3 条(3) |

直读服务器 `yj_std_lib`(经 `/api/stdlib/list?lib=lab.test_item&all=1`,7 行):

| id | item_code | content | seq | enabled |
|---|---|---|---|---|
| 32 | `NSF 53-除铅（PH8.5）` | 列结构 JSON(17 列) | 10 | 1 |
| 33 | `NSF 53-除汞（PH8.5）` | 列结构 JSON(15 列) | 20 | 1 |
| 34 | `NSF 53-除VOC` | 列结构 JSON(13 列) | 30 | 1 |
| **411** | `默认` | **`NSF 42-余氯`**(纯文本) | 40 | **1** |
| **417** | `默认` | **`NSF 42 氯胺  氢氧化钠  次氯酸钠  氯化铵`** | 50 | 0 |
| **418** | `默认` | **`NSF 42氯胺`**(纯文本) | 60 | **1** |
| **419** | `默认` | `cs` | 70 | 0 |

⇒ 服务器多的 2 个是**早期手工建的老式条目**:`item_code` 全是「默认」,真正的名字写在 **content 里**;
前端对"content 不是 JSON"的条目按**未设计**渲染(退回内置列集,`spikeWaterTemplate.js` 头注释已写明)。
这 4 行**不在任何迁移脚本里**(是服务器上的历史数据),所以本地库从头到尾就没有它们。

## 处置

新增 `tools/migrate-lab-testitem-legacy-20261109.sql`:把这 4 行原样补进 `yj_std_lib`
(content/seq/enabled 与服务器一致),只 INSERT、幂等(NOT EXISTS 守卫)、不动任何现有条目,
末尾自检「lab.test_item = 7 条 且 启用的纯文本老条目 = 2 条」不过即 THROW。
两账套均已执行(`[OK] 1 batches`),已登记 `tools/db-migrations.txt`。

## 验证

- 本机下拉(`ego/local-dropdown-after.png`):**5 项**,与服务器逐项相同;
- 选「NSF 42-余氯」(`ego/local-nsf42.png`):按未设计渲染,表头 = 测试日期/项目名称/测试装置/测试工位/
  配水量（L）/配置用水/**负责人/手机照片**(与服务器同一条目的表现一致);
- 两边 `lab.test_item` 行数/内容/启用状态逐行相同(`server.json` vs `local.json`)。

## 复跑

```powershell
cd tools
java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run migrate-lab-testitem-legacy-20261109.sql
set YINJIA_SQL_DB=HSDZ_MES_TEST && java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run migrate-lab-testitem-legacy-20261109.sql
node tools\archive\_testitem-lib-20261109\ego\dropdown.mjs      :: 服务器 vs 本机下拉对比
node tools\archive\_testitem-lib-20261109\ego\verify-local.mjs  :: 本机 5 项 + 余氯表头
```
