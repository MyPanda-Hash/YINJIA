# _probe-qc-insp-carry —— 「来料检验要求 → 检验报告带入」取证工具箱

2026-10-04 用户口径(四轮演进,同一主题):
1. 「更改检验报告,需要根据物料编码能够在来料检验要求找到对应的行。并且在检验项和检验标准中,
   做到对应填入检验项就是上面的检验项目,检验标准就是下面对应的数据。」
   ⇒ 要求表里 **列名(表头)= 检验项目**,该列在命中行里的 **数据 = 检测标准**,逐列拆成报告的两列。
2. 「自定义字段,是单独针对每个表的」⇒ 每张表各有各的自定义列(不同表可同名)。
3. 「字段的扩展池应该是每个表 20 个」+「父子字段」⇒ 父只做分组表头(无数据格),带入只带子字段。
4. 「将那个自定义的表删除,然后多增加一个来料检验要求的面版,下面有这几个切换表(而且都是自定义的):
   阻垢系列/BK材料系列/除重金属系列/矿化(碱性)系列/抑菌系列/载银系列/炭粉/胶粉/矿化料/原料来料,
   只是为了不要太多的表都集中在一个面版才拆成两个」
   ⇒ 两个面板:**QC_INSP_REQ**(7 张固定表)+ **QC_INSP_REQ_SERIES**(10 张全自定义表)。

## 文件

| 文件 | 用途 |
|---|---|
| `_v-two-panels.cjs` | **主探针**(20 条断言全通过):A 固定表面板只剩 7 张(旧「自定义检验要求」页签已下线)、每表自定义列与父字段分组照旧、承载列仍在本表段内;B 系列面板 10 个页签全自定义、加列(带新建父分组)、落本表段位、录数据保存落库;C 带入两个面板都生效、父名不成检验项、检验要求弹窗按面板分段。⚠ 只打测试账套(factory=YJ_TEST)、可重复跑 |
| `_v-qc-insp-carry.cjs` | 带入功能探针(22 条):面板渲染 → 自动带入 → 只补缺失项 → 幂等 → 无要求物料拦下 → 弹窗找行 → 中/英/繁三语显示 |
| `_d-fielddlg.cjs` | 排查:逐页签开「自定义字段」弹窗,打印字段列表/所属页签/父字段候选(验证"列表只显示本页签"与"无分组名的表上能不能新建父") |
| `_d-save-series.cjs` | 排查:系列面板"保存不落库"的定位工具(打印提示语/请求体/页面异常)。用法:`node _d-save-series.cjs [地址] [面板码] [页签]` |
| `_v-recon.cjs` | 排查探针:改前/改后对照来料检验要求面板与「检验要求」弹窗**能不能看到行**(detail 键回归的证据) |
| `_q-served-build.mjs` | 取证:某实例(8090 打包版 / 5173 热更)下发的 chunk 关键字 + 接口 detail 键/行数 —— 判断"用户看的是哪一版" |
| `_q-series-panel.mjs` | 取证:系列面板(QC_INSP_REQ_SERIES)的面板配置/字段/词表/detail 键/每表扩展池 |
| `_q-colcount.sql` | 只读核对:两个来料检验要求表的列数/扩展位数(供《数据库表清单》登记) |
| `QcReqDb.java` | 只读查 qc_insp_req 存活/作废行数 + `yj_archive_change_log` 保存留痕(判断"数据是不是真丢了") |
| `QcReqMeta.java` | 只读查 qc_insp_req 列/备用列池、QC_INSP_REQ 字段元数据 |
| `QcCustomTabDb.java` | 只读查 物料类别词表 / 各页签行数 / 动态字段绑定 / 标准库条目(两账套对照) |
| `WhoMadeField.java` / `DirtySpareRows.java` | 只读排障:动态字段是谁建的(绑定审计)、备用列里哪些行有数据 |
| `FixTestRow.java` | 测试库演示数据清理(把探针填错列的值挪到该在的列) |
| `AuditTabKey.java` | 只读核对:新增列 tab_key 的注明、体检 03 违规清单、QC_INSP_REQ 字段与物理列的对应 |
| `BomRoutePanels.java` | 只读核对:BOM/工艺路线相关面板与数据现状(金蝶拉取专题) |
| `_q-req-raw.mjs` / `_q-req-rows.mjs` | 最小证据:接口 `detail` 的键是 `qc_insp_req` 而非 `items`;79 行要求数据按页签分布 |
| `_v-custom-tab.cjs` | **已下线**(它测的「自定义检验要求」页签 2026-10-04 已拆成独立面板),由 `_v-two-panels.cjs` 取代 |
| `_d-carry-debug.cjs` / `_d-item-dom.cjs` | 踩坑留证:新增报告后立刻写「物料编码」会被草稿替换窗口冲掉;el-select 第一个 `.el-select__selected-item` 是 filterable 输入外壳(innerText 恒空) |

## 重要踩坑(探针与产品都要记)

- **填值后不能在同一 JS tick 里点「完成」**:编辑草稿回写原行是 Vue 的 deep watcher(microtask flush),
  同一次 `Runtime.evaluate` 里紧接着点完成会把草稿清掉 ⇒ 行里没值、保存报「第 N 行物料编号不能为空」。
  探针必须**分成两次求值**(中间隔一次 CDP 往返拿到 flush 时间)—— 这不是产品 bug(真人点击永远是另一个任务)。
- **表头列序**不能靠"行1文本 + 行2文本"拼接:分组格要按 `colspan` 展开叶子列;判断"是分组格"要看 **rowspan**
  (只有一个子列的分组 colspan 也是 1)。
- **自动带入只在报告表体为空时触发**;换物料要手动点「⧉ 带入检验要求」。
- **全自定义面板的页签来自接口**(物料类别词典):首帧还没回来时 `tab` 为 null,
  模板里 `tt(tab.sheetTitle)` 会抛错白屏 —— 组件必须给空页签兜底 + `tabsReady` 守卫(已修)。

## 运行

需 5173(vite)/ 8090(后端)已起;探针自己起 headless Edge 走 CDP:

```powershell
# 两个面板(测试账套,会加字段与数据行 —— 演示数据)
node tools/archive/_probe-qc-insp-carry/_v-two-panels.cjs

# 带入功能(正式账套,只建草稿不保存)
node tools/archive/_probe-qc-insp-carry/_v-qc-insp-carry.cjs http://127.0.0.1:8090
```

## 顺带修掉的回归(实测发现)

接口明细键 = `yj_panel.detail_key`(`migrate-arch-single-doc.sql`:档案面板 = `LOWER(panel_code)`,
单据面板 = `items`)。两个来料检验要求面板都是**档案面板** → `detail.qc_insp_req` / `detail.qc_insp_req_series`;
而 `QcInspReqSheet` / 检验要求弹窗原先写死 `detail.items` ⇒
**7 个页签全「暂无数据」、报告里点「检验要求」恒「该物料未维护来料检验要求」**。
现统一走 `@core/panel/detailRows`(判据一处),`_v-recon.cjs` 改前 0 行 / 改后 26 行可对照。
