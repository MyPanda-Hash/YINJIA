# 库存月结(2026-10-15)

> 用户口径:「每月 1 号自动月结上个月的」+「上月月结 / 取消上月月结 / 重新月结」三按钮 +
> 按 (物料编码, 仓库编码, 批号) 汇总上月入库(含上月结转来的量)+ 用上月入库数据循环运算逐笔统计出库汇总 +
> 写进 `inh` 生成结转单据 + 出入库三步(统计本月合计 → kucun 有则改无则增 → 改余量)+
> 报表左侧做成「采购入库单选单同款、按仓库选择」。

## 1. 两个定了才敢动数据的口径(用户 2026-10-15 拍板)

| # | 口径 | 取值 | 为什么 |
|---|---|---|---|
| A | 结转行写进 `inh` 后,**累计口径**怎么不翻倍 | 结转行 `src=0` + `单据类型='月结结转'` + `单号 JZ-YYYYMM` + `日期=次月1号`;**`v_stock_movement` 按 `单据类型<>'月结结转'` 排除它** | 三张报表与成本引擎都是「全部历史求和」;若把结转行算进去,8月末结存 X 会被 9 月再记一遍 ⇒ **库存逐月翻倍** |
| B | kucun 的「有则改无则增」 | **幂等重算**:`rkl/ckl` = 截至期末累计、`yl` = 累计入 − 累计出 | kucun 已由审核/弃审钩子**实时维护**;若按「本月入−本月出」累加就是**双计**。重算还有个附带好处:542 行负现存量那类偏差会按流水回正 |

**结转行为什么落次月 1 号**(而不是被结月份的月末):用户口径是「汇总上月的入库数量(**包含上月结转过来的数据**)」——
落在次月 1 号,次月的「本期入库」就天然含上月结转来的量;落在被结月月末则次月求和会漏掉它。

## 2. 交付物

| 层 | 文件 | 说明 |
|---|---|---|
| 库 | `tools/migrate-stock-month-close.sql` | 新建 `bd_stock_close`(头)/`bl_stock_close`(行)+ 中文注明 + 重写 `v_stock_movement`(排除结转行)+ 自检 |
| 库 | `tools/migrate-stock-movement-from-flow-2026-09-30.sql` | 历史定义**同步改**(两份定义必须逐字一致:历史脚本重放会把视图盖回去,2026-10-05 踩过) |
| 后端 | `service/StockMonthCloseService.java` | 月结引擎:汇总 → FIFO 循环运算 → 写结转行 → kucun 重算 → 头/行表;`close/cancel/reclose/detail/status` |
| 后端 | `service/StockMonthCloseScheduler.java` | `@Scheduled(cron="0 20 0 1 * ?")` 每月 1 号 00:20 自动月结上月(失败只记日志,不打断调度) |
| 后端 | `controller/StockMonthCloseController.java` | `GET /api/stock/monthClose/status`、`/detail`(展开明细)、`/state` |
| 后端 | `ButtonService` / `PanelConfigService` | 三按钮挂到「库存明细」面板的**更多**组(与「重算成本」同一套机制,权限/审计同源) |
| 后端 | `MesApplication` | `@EnableScheduling`(此前全应用无任何定时任务,随月结引入) |

### 计算顺序(有依赖,别调换)

```
① 汇总 期初/本期入/本期出   ② FIFO 分摊(顺带回写缺批号出库行的批号)
③ 用分摊结果覆盖每键出库量   ④ 写结转行(inh)  ⑤ kucun 幂等重算  ⑥ 月结头/行表
```
②必须在⑤之前:回写批号改变了流水侧的键归集,⑤要按回写后的结果重算,才能与⑥的行快照对得上。

### FIFO 循环运算(用户口径③的实现)

- 队列 = **期间开始前的结存**(按期初日合成一行,保证排在期间入库之前)+ 本期间入库行,按 (单据日期, id) 升序;
- 出库行按 (单据日期, id) 升序逐笔取用:带批号的只吃自己那一批(取空记「超发」,不阻断);
  **不带批号的在整组内先进先出,整笔恰好落在单一批次时回写 `outh.批号`**(跨批的行不回写,单行拆不成两条批号);
- 产出每批的**分摊出库量**与**最晚出库日期**;分摊不掉的余量留在原键上(不隐藏、不吞掉)。

## 3. 测试账套空跑(不写数据,先看数)

`q-01-monthclose-dryrun.sql`(换 `@period` 即可试算),`HSDZ_MES_TEST` / 期间 `2026-10` 实测:

| 项 | 值 |
|---|---|
| 键数 | 2507 |
| 期初合计 | 4,663,156.77 |
| 本期入库 / 出库 | 860,404.30 / 1,026,861.00 |
| **期末合计** | **4,496,700.07** |
| 期末为负的键 | **376**(多为「期初挂在无批号/期初批号、出库打 PC0000」的批号错位,与 kucun 542 行负现存量同源) |
| 会写结转行的键 | 2096 |

⚠ 月结会把这 376 个负结存原样写成**负数结转行**(红字入库),并把这些键的 kucun 余量按流水重算 ——
这是数据面的既有错位(kucun 那 542 行负值),不是月结引入的;要不要先清这批错位另议(见 `_kucun-stock-detail/README.md` §2)。

## 4. 复跑命令

```powershell
# 迁移(两账套;幂等)
cd tools
java -cp lib\mssql-jdbc.jar DbSync.java run migrate-stock-month-close.sql
# 空跑试算(只读)
java -cp lib\mssql-jdbc.jar SqlRunner.java "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false;trustServerCertificate=true" yinjia <口令> archive\_stock-month-close\q-01-monthclose-dryrun.sql
# 真跑(需新后端在跑;期间缺省 = 上月)
curl -X POST http://127.0.0.1:8090/api/px/callButton -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d "{\"panelCode\":\"STOCK_DETAIL\",\"buttonName\":\"上月月结\",\"formData\":{},\"buttonParam\":{}}"
```

## 5. 尚未完成(下一轮)

1. **前端三按钮**:`PanelxList.vue` 的工具栏 action 分支(参考 `重算成本` 那段)+ 结果提示;
2. **行展开显示月结明细**:表格加 `type="expand"`(面板引擎当前**没有**展开行能力,要在 flat 渲染分支里加),
   展开内容调 `/api/stock/monthClose/detail`;
3. **左侧「分仓库选择」列表**:做成与采购入库单「选单」弹窗同款(`SelectVoucherDialog.vue`),数据源换成 `bs_wh`,
   多选后过滤主表;
4. 10 语言词条(三按钮 + 展开区标题)与 5173/8090 两处走查。
