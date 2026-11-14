# 首件检验单 · 服务端报表「纸面黄格」同口径（2026-11-14 第十轮）

> 本目录 = 共享任务板 `task-2`（服务端报表 JSreport/Jasper 同口径）的证据与复跑入口。
> 可填矩阵唯一真源 = **`docs/design/首件检验单-可填范围.md`**（前端口径真源 =
> `frontend/src/core/qc/firstInspCols.js` 的 `sampleRowsOf / isFillableCell / isCheckColumn`）。

## 一、口径

用户口径（2026-11-14，随《炭棒成型车间首件检验记录表》原图给）：

> 「将当前的首件检验单格式修改为图中所示，也就是**没有黄色的格子就打上斜杠，不可填写**，
>  其余的不用修改，就还需要把**对应的表格修改为黄色**。」

服务端报表（`QcFirstInspReportSupport` → `reports/qc_first_insp.jrxml`）照此出纸：

| 测试项目列（按列名认，顺序同前端口径） | 可填样品行 | 纸面颜色 |
|---|---|---|
| 表观状态 / 脱粉情况 / 炭粉情况（勾选式两列） | **1#、2#** | 淡黄 `#FFF3CA` |
| 外径 / 内径 / 长度 / 重量 | **3#、4#** | 淡黄 `#FFF3CA` |
| 跌落（跌落强度） | **5#、6#** | 淡黄 `#FFF3CA` |
| 挤压强度（抗压强度） | **7#、8#** | 淡黄 `#FFF3CA` |
| 压降kPa（压缩kPa）、浊度NTU | **7#、8#** | 淡黄 `#FFF3CA` |
| 认不出列名的新增列 | 分组兜底：表观及脱粉 1#/2#、尺寸及重量 3#/4#、强度 5#/6#、浊度及压降 7#/8#、**未知组 7#/8#** | 淡黄 |
| 其余样品格 | 不可填 | 白底 + `/` |
| 标准行的表观/脱粉两格 | 不可填（纸面本来如此） | 灰底 `#D9D9D9` + `/` |

合计（10 列 × 8 行）：可填格 **20 个**、`/` 占位格 **60 个**。

⚠ 与第六/七轮的区别（别照旧实现）：**强度组的「跌落」在 5#/6#、「挤压强度」在 7#/8#** —— 纸面黄格
逐格量色就是被拆成两对的，不是按分组一刀切；
⚠ 与第九轮的区别（被本轮推翻）：第九轮「前两列限 1#/2#、其余列 8 行全开」→ 现回到纸面分组对。

## 二、改动

只碰了任务写死的两个文件（**未碰前端 / 数据库 / 菜单 / 其他 java / `backend/src/main/resources/static`**）：

### 1. `backend/src/main/java/com/yinjia/mes/service/QcFirstInspReportSupport.java`

| 改动 | 说明 |
|---|---|
| `fillable(sample, group)`（按分组一刀切）→ `sampleRowsOf(key, label, group)` | **按列名认 + 分组兜底**；判定顺序与前端 `sampleRowsOf` 逐条一致：①勾选式两列（表观状态/表观/粘模/脱粉/炭粉情况 + key 兜底）→ ②外径/内径/长度/重量 → ③跌落 → ④挤压/抗压 → ⑤压降/压缩 → ⑥浊度 → ⑦分组兜底 |
| 新增 `isCheckColumn(key, label)` | 与前端 `isCheckColumn` 同正则口径；既用于「可填行 1#/2#」，也用于标准行的灰底判定 |
| `Col.cells` 生成 | 本列那一对行写实测值（没值 = 空格），其余格写 `/`（**保持旧做法不变**） |
| `report()` 选样式 | 样品行：可填格 `cellY`（黄底 `#FFF3CA`）、不可填格 `cellC`（白底 + `/`）；标准行：表观/脱粉两列 `smallG`（灰底 `#D9D9D9`），其余仍 `small` |
| `signature()`（编译缓存键） | **可填样品行也进签名**（黄格位置 = 结构；否则改列名可能命中旧缓存、黄格错位） |
| `describe()` | 摘要每列多打一段 `可填=1#,2#`（冒烟/日志取证用） |
| 类注释 | 改为第十轮口径，写清契约文件、前端真源文件名、判定顺序、绿/黄/灰的语义 |

### 2. `backend/src/main/resources/reports/qc_first_insp.jrxml`

- `<style>` 段新增两个样式（**只有这两个**）：
  `cellY = cellC + mode="Opaque" backcolor="#FFF3CA"`、`smallG = small + mode="Opaque" backcolor="#D9D9D9"`；
- 文件头补 2026-11-14 第十轮说明（颜色 + 契约指针）；
- **没动**：`pageWidth=842 / pageHeight=595 / columnWidth=782`、无 `orientation`（既有坑，见
  `docs/design/首件检验单-服务端报表模板.md` §五坑①）、参数契约、各段 band 高度。

### 3. 本目录（新增）

`README.md` + `_FirstInspReportSmoke.java`（离线冒烟，可复跑）+ 产物：
`_first-insp-report-yellow.pdf / .xlsx`（冒烟当场生成，**不参与** `mvn` 构建）+
`_first-insp-report-yellow.png`（PDF 第 1 页渲染图，人眼复核版式/黄格用）。

### 没动的（回归边界）

版面仍是 1 页 A4 横向 842×595 / `columnWidth=782` / 行标签列 78pt / 其余列等分（余数补末列）/
标准行高按"每列文字在本列宽度下折几行"算 / 行高 20；`ReportService`、`report-templates.properties`、
数据库、菜单、前端文件**一个字节没改**。表头原有的灰（`th` `#EFEFEF`、`thGroup` `#E0E0E0`）
与抬头皮（`metaL` `#F2F2F2`）也都保持原样（本轮口径只要求"标准行表观/脱粉两格"改灰）。

## 三、验证

### 3.1 编译

```bash
# ⚠ JDK 必须是 25：backend/pom.xml 的 maven.compiler.release=25；本机会话默认 JAVA_HOME 是
#   openjdk-23.0.1（javac 不认 --release 25），必须显式钉到 JDK 25（与 AGENTS.md 环境前提一致）。
cd backend
JAVA_HOME='C:/Users/vigna/.jdks/ms-25.0.4' mvn -q -DskipTests compile
# → exit 0（无输出 = 通过；仅 Maven 自身的 Unsafe WARNING）
```

### 3.2 离线冒烟（不启动后端、不碰库）

```bash
# 仓库根执行；类路径 = 已编译 classes + mvn dependency:build-classpath 的产物 backend/target/cp.txt
JAVA='C:/Users/vigna/.jdks/ms-25.0.4/bin/java.exe'
CP="backend/target/classes;$(tr '\n' ';' < backend/target/cp.txt)"
"$JAVA" -Dstdout.encoding=UTF-8 -cp "$CP" \
    tools/archive/_first-insp-report-20261114/_FirstInspReportSmoke.java
```

冒烟做的事：10 列 × 8 行假明细 → `matrix()` → 断言矩阵（**20 可填 / 60 个 `/`**、逐列可填行 = 契约、
值只落本列那一对行）→ 9 个「新增列/列名变体」用例（分组兜底 + 显式列名优先）→ `report()` 编译
（842×595、`columnWidth=782`、二次取命中缓存）→ 填充（**1 页**）→ 逐元素数底色（**黄 20 / 灰 2**，
并按 x/y 反推"哪一列的哪两行是黄的"= 契约）→ 导出 PDF（1 页、MediaBox 842×595、解压内容流后数
黄/灰填充算子 **20 / 2**）→ 导出 xlsx（sheet `qc_first_insp`、8 个样品行、样品行里 **60 个 `/`**）
→ 空明细也能编译。**结果：133 PASS / 0 FAIL，SMOKE OK。**

完整输出：

```text
==== ① 矩阵（10 列 × 8 行）====
组数=4 列数=10 结果=合格 检验人=admin
  [表观及脱粉] 炭棒表观状态(标准=/; 可填=1#,2#; 格=,无粘模（均匀）,/,/,/,/,/,/) 炭棒脱粉情况(标准=/; 可填=1#,2#; 格=,,/,/,/,/,/,/)
  [尺寸及重量] 炭棒外径(mm)(标准=; 可填=3#,4#; 格=/,/,,34.2,/,/,/,/) 炭棒内径(mm)(标准=; 可填=3#,4#; 格=/,/,,,/,/,/,/) 炭棒长度(mm)(标准=; 可填=3#,4#; 格=/,/,,,/,/,/,/) 炭棒重量(g)(标准=; 可填=3#,4#; 格=/,/,,,/,/,/,/)
  [强度] 跌落(标准=跌落高度: 10cm;跌落次数: 10次;跌落要求: 10; 可填=5#,6#; 格=/,/,/,/,,5,/,/) 挤压强度(kgf)(标准=测试间距: 10mm;压头下降速度: 10mm/min;强度要求: 10; 可填=7#,8#; 格=/,/,/,/,/,/,,155)
  [浊度及压降] 浊度NTU(标准=/; 可填=7#,8#; 格=/,/,/,/,/,/,,1.2) 压降kPa(标准=压降标准: 10kPa;是否测试: √; 可填=7#,8#; 格=/,/,/,/,/,/,,1.1)

  [PASS] 列数 = 10
  [PASS] 组数 = 4
  [PASS] 分组[1] 名称 = 表观及脱粉
  [PASS] 分组[表观及脱粉] 列数 = 2
  [PASS] 分组[2] 名称 = 尺寸及重量
  [PASS] 分组[尺寸及重量] 列数 = 4
  [PASS] 分组[3] 名称 = 强度
  [PASS] 分组[强度] 列数 = 2
  [PASS] 分组[4] 名称 = 浊度及压降
  [PASS] 分组[浊度及压降] 列数 = 2
  [PASS] 展平列数 = 10
  [PASS] 列[1] 数据键 = appearance
  [PASS] 列[1] 列名 = 炭棒表观状态
  [PASS] 列[1] 分组 = 表观及脱粉
  [PASS] 列[1] 样品格数 = 8
  [PASS] 列[1] 炭棒表观状态 可填行 = [1, 2]
  [PASS] 列[2] 数据键 = depowder
  [PASS] 列[2] 列名 = 炭棒脱粉情况
  [PASS] 列[2] 分组 = 表观及脱粉
  [PASS] 列[2] 样品格数 = 8
  [PASS] 列[2] 炭棒脱粉情况 可填行 = [1, 2]
  [PASS] 列[3] 数据键 = outer
  [PASS] 列[3] 列名 = 炭棒外径
  [PASS] 列[3] 分组 = 尺寸及重量
  [PASS] 列[3] 样品格数 = 8
  [PASS] 列[3] 炭棒外径 可填行 = [3, 4]
  [PASS] 列[4] 数据键 = inner
  [PASS] 列[4] 列名 = 炭棒内径
  [PASS] 列[4] 分组 = 尺寸及重量
  [PASS] 列[4] 样品格数 = 8
  [PASS] 列[4] 炭棒内径 可填行 = [3, 4]
  [PASS] 列[5] 数据键 = length
  [PASS] 列[5] 列名 = 炭棒长度
  [PASS] 列[5] 分组 = 尺寸及重量
  [PASS] 列[5] 样品格数 = 8
  [PASS] 列[5] 炭棒长度 可填行 = [3, 4]
  [PASS] 列[6] 数据键 = weight
  [PASS] 列[6] 列名 = 炭棒重量
  [PASS] 列[6] 分组 = 尺寸及重量
  [PASS] 列[6] 样品格数 = 8
  [PASS] 列[6] 炭棒重量 可填行 = [3, 4]
  [PASS] 列[7] 数据键 = drop
  [PASS] 列[7] 列名 = 跌落
  [PASS] 列[7] 分组 = 强度
  [PASS] 列[7] 样品格数 = 8
  [PASS] 列[7] 跌落 可填行 = [5, 6]
  [PASS] 列[8] 数据键 = compress
  [PASS] 列[8] 列名 = 挤压强度
  [PASS] 列[8] 分组 = 强度
  [PASS] 列[8] 样品格数 = 8
  [PASS] 列[8] 挤压强度 可填行 = [7, 8]
  [PASS] 列[9] 数据键 = turbidity
  [PASS] 列[9] 列名 = 浊度NTU
  [PASS] 列[9] 分组 = 浊度及压降
  [PASS] 列[9] 样品格数 = 8
  [PASS] 列[9] 浊度NTU 可填行 = [7, 8]
  [PASS] 列[10] 数据键 = pressure
  [PASS] 列[10] 列名 = 压降kPa
  [PASS] 列[10] 分组 = 浊度及压降
  [PASS] 列[10] 样品格数 = 8
  [PASS] 列[10] 压降kPa 可填行 = [7, 8]
  [PASS] 可填样品格总数 = 20
  [PASS] `/` 占位格总数 = 60
  [PASS] appearance 2# 实测值 = 无粘模（均匀）
  [PASS] outer 4# 实测值 = 34.2
  [PASS] drop 6# 实测值 = 5
  [PASS] compress 8# 实测值 = 155
  [PASS] turbidity 8# 实测值 = 1.2
  [PASS] pressure 8# 实测值 = 1.1
  [PASS] outer 5#（本轮不可填）纸面占位 = /
  [PASS] appearance 5#（本轮不可填）纸面占位 = /

==== ② 新增列 / 列名变体（按列名认 + 分组兜底）====
  [PASS] 列名=炭粉情况 分组=表观及脱粉 可填行=[1, 2]
  [PASS] 列名=跌落强度 分组=尺寸及重量 可填行=[5, 6]
  [PASS] 列名=抗压强度 分组=强度 可填行=[7, 8]
  [PASS] 列名=压缩kPa 分组=强度 可填行=[7, 8]
  [PASS] 列名=自定义项目A 分组=表观及脱粉 可填行=[1, 2]
  [PASS] 列名=自定义项目B 分组=尺寸及重量 可填行=[3, 4]
  [PASS] 列名=自定义项目C 分组=强度 可填行=[5, 6]
  [PASS] 列名=自定义项目D 分组=浊度及压降 可填行=[7, 8]
  [PASS] 列名=自定义项目E 分组=未分组XYZ 可填行=[7, 8]

==== ③ 生成 → 编译 ====
  编译耗时 1077ms
  [PASS] pageWidth = 842
  [PASS] pageHeight = 595
  [PASS] columnWidth = 782
  [PASS] 同矩阵二次取命中编译缓存

==== ④ 填充 + 黄格/灰格底色取证（JasperPrint 元素 backcolor）====
  [PASS] PDF 页数 = 1
  [PASS] 标准行两灰格 y/height 一致
  [PASS] 黄格数（#FFF3CA） = 20
  [PASS] 灰格数（#D9D9D9，标准行表观/脱粉） = 2
  [PASS] 标准行灰格高度 > 0（取到标准行高）
  [PASS] 黄格覆盖列数 = 10
  [PASS] 黄格 y 落在样品行网格上（x=108 y=185）
  [PASS] 黄格 y 落在样品行网格上（x=178 y=185）
  [PASS] 黄格 y 落在样品行网格上（x=108 y=205）
  [PASS] 黄格 y 落在样品行网格上（x=178 y=205）
  [PASS] 黄格 y 落在样品行网格上（x=248 y=225）
  [PASS] 黄格 y 落在样品行网格上（x=318 y=225）
  [PASS] 黄格 y 落在样品行网格上（x=388 y=225）
  [PASS] 黄格 y 落在样品行网格上（x=458 y=225）
  [PASS] 黄格 y 落在样品行网格上（x=248 y=245）
  [PASS] 黄格 y 落在样品行网格上（x=318 y=245）
  [PASS] 黄格 y 落在样品行网格上（x=388 y=245）
  [PASS] 黄格 y 落在样品行网格上（x=458 y=245）
  [PASS] 黄格 y 落在样品行网格上（x=528 y=265）
  [PASS] 黄格 y 落在样品行网格上（x=528 y=285）
  [PASS] 黄格 y 落在样品行网格上（x=598 y=305）
  [PASS] 黄格 y 落在样品行网格上（x=668 y=305）
  [PASS] 黄格 y 落在样品行网格上（x=738 y=305）
  [PASS] 黄格 y 落在样品行网格上（x=598 y=325）
  [PASS] 黄格 y 落在样品行网格上（x=668 y=325）
  [PASS] 黄格 y 落在样品行网格上（x=738 y=325）
  列    列名           分组             矩阵可填行        PDF 黄格行
  [PASS] 列[1] 炭棒表观状态 PDF 黄格行 = [1, 2]
  1    炭棒表观状态       表观及脱粉          [1, 2]       [1, 2]
  [PASS] 列[2] 炭棒脱粉情况 PDF 黄格行 = [1, 2]
  2    炭棒脱粉情况       表观及脱粉          [1, 2]       [1, 2]
  [PASS] 列[3] 炭棒外径 PDF 黄格行 = [3, 4]
  3    炭棒外径         尺寸及重量          [3, 4]       [3, 4]
  [PASS] 列[4] 炭棒内径 PDF 黄格行 = [3, 4]
  4    炭棒内径         尺寸及重量          [3, 4]       [3, 4]
  [PASS] 列[5] 炭棒长度 PDF 黄格行 = [3, 4]
  5    炭棒长度         尺寸及重量          [3, 4]       [3, 4]
  [PASS] 列[6] 炭棒重量 PDF 黄格行 = [3, 4]
  6    炭棒重量         尺寸及重量          [3, 4]       [3, 4]
  [PASS] 列[7] 跌落 PDF 黄格行 = [5, 6]
  7    跌落           强度             [5, 6]       [5, 6]
  [PASS] 列[8] 挤压强度 PDF 黄格行 = [7, 8]
  8    挤压强度         强度             [7, 8]       [7, 8]
  [PASS] 列[9] 浊度NTU PDF 黄格行 = [7, 8]
  9    浊度NTU        浊度及压降          [7, 8]       [7, 8]
  [PASS] 列[10] 压降kPa PDF 黄格行 = [7, 8]
  10   压降kPa        浊度及压降          [7, 8]       [7, 8]

==== ⑤ 导出 PDF（1 页 / A4 横向 842×595）====
  [PASS] PDF 文件非空（>10KB）
  tools\archive\_first-insp-report-20261114\_first-insp-report-yellow.pdf 98322 bytes
  [PASS] PDF MediaBox 宽 = 842.0
  [PASS] PDF MediaBox 高 = 595.0
  [PASS] PDF 页对象数（/Type/Page） = 1
  颜色算子（PDF 解压后内容流）：黄="1 0.95294 0.79216 rg" 灰="0.85098 0.85098 0.85098 rg"
  [PASS] PDF 黄底填充次数 1 0.95294 0.79216 rg = 20
  [PASS] PDF 灰底填充次数 0.85098 0.85098 0.85098 rg = 2

==== ⑥ 导出 xlsx ====
  [PASS] xlsx 文件非空（>1KB）
  tools\archive\_first-insp-report-20261114\_first-insp-report-yellow.xlsx 9106 bytes
  [PASS] xlsx sheet 名 = qc_first_insp
  [PASS] xlsx 行数 >= 20（标题+两级表头+标准行+8 样品行+相关要求+表尾）
  xlsx 行数 = 31
  [PASS] xlsx 样品行数 = 8
  [PASS] xlsx 样品行里的 `/` 单元格数 = 60

==== ⑦ 空明细（单子上还一列都没铺）不炸 ====
  [PASS] 空明细列数 = 0
  [PASS] 空明细也能编译

===== 冒烟结果：133 PASS / 0 FAIL =====
SMOKE OK
```

### 3.3 取证摘要

| 项 | 结果 | 证据来源 |
|---|---|---|
| 矩阵 10 列 × 8 行 | 4 组（2/4/2/2 列），逐列可填行 = 契约 | 冒烟 §① |
| 可填格 / `/` 占位格 | **20 / 60** | 冒烟 §①、xlsx §⑥ |
| 逐列黄格行对（PDF 几何反推） | 表观/脱粉 1#/2#、尺寸四项 3#/4#、跌落 5#/6#、挤压+浊度+压降 7#/8# | 冒烟 §④ |
| 黄/灰底色真的印进 PDF | `#FFF3CA` 填充 20 次、`#D9D9D9` 填充 2 次 | 冒烟 §⑤（解压 PDF 内容流后数 `rg` 算子） |
| PDF | **1 页**、A4 横向（`/MediaBox [0 0 842 595]`）、98,322 bytes | 冒烟 §⑤ + 产物 `_first-insp-report-yellow.pdf` |
| xlsx | 导出成功、sheet `qc_first_insp`、样品行 8 行且 `/` 恰 60 个 | 冒烟 §⑥ + 产物 `_first-insp-report-yellow.xlsx` |
| 新增列兜底 | 表观及脱粉 1#/2#、尺寸及重量 3#/4#、强度 5#/6#、浊度及压降 7#/8#、未知组 7#/8#；`跌落强度`→5#/6#、`抗压强度`→7#/8#（显式列名优先） | 冒烟 §② |
| 空明细（未铺列） | 列数 0 也能编译（点导出不 500） | 冒烟 §⑦ |
| 版面回归（人眼） | 把 `_first-insp-report-yellow.pdf` 渲染成 PNG（`pymupdf`）与**改前**的 `tools/archive/_smoke-first-insp-report.pdf` 逐块对照：公司/大标题/抬头四对/两级表头/标准行/1#..8#/相关要求/表尾/页脚位置与列宽**完全一致**（唯一差别 = 黄/灰底色），1 页不裁切 | `_first-insp-report-yellow.png` |
| 逐格黄格（人眼） | 图上一眼可数：1#/2# 各 2 格、3#/4# 各 4 格、5#/6# 各 1 格（跌落）、7#/8# 各 3 格（挤压+浊度+压降）= **20 格**；其余全白 + `/` | `_first-insp-report-yellow.png` |

> 渲染命令（复跑）：`cd tools/archive/_first-insp-report-20261114 && python -c "import pymupdf; d=pymupdf.open('_first-insp-report-yellow.pdf'); d[0].get_pixmap(matrix=pymupdf.Matrix(2.2,2.2)).save('_first-insp-report-yellow.png')"`
> ⚠ 标准行「挤压强度」那格文字末尾被截（"…强度要"）是**改前就有的**行高估算行为（同一格在改前
> `_smoke-first-insp-report.pdf` 里一模一样），与本轮黄/灰底色无关，未在本轮改动。

## 四、8090 什么时候生效

`http://127.0.0.1:8090` 跑的是 `backend/target/yinjia-mes-backend-0.1.0.jar`，**jar 里的 class 与
资源都不是最新源码** ⇒ 本轮改动**只在本机源码 + 离线冒烟里生效**，8090 上要等 Lead 统一重打包
（`mvn package` 或 `jar uf` 覆盖 `BOOT-INF/classes`）后重启才会变。

- 本次**没有**重启 8090、**没有**碰运行中的 jar、**没有**重新打包（按任务口径留给 Lead 统一换包）；
- 只改后端 class/资源、没动 `static` ⇒ 重打包时用 `jar uf ... BOOT-INF/classes`（**排除 `static`**）
  即可，前端界面不会因此变化；
- 换包后复验路径：`tools/archive/_probe-first-insp-report.mjs <base>`（真接口 `/report/templates`
  + `/report/export`，断言纸面要素）＋ 导一张已审核的首件检验单 PDF 看黄格。

## 五、复跑 / 回滚

- 复跑冒烟：见 §3.2 两条命令；产物覆盖本目录同名文件；
- 回滚点：`QcFirstInspReportSupport` 的 `sampleRowsOf/isCheckColumn` 改回按分组 + 去掉两样式
  （`cellY/smallG`）即回到第九轮前的版本；契约里也留了回滚说明（`首件检验单-可填范围.md` §五）。

## 六、遗留风险 / 口径决定（请 Lead 过一眼）

1. **JDK 陷阱（最容易误判）**：本机会话 `JAVA_HOME=C:\Users\vigna\.jdks\openjdk-23.0.1`，而 pom
   要求 `release 25` ⇒ 直接 `mvn compile` 在**有文件要重编时**才报错（`不支持发行版本 25`）。
   源码已是最新时它会"假装通过"（增量编译没调 javac）——**验收务必钉 JDK 25 再跑**，
   否则会拿到假绿。
2. **不可填格上的历史值**：报表按纸面写 `/`（任务口径「其余格 = `/`」、第六/七轮同做法）；
   数据不删 —— 库里原样、面板只读显示。若用户希望"老单据已填的值也打到纸上"，改
   `Builder.build()` 一处即可（当前**不打印**）。
3. **与前端逐字同源**：本类判定顺序与 `firstInspCols.sampleRowsOf` 已逐条对齐（含"勾选式两列先判"）；
   若前端后续调整顺序/词表，**必须同步本类**（反之亦然）。规则清单两处注释里都写死了。
4. **表头分组灰仍是 `#E0E0E0`**（纸面分组灰为 `#D9D9D9`）：本轮口径只要求"标准行表观/脱粉两格"改灰，
   未改表头，避免超出任务范围；要完全照纸面再改一行样式即可。
5. **列数上限**：冒烟覆盖面板默认 10 列；面板支持「＋新增列」，列变多时列宽仍等分、
   行数固定 8 行、页面高度不变 ⇒ 页数不会因加列而涨，但单列过窄时标准行会折更多行
   （已有按列宽估行高的逻辑，属既有行为）。
6. **xlsx 的合并/空行是 JR 导出器既有行为**（本次只加样式，不改版式）；xlsx 只作"导出成功 + 占位格
   数量"复核，纸面观感以 PDF 为准。
