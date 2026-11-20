# 出货检验改名 + 不合格 → 开不合格品处理单(制程)(2026-11-20)

## 用户口径

> 1.名字修改为出货检验（表观）/（功能）
> 2.品质相关所有检验记录选择不合格都需要跳转至相关流程单据，当前出货检验（功能）就是转到
>   不合格处理（制程）当前不合格处理单据存在缺少对应的关联字段，为当前不合格处理（制程）的单据
>   增加字段可关联到出货检验(功能）和对应的生产工单。

追问确认（本次执行口径）：

- 「跳转」= 纸面判定**不合格**时出「去开不合格处理单」按钮，点了跳到不合格品处理单(制程)新单并
  自动带出本检验单号 + 工单号（不自动派发到别处，保存仍由用户点）；
- 「不合格处理（制程）」= **不合格品处理单(制程) QC_BHC**；
- 入口只做**出货检验（功能）QC_PROC_INSP / 出货检验（表观）QC_ASM_INSP** 两张（不含来料/首件/巡线/出厂报告）。

## 做了什么

### ① 改名（只动显示层，ADR-0001 数据键红线）

| 面板 | 旧名 | 新名 |
|---|---|---|
| QC_PROC_INSP | 出货检验单功能 | **出货检验（功能）** |
| QC_ASM_INSP | 出货检验表观 | **出货检验（表观）** |

- `yj_panel.panel_name` + panel 级 `yj_translation`（译名整体改名，保住各语种译文）；
- **`yj_menu_node` 覆盖行也改了**：左栏菜单 = 代码基线(`menus.js`) + 数据库覆盖行，
  测试库有 222 条覆盖行（设计器保存过）⇒ 只改代码基线时**测试库菜单仍旧名**（本次实测踩到）；
- 前端 `menus.js` / 选生产工单话术 / 检验方案「适用单据」/ 流程看板 / 工单追溯话术，
  后端 `checkInspAudited` 话术 / `AsmInspEntry` 提示同步；
- **不动**：面板代号、物理表、单号前缀 ZC·ZJ、菜单 code/route、历史数据、审批状态、
  受控表单标题（YJ-QR-154《出货检验功能记录表》）。

### ② 不合格品处理单(制程) 关联字段

- `qc_bhc` +`[出货检验单号] nvarchar(60)`（参照 QC_PROC_INSP.单据编号）+`[工单号] nvarchar(50)`，
  列数 58→60，列级 `MS_Description` 齐全；`yj_field` 两行（header/seq 26·27）+ `yj_translation`；
- 纸面 `docSheetConfigs.QC_BHC` 新增一行两格（出货检验单号 | 工单号）：
  **实测 4 格行在窄窗纸面 542px 时 110px 标签把参照框压成 18~34px 宽、行高 40→224px**，
  故独占一行；`refAllStatus`（表头单据状态是历史遗留列）/`refExclude=['文档编号']`/`refCarry`
  （产品规格←规格型号、生产量←检验数量），同名 客户名称/产品编码/产品名称/工单号 走 refMap。

### ③ 判定不合格 → 去开不合格处理单（跳转入口）

- 纸面动作条：检验结论=不合格时出 `⧉ 去开不合格处理单`（与草稿态无关，已审核单也能补开；打印 no-print）；
- `PanelxList.openNgDisposition`：脏单先静默保存 → `POST /api/qc/shipInsp/ng` → 按 `gotoPanel`
  关本页签、跳 QC_BHC 并 `?docNo=` 定位那张单；
- `QcShipInspNgController`：双闸门权限（来源单 + 目标单可见）、服务端复核总结论=不合格、
  按 `出货检验单号` **幂等**（同一检验单只留一张存活处理单）、带出客户/产品/工单/不合格数量合计/
  生产量/比例。

## 验证（本轮实跑）

| 项 | 结果 |
|---|---|
| 迁移两账套 | `[PASS]`；改脚本后 `DbSync` 复跑一次对齐哈希（正式/测试各 1 执行、0 失败） |
| 前端单测 | `node --test` **2292/2298**（6 条为存量：livedb/sqlcmd 环境），新增 `shipInspNg.test.js` 6/6 |
| 构建 | `npm run build`、`mvn -o compile` 通过；`apply-frontend-only.ps1` 已把新前端换进 8090（入口 `assets/index-8XAbX2Ts.js`） |
| DbNormAudit | 两账套与改前逐字一致（FAIL 3 = 02 `rd_sample_int_detail` / 09 存量缺 en / 12 未登记工具脚本，均存量；新列/新字段未被点名） |
| ego 浏览器 | ①菜单/页签显示新名（截图 `s37-menu-new.png`）；②设不合格 → 按钮出现（`s12-ng-button.png`）；③点击跳 QC_BHC 新单，纸面/库内 `出货检验单号=ZC-2026-10-0131`、`工单号=GD-2026-10-0018`（`s17-target.png`）；④再点一次回「该检验单已有不合格品处理单：同一单号」（幂等）；⑤表观单 ZJ-2026-11-0007 同样走通（`出货检验单号=ZJ-2026-11-0007`）；⑥窄窗与 940px 纸面行高 40px、无溢出（`s25-bhc-542.png`）；⑦打印 PDF 页数与加行前一致（2 页，`with/without-new-row` 对比）；⑧英文界面：面板名 `Outgoing Inspection Sheet (Functional)`、按钮 `Open NG Disposition Sheet`、纸面 `Outgoing Inspection Sheet No.` / `Work Order No.`（`s39-en.png` / `s41-bhc-en.png`） |
| 数据清理 | 测试库造的两张处理单（BHC-2026-11-0003/0004）连 head/status 删除，两张检验单总结论还原为空（`db/cleanup.sql`：after 全 0） |

## 复跑方法

```bash
# 1) 迁移（两账套）
cd tools && java -cp lib/mssql-jdbc.jar DbSync.java
YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib/mssql-jdbc.jar DbSync.java
# 2) 前端单测
cd frontend && node --test src/core/qc/shipInspNg.test.js
# 3) 界面走查
cd 本目录/ego && ego-browser nodejs -e "await import('file:///<abs>/round-17.mjs')"
```

> ego 脚本里的 `taskSpace('qc-ng-20261120')` 是本次会话的浏览器空间名；换机器时改成本地可用的空间名、
> 并把 `page.goto` 指到本机 5173/8090 即可。登录工厂用 **YINJIA-MES·测试库**（写操作只在测试库做）。
