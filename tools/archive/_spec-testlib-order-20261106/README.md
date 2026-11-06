# 规格书检验项目标准库：组序按《测试项目汇总.xlsx》重排（2026-11-06）

## 一句话

研发管理 · 规格书的「检验项目标准库」弹窗，**组序改由库里的 `yj_std_lib.seq` 决定**；
本次把 `spec.test` 的 47 条 seq 按《测试项目汇总.xlsx》「序 号」列重编号，肉眼可见的变化是
**「*余氯去除性能」从第 17 位回到第 9 位**（Excel 第 11 项，紧跟「隔夜浸泡口感/气味」）。

## 用户口径（2026-11-06）

> 「把研发管理的规格书的检验项目的标准库里面的内容的排序按这个文件进行排序，
> 里面的数据有点乱排序，不好找对应的在哪里」（附《测试项目汇总.xlsx》）

## 改前 / 改后（8090 实际渲染，DOM 读出来的组序）

| # | 改前 | 改后 |
|---|---|---|
| 1 | *外观 | *外观 |
| 2 | *炭棒尺寸 | *炭棒尺寸 |
| 3 | 重量 | 重量 |
| 4 | 强度 | 强度 |
| 5 | #*压降 | #*压降 |
| 6 | *黑水及颗粒物测试 | *黑水及颗粒物测试 |
| 7 | *一级颗粒物去除率 | *一级颗粒物去除率 |
| 8 | 隔夜浸泡口感/气味 | 隔夜浸泡口感/气味 |
| **9** | **VOC性能测试** | **\*余氯去除性能** ← 唯一位置变化 |
| 10 | *除铅性能测试（PH8.5&6.5) | VOC性能测试 |
| 11 | *除汞性能测试（PH8.5&6.5) | *除铅性能测试（PH8.5&6.5) |
| 12 | *Cyst去除测试 | *除汞性能测试（PH8.5&6.5) |
| 13 | *PFOA&PFOS去除性能测试 | *Cyst去除测试 |
| 14 | *NSF401（三组）去除性能测试 | *PFOA&PFOS去除性能测试 |
| 15 | *毒杀芬去除性能 | *NSF401（三组）去除性能测试 |
| 16 | *MTBE去除性能 | *毒杀芬去除性能 |
| 17 | *余氯去除性能 | *MTBE去除性能 |
| 18 | *卫生安全 | *卫生安全 |

依据：《测试项目汇总.xlsx》sheet「规格书检验项目汇总」的「序 号」列 1..26；
规格书库里只有其中 18 组，所以序号是**保留 Excel 原号**的（跳过 7 黄水 / 10 浸泡口感 /
12~17 COD·阻垢·抑菌·过流杀菌·碱性·矿化 —— 那 8 项库里没有，本任务不造数据）。

## 怎么实现的

1. `tools/migrate-testlib-spec-order-20261106.sql`（新增，已登记 `tools/db-migrations.txt`）
   —— 幂等：Excel 序号 n 的组 → seq 段 `n*100`，组内第 k 条 → `n*100 + k*10`。
2. `frontend/src/core/panel/testItemLib.js` 新增纯函数 `orderSpecGroups(groups, constOrder)`：
   组序 = ① 组内最小 seq ② 内置常量位置（兜底）③ 组名。带单测（`testItemLib.test.js` 3 条）。
3. `frontend/src/core/views/RecordSheetPanels.vue`：分组时记 `seq = 组内最小 seq`，
   用 `orderSpecGroups` 排组（原来只按内置常量 `SPEC_TEST_LIB` 的次序排，库里的 seq 完全不起作用）。

## 复跑（证据可重放）

```bash
# 1) 库：重排 spec.test 的 seq（幂等，跑两次结果一样）
cd tools && YINJIA_SQL_PASS=*** java -cp lib/mssql-jdbc.jar SqlRunner.java \
  "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" yinjia env migrate-testlib-spec-order-20261106.sql

# 2) 单测
cd frontend && node --test src/core/panel/testItemLib.test.js

# 3) 界面（ego 浏览器，8090 打包版；脚本 = 本目录 round-28.mjs）
ego-browser nodejs -e "await import('file://<本目录>/round-28.mjs')"
```

## 证据

- `round-28.mjs` —— 登录 → 打开 `#/panelx/list/RD_SPEC_DOC` → 切「检验项目及标准」→
  点「从标准库勾选」→ 按 DOM 读出 18 组次序（打印结果见提交说明）。
- `after-order-proof.png` —— 弹窗滚到第 8~10 组，可见
  「隔夜浸泡口感/气味 → \*余氯去除性能 → VOC性能测试」相邻。
- `before-8090.png` —— 改前同页（首屏 6 组，与改后一致）。

## 已知边界

- 本机没有 `HSDZ_MES_TEST` 账套（登录报 `Cannot open database`），本次只在 `HSDZ_MES` 落库；
  脚本已进迁移链，测试库/服务器按 `db-migrations.txt` 顺序执行即可（在 `migrate-testlib-seed.sql`
  之后，新环境种完种子再重排，结果一致）。
- 弹窗里第 7、10、12~17 项在 Excel 有、库里没有；用户要的话走弹窗的
  「补充自定义检验项」（加进来落 max+10，想插回 Excel 位置再跑一次本迁移）。
