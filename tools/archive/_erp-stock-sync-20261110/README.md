# _erp-stock-sync-20261110 — 金蝶库存数量同步(以金蝶为准)取证与探针

> **任务**:用户 2026-11-10 ——「同步脚本能不能实时同步金蝶真实账套的库存数量,我们想要以金蝶的库存数量为准」。
> **交付**:`deploy/sync-stock.mjs`(实现,也可独立跑)+ `tools/migrate-erp-stock-sync-20261110.sql`;
> 口径文档 `docs/development/金蝶库存同步-以金蝶为准.md`。
> **2026-11-11 并入**:用户「能不能和之前的商品同步脚本写在一起」⇒ 库存那步由 `deploy/sync.mjs`
> 一个入口调用(`runStockSync`),计划任务只留 `JdySalOrderSync`(旧的 `JdyStockSync` 由
> `install-tasks.ps1` 自动删除)。`_q-after-merged.mjs` = 合并入口跑完后的一致性复核
> (kucun 合计 4,435,020.61 = 库存明细;负行 0;日志 一致 1394/覆盖 0)。

## 一、探针(只读)

| 文件 | 干什么 |
|---|---|
| `_probe-ims.mjs` | 金蝶现存量接口取证(字段/行数/翻页/批号形态/与 MES 逐键对比)→ `tools/archive/_dump-out/erp-stock-ims-probe-20261110.md` |
| `_q-stock-shape.mjs` | `kucun` 列与概况、`v_stock_*` 视图清单 |
| `_q-panel2.mjs` | 库存类面板(line_table)与 `STOCK_STATUS` 字段清单 |
| `_q-field-shape.mjs` | `yj_field`/`yj_translation` 列与样例(加字段前的取证) |
| `_q-dup.mjs` | 三键重复检查(覆盖前必须 0 组,否则库存翻倍) |
| `_q-notnull.mjs` | `kucun` 非空列与默认值(新增行能否只给少数字段) |
| `_q-computed-probe.mjs` | 「差异数量」能否做成计算列(float 参与) |
| `_q-verify-migration.mjs` | 迁移后结构自检(3 列/2 表/12 译名) |
| `_q-views.mjs` / `_q-final-verify.mjs` | 同步后各视图/口径合计复核 |
| `_q-after-test.mjs` / `_q-zero-check.mjs` | 测试库试跑后的分布与「清零」行排查(PC0000 踩坑现场) |
| `_dump-view.mjs` / `_v-stock-balance-now.sql` | 现役 `v_stock_balance` 定义副本(流水口径,本次未改) |
| `_perturb-test.mjs` | 在测试库人造「覆盖/新增/清零」三种情形验证分类计数 |
| `_backup-kucun.mjs` | 首轮前 `kucun` 全量前像 → `deploy/backup/kucun-before-stock-sync-20261110.jsonl` |

## 二、界面取证(ego 浏览器)

`round-01.mjs`(在 `C:/Users/Lenovo/ego/stock-sync-kingdee-20261110/` 下运行过),
`stock-status.png` = 库存状况面板截图:**15 列**,含 `金蝶数量 / 差异数量 / 金蝶同步时间`,
「库存状况 共 2285 行」,首行 YJ-ZX-008 CK00006 现存量 2240 = 金蝶数量 2240、差异 0。

## 三、实测数字(2026-11-10)

| 项 | 值 |
|---|---|
| 金蝶现存量 | 1,396 行 / 4,314,349.61(3 页,page_size=500) |
| 首轮(正式库) | 一致 742 / 覆盖 521 / 新增 133 / 清零 845,差异合计 **−1,532,611.80** |
| 首轮后 `kucun` | 2,285 行 / 合计 **4,314,349.61** / 负行 **69 → 3**(= 金蝶侧那 3 行)/ 差异列全 0 |
| 第二轮(正式库) | 一致 1,396,其余 0(幂等) |
| 测试库 | 首轮 一致 735 / 覆盖 556 / 新增 105 / 清零 1,138;第二轮 一致 1,396,其余 0 |
| 启动自检 | `[库存对账] 库存以金蝶为准:2241 个键与最近一轮快照完全一致` |

## 四、踩坑(已修,别再犯)

1. **`差异数量` 做成普通列会过期** ⇒ 改成计算列 `金蝶数量 − yl`,同步后恒 0、MES 审核单据后立刻显偏差。
2. **快照 `处理方式` 不能先插 NULL**(列 NOT NULL)⇒ 先写占位「待定」再回填。
3. **`PC0000` 不能归成"无批号"**:JS 归一时把它并到空批号键,SQL 侧却是字面比较 ⇒
   PC0000 行既没覆盖也没清零,每轮重报。现在两侧统一按字面匹配(见 `sync-stock.mjs` `normLot` 注释)。
4. **`INSERT…SELECT` 不能自读目标表**:清零行改用 `SELECT … INTO #zero` 中转。
