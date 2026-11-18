# _qc-rec-resultcols-20261119 — 检验报告「检测结果」改为可增删列

| 属性 | 内容 |
|---|---|
| 文档类型 | 任务证据归档(一次性探针/走查脚本) |
| 适用场景 | 复核「检验报告 YJ-QR-96 的检测结果从固定五格 → 可增删列(默认 5,1~20)」这次改动 |
| 维护状态 | 归档(2026-11-19 结项) |

## 用户口径

> 「检验结果改成可以新增列的形式,不要固定5格了。」

截图红框 = 检验报告表体「检测结果」那 5 个小格。2026-11-11 那版是**固定五格**
(`migrate-qc-insp-rec-result5-20261111.sql`),本次改为**按单据可增删**(默认仍是 5 列)。

## 改了什么

| 层 | 内容 |
|---|---|
| 数据库 | `qc_insp_rec_detail` 37→**52 列**(补 `结果6..结果20` nvarchar(200) + 逐列中文注明);`qc_insp_rec` 43→**44 列**(`结果列数 int`,每张单自己的列数,界面不显示)。脚本 `tools/migrate-qc-insp-rec-resultcols-20261119.sql`,两账套已执行、复跑幂等 `[OK] 12 batches` |
| 元数据 | `yj_field`:结果1..结果20 共 20 行(`place=detail` / seq 31..50 / **visible=1, hidden=0**)、单项判定 seq 40→60、新增 `结果列数`(`place=header` / 整数 / hidden=1)。⚠ 结果列**必须可见**:隐藏字段在 `ButtonService.labelsToCols` 的更新口径下不接受空串清空 ⇒「删成空保存后又变回原值」 |
| 多语言 | `yj_translation` 结果6..结果20 + 结果列数(en/ja/ko/zh-TW);前端 `en.js` 补 Result 6..20 + 6 条 UI 词条 |
| 前端 | `core/qc/qcInspRecColumns.js`(唯一真源:键 1..20、MAX/MIN/DEFAULT 20/1/5、计数键、clamp/activeResultKeys/columnsForResultCount);`core/views/QcInspRecSheet.vue`(分区条「检测结果列 － n ＋」步进器、表头 colspan 跟列数、减列清空、屏幕定宽 + 横向滚动、打印百分比 + CSS 变量) |
| 单测 | `core/qc/qcInspRecColumns.test.js` 重写「可增删列」相关 6 条(固定五格的断言全部改口径) |

## 怎么复核

```powershell
# 1) 迁移(两账套;幂等)
cd D:\YINJIA-main\tools
java -cp lib\mssql-jdbc.jar DbSync.java run migrate-qc-insp-rec-resultcols-20261119.sql
$env:YINJIA_SQL_DB="HSDZ_MES_TEST"; java -cp lib\mssql-jdbc.jar DbSync.java run migrate-qc-insp-rec-resultcols-20261119.sql; Remove-Item Env:\YINJIA_SQL_DB

# 2) 元数据/列数自检
java -cp lib\mssql-jdbc.jar SqlRunner.java "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true" yinjia "Yinjia@2026" archive\_qc-rec-resultcols-20261119\probe-01.sql

# 3) 前端单测 + 构建
cd ..\frontend; node --test; npm run build

# 4) 界面走查(ego;5173 源码版 + 测试账套 YJ_TEST)
ego-browser nodejs -e "await import('file:///C:/Users/Lenovo/ego/qc-insp-rec-resultcols-20261119/round-14.mjs')"
```

## ego 走查结果(测试账套 JYSJ-2026-11-0021,验完已复原)

| 轮次 | 做了什么 | 结果 |
|---|---|---|
| round-01 | 打开面板 | 分区条出现「检测结果列 － 5 ＋」,表头 1..5 |
| round-02 | 加检验项行 → 列数 5→7 → 填 结果6/结果7 | 表头/输入框同步变 7,两格有值 |
| round-03 | 保存为草稿 → **刷新重取** | 7 列 + 两格值都在(服务端 detail 接口回的,不是本地状态) |
| round-04 | 减列 7→6 | 弹「减少检测结果列将清空该列已填数据,确定减少吗?」→ 确定后 6 列、结果7 已清;保存 + 刷新仍 6 |
| round-05/06/07 | 版面:6/10/15/20 列 | 6 列无横向滚动;10/15/20 列基础列不缩水(150/230/230/110)、结果格 58px、超宽横向滚动;20 列封顶并提示「已是最大列数」 |
| round-08 | 已审核单只读 | 按该单 `结果列数` 显示 5 格、输入框 0 个、**无步进器** |
| round-12/13 | 打印模拟(print media + A4 794px) | 5/10/20 列 `pageOverflow=false`,整张压进一页;≤5 列仍是老版面(14/21/21/34/10) |
| round-14 | 屏幕最终态 5 / 6 列 | 5 列与旧版视觉一致(检验项 160 / 检测标准 245 / 结果格 62) |

库内核对(测试账套):

```
JYSJ-2026-11-0021  结果列数 6 → 保存后 6;结果6='第6件:合格';减列后 结果7 = NULL
```

验完用 `cleanup-test-doc.sql` 把这张单复原(删掉测试时新增的空行、清 结果6/结果7、列数归 5)。

## 踩坑

1. **`EXEC sp_addextendedproperty` 的参数列表不接受表达式** —— 描述文本直接写 `N'…' + N'…'` 会报
   `"+" 附近有语法错误`(本脚本首跑即踩);必须先拼进变量再传。
2. **结果列不能登记成隐藏列**:隐藏字段在保存链里"只接受有值",清空落不了库
   (与 2026-11-13 那个红线同源)。所以 结果6..结果20 是 `visible=1/hidden=0`,
   代价只是"按可见列铺列"的消费端会看到空列 —— 本面板纸面走常量渲染、明细表是另一套 yj_field,均不受影响。
3. **百分比列宽会把纸面越拉越宽**:按「结果区恒占 34%」反算表宽,20 列 = 2706px,
   「检验项/检测标准」各占 380px 却没内容、结果列全被推到屏幕外。改成「基础列定宽 + 结果格 58px」后 20 列 = 1926px。
4. **打印不能沿用屏幕那套 px 定宽**:20 列会把半张表切到纸外。打印改回百分比 fixed 布局,
   用 CSS 变量 `--qr-res-w` / `--qr-base-scale` 控制结果区占比与基础列让位。
