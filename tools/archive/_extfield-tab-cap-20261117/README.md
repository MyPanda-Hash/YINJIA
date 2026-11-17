# 自定义列上限口径修复(分页签面板按「每张表各 20」判)—— 2026-11-17

## 1. 用户报障(截图)

「来料检验要求(系列)」面板 →「自定义字段」→ 填父目录/子目录 → 点「添加」,页面顶部报:

> 该面板自定义列已达上限(28/20)，无法继续新增；如需更多请先停用不用的列。

而对话框里每张表的用量明明是 `0/20 ~ 14/20`,**没有一张表满**。

## 2. 根因

`PanelConfigService.addExtField` 的上限判据:

```java
int cap  = extFieldCapOf(panelCode);   // 未登记的面板一律 = EXT_SPARE_COUNT = 20
int used = extFieldUsedOf(panelCode);  // SELECT COUNT(*) ... WHERE panel_code=? AND col_name LIKE '备用%'
if (used >= cap) throw ...
```

这句是 2026-11-11 给「8 张数据记录表最多 8 列」加的(`dbf7fedc9`),用的是**面板级总数**。
但两个来料检验要求面板(`QC_INSP_REQ` / `QC_INSP_REQ_SERIES`)是**分页签面板**:
一张宽表的 `备用1..备用200` 被切成**每张表各 20 位**(`extTabRangeOf`:第 i 个页签 =
`备用[(i-1)*20+1 .. i*20]`,见 `docs/design/动态字段扩展-备用列池-V1.0.md` §3.2)。

于是系列面板累计 28 列(10 张表分摊)就被当成「面板满 20」⇒ 整面板加不了列,
而分配器(下面那段 `for (int i = poolFrom; i <= poolTo; ...)`)其实还有大量空闲位。

| 账套 | 累计 | 阻垢系列 | BK材料系列 | 炭粉 | 矿化料 | 旧判据 |
|---|---|---|---|---|---|---|
| HSDZ_MES(正式) | 30 | 12/20 | 0/20 | 4/20 | 14/20 | 30 ≥ 20 ⇒ **拒绝** |
| HSDZ_MES_TEST(测试) | 32 | 14/20 | 0/20 | 4/20 | 14/20 | 32 ≥ 20 ⇒ **拒绝** |

## 3. 修法

- 后端 `addExtField`:**分页签面板按「该页签那一段」判上限**(新增 `tabUsedOf(panelCode, tab)`,
  与分配器同一口径),非分页签面板保持原判据(8 张数据记录表 8 列不变)。
  连条数也并成一条 SQL(原 `extFieldOverview` 是逐列 20 次查询,`extLabelOf` 已随之删除)。
- 后端 `extFieldOverview.tabPools` 改用同一个 `tabUsedOf`(用量数字与闸门同源)。
- 前端 `FieldManagerDialog.vue`:分页签面板加两条看得懂的提示并据此禁用「添加」——
  ① 本表已满(20/20);② 本表只剩 1 个位置(父目录 + 两个子目录一次要占 2 位,避免加了一半才失败)。
  新增文案已进 `frontend/src/i18n/locales/en.js`。
- 文档:`docs/design/动态字段扩展-备用列池-V1.0.md` §3.2 补「上限口径」+ §14 决策记录新增一行。

## 4. 验证(全部可复跑)

### 4.1 接口回归(两账套)

```powershell
node tools/archive/_extfield-tab-cap-20261117/_verify-extfield-tab-cap.mjs
```

`[RESULT] PASS`。要点:

- 两账套都断言「各表用量之和 = 动态字段总数」,且「累计数已超过面板级 20」——正是原判据误伤的形态;
- 测试库在仍有空位的表(本次 BK材料系列 0/20)真实加一列 ⇒ `200 success col=备用21`,
  用量 `0 → 1`(**旧判据在这一步报「已达上限(32/20)」**);
- 结尾退绑复原,并把绑定顺带登记进「检验项」标准库(`qc.insp_item`)的那条验证条目彻底删掉 ⇒ 可反复跑。

### 4.2 界面(ego 浏览器,5173 源码版 + 8090 新 jar 后端;账套 = 测试库)

| round | 场景 | 结果 |
|---|---|---|
| round-06 | 打开「自定义字段」 | 本表已用 14/20;10 个页签用量逐条正确;无告警;「添加」因表单为空禁用 |
| round-07 | 填父目录 + 两个子目录 → 添加 | `字段已添加:备用15、备用16`,**14/20 → 16/20**,列表出现两行(旧版此处弹「已达上限」) |
| round-09 | 本表 19/20 | 黄条「本表只剩 1 个自定义列位置:父目录 + 两个子目录一次要占 2 个位置…」+「添加」禁用 |
| round-11 | 本表 20/20 | 黄条「本表自定义列已达上限（20/20），如需再加请先停用这张表不用的列」+「添加」禁用 |

证据:`ego/round-*.mjs`(脚本)+ `ego/round-*-*.png`(截图)。截图里的会话是**测试库**;
正式库一个字段都没动(验证前后 `HSDZ_MES` 的 `QC_INSP_REQ_SERIES` 动态字段都是 30 条)。

> 界面脚本的坑:同 URL 的 `page.goto` 在 SPA 里是 no-op,上一轮留下的对话框会保持旧数据
> —— round-11 因此先 `page.reload()` 再点「自定义字段」。

### 4.3 构建

- `npm run build` + `mvn -q -DskipTests clean package` 通过(rebuild-prod.ps1 全流程);
  产物已含新前端(`PanelxList-*.js` 里能搜到「本表自定义列已达上限」);
- `frontend: npm test` 1981 项全绿。

## 5. 测试库清场记录

验证过程中在**测试库**临时加过列,已按下面的路径清干净(正式库零写入):

- `_fill-tab-20261117.mjs fill/retire` —— 给「阻垢系列」临时填到 19/20、20/20 做界面取证,再全部退绑;
- `_cleanup-test-20261117.mjs` —— 退绑验证列 + 彻底删 `qc.insp_item` 里的验证条目;
- 手工 SQL(仅 `HSDZ_MES_TEST`):删 `yj_translation` 里 `验证*` 的 en 行。

清完复核:测试库动态字段回到 32 条、阻垢系列 14/20、标准库无 `验证` 残留。
⚠ 期间误删过测试库里 `验证数据` 的 en/ja 两行译名(那是既有数据,不是本任务的),已按正式库原文
(`Verification Data` / `検証データ`,source=manual)补回。

## 6. 遗留/无关项

- 本次 `start-prod` 的增量同步报 `migrate-qc-proc-insp-batch-table-20261111.sql` 自检失败
  (`出货检验功能记录表(批次矩阵)迁移自检失败`),与本任务无关,未处理。
- 重打 jar 时工作区是干净的;之后**别的任务**在同一工作区改起了 `PushGenerateHandler` /
  `ButtonService` / `QueryService` / `deploy/sync.mjs` 与若干前端文件(时间戳 9:41 之后)。
  本次打包是 9:32:24(`app.jar` SHA256 `42B07C0C…`),所以这些 WIP **没有**进 jar/static,
  8090 跑的就是本任务的产物;它们也未包含在本任务的提交里。
