# pkg-incr-20261103 — 配方「理论水分」口径修正 + 物料含水率补数

> 执行手册：`deploy/部署说明.md` §二 B　·　记录格式：`docs/development/部署记录规范.md`
> 台账：`deploy/部署台账.md`（本次部署后必须追加）

## 1. 这个包解决什么

用户报障（2026-11-03，服务器截图）：烧结工艺清单页 1「理论水分」永远是 `0.00%`，
而「实际灌料重量计算公式」`(1-理论水分%)/(1-实际水分%)` 因此永远算不出数。

两件事叠加，缺一不可：

| # | 层面 | 问题 | 本包动作 |
|---|---|---|---|
| ① | **数据** | `bs_inv.水分含量` 在服务器上 3961 行金蝶商品**全为 NULL** ⇒ 配方计算器 `powder_avg` 恒 0 ⇒ 理论水分 0.00% | 新增 `migrate-recipe-materials-backfill-20261103.sql`，41 条 UPDATE 按编码补空 |
| ② | **口径** | 「理论水分」这一格填的是**物料平均水分**，而纸面公式要的「实际水分」无处可取 | 前端改为落 `actual_moisture` = 1 − 脱模中值/灌料标准湿；`powder_avg` 降为弹窗参考行 |

### ① 为什么原迁移没补上

`migrate-recipe-materials.sql` 是**幂等"按需播种"**：编码已存在就只走
`ELSE UPDATE ... AND 水分含量 IS NULL`。但它在服务器上是走 **baseline（只登记、不执行）**
进 `yj_schema_log` 的（`applied_at = 2026-11-02 12:29:38`，同批 692 条，to-run 只有 6 条
— 见 `tools/archive/_deploy-20261102/steps.md` §3）。

⇒ 列建了、`yj_field` 登记了、译名写了，**唯独那 84 行 UPDATE 一次都没跑**。
服务器实测：只有 `GF-001` / `FRT` 两个"库里本来没有、由 INSERT 新建"的编码带值。

### ② 为什么改口径（用户 2026-11-03 确认）

纸面只有一个水分格，而「实际灌料重量计算公式」里 `(1-理论水分%)/(1-实际水分%)`
的**分母**就是它 —— 填 `powder_avg` 会让"实际水分"无处可取，公式闭环不了。
`powder_avg` 仍是**灌料湿重的分母**（引擎内部用），弹窗里改列为「物料平均水分（参考）」。

## 2. 包内容

| 项 | 值 |
|---|---|
| app.jar | 由提交 `07104b521` 源码重打（`build-appjar.ps1`），内嵌前端入口 `index-Cmri3RzV.js` |
| app.jar SHA256 | `A11E05D2AE6BBAFCD8BAF92BA2BF61A120A62A5FC0BE7EBADA647E8929D4D8FC` |
| 源码基线 | 仓库 HEAD `07104b521`（`fix: 配方计算器「理论水分」改写实际水分并补 84 种物料含水率`） |
| 迁移脚本 | 清单 693 条全量随包（DbSync 只跑 to-run + baseline） |
| to-run | **1 条**：`migrate-recipe-materials-backfill-20261103.sql` |
| 自证工具 | `tools/verify/FourDocAudit.java`、`DbNormAudit.java`、`fourdoc-baseline.tsv` |

## 3. to-run 是怎么算出来的（不是猜的）

按「服务器 `yj_schema_log` 实测差集」算：

```
server_logged = 727    manifest = 693
清单里服务器没有记录的 = 1 条（就是本次 backfill）
```

其余 692 条服务器均已登记，由 `baseline` 维持、**不重跑**（重跑历史脚本正是
2026-10-05 事故的成因）。

## 4. 打包前的闸

**闸一：强制重跑演练（2026-11-03 本机实测通过）**

```
node tools/verify/predeploy-rehearsal.mjs tools/archive/_deploy-20261103/to-run-20261103.txt
  HSDZ_MES       1/1 通过
  HSDZ_MES_TEST  1/1 通过
RESULT: REHEARSAL-OK
```

**闸二：字节变更脚本三查** —— 本次 to-run 是**新增脚本**（服务器登记次数 = 0），
不存在「历史脚本重跑」风险：`DROP`/`TRUNCATE`/`DELETE`/`ALTER TABLE`/`USE` **全部 0**；
41 条 `UPDATE bs_inv` 全部带 `AND [水分含量] IS NULL` 守卫（只补空，不覆盖人工维护值）。

## 5. 服务器操作（管理员 cmd，在解压后的包目录）

```cmd
deploy-production.bat            rem 只读体检，不改任何东西
deploy-production.bat GO         rem 停机 → 备份库 → 迁移 → 换 jar → 启动 → 登录验证
```

预期 `RESULT:` 序列：
`PACKAGE-OK` → `PREFLIGHT-OK` → `APP-STOPPED` → `BACKUP-GATE-PASSED` →
`MIGRATIONS-OK` → `NEW-JAR-IN-PLACE` → `APP-STARTED` → `LOGIN-OK` → **`ALL-OK`**

失败处置（不要图快重跑整包 `GO`）：停机态 + jar 未换 ⇒ 修脚本 → 打小补丁 → `GO APP` 只换包。

## 6. 部署后必须验收的三条

```sql
-- ① 含水率补上了（期望：金蝶同步 有含水率 > 0）
SELECT 数据来源, COUNT(*) 行数,
       SUM(CASE WHEN 水分含量 IS NOT NULL THEN 1 ELSE 0 END) 有含水率
FROM bs_inv GROUP BY 数据来源;

-- ② 目标物料抽查（期望 0.05 / 0.08 / NULL / NULL）
SELECT 存货编码, 水分含量 FROM bs_inv
WHERE RTRIM(存货编码) IN ('YJ-XH-002','YJ-YPS-002','YJ-ZX-003','YJ-SLD-009');
```

③ 浏览器打开服务器 → 烧结工艺清单 → 某张有配方行的单 → 页 1「理论水分」应**不再恒为 0.00**，
   且配方计算器弹窗里「理论水分」与「物料平均水分（参考）」两行**数值不同源**。

## 7. 回滚

```cmd
copy /y C:\yinjia\backup\app-<部署时间戳>.jar C:\yinjia\app.jar
schtasks /end /tn "YINJIA-MES" & schtasks /run /tn "YINJIA-MES"
```

库回滚 = 还原同批次 `C:\yinjia\backup\pre-deploy-<时间戳>.bak`（会丢掉这之后的业务写入，非必要不用）。
本次迁移**只 UPDATE 了 `bs_inv.水分含量` 的空值**（不建表、不删列、不改结构）
⇒ 不还原库也能跑回旧 jar；要撤数据只需把对应编码的 `水分含量` 置回 NULL。

## 8. 历史单据的口径差异（必须知道）

**旧单据「理论水分」存的是旧口径（`powder_avg`）**，重算后是新口径（`actual_moisture`），
两者数值接近但不同源（如 `3.72` vs `3.74`）。这不是 bug，是口径变更的必然结果；
对比历史单时不要把两者当同一口径。
