# 工单排产·列设置(2026-11-18)取证

用户口径:「为当前的工单排产处也增加列设置。让用户可以调整当前查看的列和不查看的列」。

改动落点:

| 文件 | 作用 |
|---|---|
| `frontend/src/business/woBoardColumns.js` | 列定义(冻结区 / 日期伪列 / 列名↔数据键)+ `boardRenderColumns`(草稿 → 渲染列序)+ `clampToScrollZone`(拖动夹回滚动区)。纯函数,无 Vue 依赖 |
| `frontend/src/business/woBoardColumns.test.js` | 9 条单测:冻结区顺序锁定、显隐、日期组整组搬家、草稿为空兜底、死列名丢弃、列名↔数据键、拖动夹取 |
| `frontend/src/views/modules/plan/WorkOrderBoard.vue` | 明细表由「逐列写死」改为 `v-for="col in renderCols"`;加「列设置」按钮 + 弹窗;挂 `useReportColumns(panelCode=WORK_ORDER_BOARD)` |
| `frontend/src/core/views/ColumnSettingsDialog.vue` | 通用弹窗新增 `locked` 支持(冻结列只能显隐、顺序固定;拖动与 ▲▼ 禁用,显示锁图标) |
| `frontend/src/i18n/locales/en.js` | 补 `顺序固定` / `带锁的列…` / `日排产日期列`(最后一条是「生产工单·列表」2026-11-13 起就漏译的键) |

## 取证脚本(ego 浏览器,`C:/Users/<user>/ego/wo-board-column-settings-20261118/` 原样拷来)

按顺序跑,每轮都是一次完整的 Node 脚本(每次新进程,页面状态在同一个 task space 里延续):

| 轮次 | 做了什么 | 关键输出 |
|---|---|---|
| round-01 | 打开 5173 的 `#/prod/plan/workOrderBoard`(必要时自动登录 admin) | `列设置按钮: true`;表头 45 列 = 改造前顺序,选择框/工单号在最左;冻结列 6 个 sticky(选择+工单号+4 冻结) |
| round-02 | 选 1 号车间 → 明细/日期列传出来 → 打开列设置 | 日期列 `11-11/11-12/11-18今`;弹窗 43 条,其中「产品编码/产品规格/订单数量/客户」`locked: true`,并出现第二条说明「带锁的列只能显隐…」 |
| round-03 | 取消勾选「批号」「备注」+ 保存 → 截图表 → 刷新页面再看 | 保存后 `批号:false 备注:false`;刷新后仍是 `false` ⇒ 落库生效(`/px/reportColumnSettings`) |
| round-04 | 读后端已保存 JSON → 点「恢复默认」→ 保存 → 刷新复核 | 已存 `列数 43 / 隐藏 [批号,备注] / 尾部 …结案时间,打印次数,打印人,打印时间`(证明 ▲ 上移两次真的改了顺序);恢复后 47 列、默认顺序、刷新不变 |
| round-05 | 设置行删除后重进页面 + 拖动测试 | 默认 47 列;**拖锁定列「客户」⇒ 顺序不变**(`客户`仍在第 3 位);**拖普通列「打印次数」⇒ 位次 4**(夹回滚动区首位,没被塞进冻结区);点「取消」⇒ 表头与默认完全一致(草稿丢弃) |
| round-06 | DOM 断言表头顺序 | 冻结区在前=true;日期组在「大于15天已排」之后、「未交量」之前=true;「生产状态」最后=true |
| round-07 | 打包版 8090(前端在 jar 里)复核 | `列设置按钮:true`、表头 48、日期列 3;弹窗锁定条目 = 产品编码/产品规格/订单数量/客户 |
| round-08 | 注释改动后重 build(入口 chunk 换新)再确认 8090 | `列设置按钮:true`、表头 45(未选线 ⇒ 无日期列)、弹窗锁定 4 项 |
| round-09 | **共用弹窗回归**:生产工单·列表(同一个 ColumnSettingsDialog) | 弹窗正常打开,`锁定条目 0 / 锁图标 0 / 提示 1 条 / 条目 38` ⇒ 没有 locked 列时行为与改动前一致 |

截图(**仓库 `.gitignore` 拦 `*.png`,所以只列名不随仓库提交**,原图在
`C:/Users/vigna/ego/wo-board-column-settings-20261118/`,脚本可复跑重出):
`round-01-board.png`(首屏)、`round-02-dialog.png`(列设置弹窗,锁定列带锁)、
`round-03-after-save.png`(隐藏两列后)、`round-03-after-reload.png`(刷新后仍隐藏)、
`round-04-reset.png`/`round-04-restored.png`(恢复默认)、`round-05-default.png`(默认全列)、
`round-07-8090.png`(打包版弹窗)、`round-08-8090-rebuilt.png`(重打包后再验)、
`round-09-workorderlist-dialog.png`(共用弹窗在「生产工单·列表」上的回归)。

## 数据侧收尾

`report_column_settings` 按面板存一行、**全用户共享**。取证过程写进去的 `WORK_ORDER_BOARD`
一行(隐藏批号/备注 + 打印次数上移)已用 `ResetWoBoardColumnSettings.java` 删掉,
两个账套复核:正式 `HSDZ_MES` 无该行(表内 1 行 = 别的面板)、测试 `HSDZ_MES_TEST` 也无该行。
即:**本页回到「没配置过 = 默认全列」的原状**,与该功能上线前一致。

```bash
# 只读查看(在 tools/archive/_wo-board-columns-20261118 目录内执行)
"%USERPROFILE%/.jdks/ms-25.0.4/bin/java" -Dstdout.encoding=UTF-8 -cp ".;../../lib/mssql-jdbc.jar" ResetWoBoardColumnSettings
# 清理时(run once,已执行过):加 --delete
```

## 回归闸

- `node src/business/woBoardColumns.test.js`(frontend 目录)= 9/9 pass;
- `npm run build` 通过(产物入口 `assets/index-2UjfIs3h.js`,已 `apply-frontend-only.ps1 -NoBuild` 换进 jar);
- 未改任何后端代码、未改 `yj_field`/`yj_panel`(列是本页硬编码的,不是元数据面板)⇒ 四单基线不受影响。
