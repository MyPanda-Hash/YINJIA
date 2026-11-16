# 检验委托单纸样合并 + 样品检验独立模块(2026-11-16)

| 属性 | 内容 |
|---|---|
| 需求(用户 2026-11-16 口径) | ①「修改这个检验委托单的格式,按照文件的形式处理。其余实现保持不变,我查看的修改是制造商和对应地址合并,生产厂也和对应地址合并。」②「样品检验需要单独放在外面的位置,相当于单独一个模块实现了。」 |
| 追问确认 | ① 委托单位/单位地址也一并按纸样合并成一行(与制造商、生产厂三行统一);② 一级模块位置 = 紧跟「品质管理」下方 |
| 源文件 | `水家电综合检测中心 检验委托单(委托检验合同).doc`(YJ-QP-701-1-01 (00),单页 A4 竖版) |
| 设计真源 | [docs/design/检验委托单-首版.md](../../../docs/design/检验委托单-首版.md)(§一 菜单 / §4.1 纸面 / §六 菜单 / §八.8 二次修订) |
| 迁移 | [tools/migrate-sample-insp-module-20261116.sql](../../migrate-sample-insp-module-20261116.sql)(已登记 `tools/db-migrations.txt`;两账套已执行) |

## 改了什么

| 文件 | 改动 |
|---|---|
| `frontend/src/core/qc/InspCommissionSheet.vue` | 委托方原来 6 行(委托单位/委托单位地址/制造商/制造商地址/生产厂/生产厂地址)⇒ **按纸样合并成 3 行**:行标签「委托单位/单位地址」「制造商/地址」「生产厂/地址」,同一行值格内并排两个输入框。**只改显示层**:数据键 / yj_field / 物理列 / 查询 / 审批一个都没动 |
| `frontend/src/business/menus.js` | 「样品检验」从品质管理二级分组**提升为一级模块**(`qcSample`),紧跟 `qc`(品质管理);两个面板叶子(送样登记表 SAMPLE_REG / 检验委托单 INSP_COMMISSION)原样 |
| `frontend/src/business/menus.test.js` | 新增用例钉住一级模块顺序(=品质管理+1)与两个子项;`PANEL_LEAF_GROUPS` 登记 `qcSample`(层级同构断言:一级下是带面板码的叶子) |
| `frontend/src/i18n/locales/en.js` | 合并行标签 en 译名:`Client / Address`、`Manufacturer / Address`、`Production Plant / Address` |
| `backend/src/main/java/com/yinjia/mes/service/ReportService.java` | `NAV_GROUP_ORDER` 在「品质管理」后补「样品检验」——权限矩阵分组顺序与侧栏同序 |
| `tools/migrate-sample-insp-module-20261116.sql` + `tools/db-migrations.txt` | 两张面板 `yj_panel.module_group` 品质管理 → 样品检验(权限矩阵分组);面板码/字段/表/授权/数据不动;幂等 |

## 验收证据

### 1. 纸面三行合并(5173 源码版,测试账套 YJ_TEST)

| 证据 | 说明 |
|---|---|
| `shots/round-06-blank.png` | 新增空白草稿:三行标签 = 委托单位/单位地址、制造商/地址、生产厂/地址;每行值格 **2 个输入框**(占位分别是名称/地址字段名) |
| `shots/round-16-filled.png` / `shots/round-18-saved.png` | 填 6 个值(名称+地址×3)后纸面;`shots/round-19-saved-reload.png` = 保存后刷新读回 |
| 数据库复核 | 保存后 `qc_insp_commission_head` 六列各自落值:`委托单位` / `委托单位地址` / `制造商` / `制造商地址` / `生产厂` / `生产厂地址`(**证明合并只是显示层,数据键未变**) |
| `round-20-print.pdf` + `print-page1.png` | 真实打印输出:`Page.printToPDF` **1 页 A4 竖版**(纸高 780px < A4 内容高);三行合并有值、明细/合计正常 |

### 2. 样品检验 = 独立一级模块

| 证据 | 说明 |
|---|---|
| `shots/round-04-nav.png` | 左侧导航一级目录顺序:…生产过程 → 品质管理 → **样品检验** → 数据建模…;样品检验下 = 送样登记表 / 检验委托单 |
| `shots/round-22-english.png` | 切 English:一级模块 `Sample Inspection`,纸面合并行 `Client / Address` / `Manufacturer / Address` / `Production Plant / Address`,无中文残留(业务数据除外) |

### 3. 静态检查

- `tools/db-migrations.txt` 两账套 `DbSync`:`执行 1 / 失败 0`(正式 HSDZ_MES;测试库顺带重放 2 条内容变更的历史幂等脚本,均 OK);
  自检:两账套 `yj_panel.module_group='样品检验'` 恰 2 行、角色授权未动。
- `DbNormAudit`(两账套):`RESULT: FAIL-3`,与改动前存量一致(02 表级注明 / 09 存量缺译名 / 12 存量 17 个未登记脚本——本次脚本已登记,不是新增);
  其中 12 项「迁移链清单↔文件」数字 794/833 未因本次变化。
- `menus.test.js`:27/27 通过(含新增 2 条断言)。
- `npm run build` 通过;`mvn -DskipTests compile`(JDK 25)通过。
- 全量 `npm test`:1937 pass / 8 fail —— 8 条均为**与本次改动无关的存量红**:
  `recordSheetConfigs.livedb.test.js` 5 条(需库口令环境)、`sheetPdfA4.test.js` / `sheetPdfFillA4.test.js` 3 条(断言的是 `sheetPdf.js` 源码常量,本次未动)。

## 测试数据清理

联调只在**测试账套**创建过 1 张 `WT-2026-11-0004` 草稿(含 2 行明细),收尾已物理删除
(head / detail / yj_doc_status;号池 `s_allno` 保留不复用);正式账套未写入任何数据。

## UI 脚本(ego 浏览器,可复跑)

`ui/round-04.mjs`(导航)、`round-06.mjs`(空白纸面)、`round-16.mjs`→`round-18.mjs`(带入项目+填值+保存;
本轮踩坑:INSP_COMMISSION 要求至少一行明细,直接点保存会弹「还有 1 项必填未填写」并挡住后续点击,需先关弹窗)、
`round-19.mjs`/`round-20.mjs`(打印,20 先清 deviceMetrics override)、`round-22.mjs`(English)。

运行方式:`ego-browser nodejs -e "await import('file:///<绝对路径>/ui/round-XX.mjs')"`(脚本内 taskSpace 固定为本任务空间)。
