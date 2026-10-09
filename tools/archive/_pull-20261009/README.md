# 2026-10-09 拉取云端仓库(origin/main)取证留档

> 本次任务:把本地 main(领先 12 提交)**与远端 main(领先 196 提交)合并**,并让代码与两账套数据库同步。
> 结论:**已合并并同步完成**;过程中的冲突判定、体检结论、遗留债务与未做项全部记在这里。

## 一、为什么一开始拉不动(环境)

| 现象 | 原因 | 处置 |
|---|---|---|
| `git fetch` 报 `Failed to connect to github.com:443 over proxy 127.0.0.1:...` | git 配了 `http.proxy/https.proxy = http://127.0.0.1:7890`,而**该代理没在跑**(本机无任何代理端口在听) | 绕过代理 |
| 去掉代理后报 `schannel: AcquireCredentialsHandle failed: SEC_E_NO_CREDENTIALS` | 本机 **Schannel 损坏**(与 `tools/SqlRunner.java` 头注里「绕过本机损坏的 Schannel」同源) | 换 TLS 后端:`git -c http.sslBackend=openssl` 直连 GitHub **成功** |

最终可用命令(不改全局配置,一次性覆盖):

```powershell
git -c http.sslBackend=openssl -c http.proxy= -c https.proxy= fetch origin
git -c http.sslBackend=openssl -c http.proxy= -c https.proxy= pull
```

## 二、合并规模与冲突判定(60 处冲突)

- 安全备份分支:**`backup-pre-pull-20261009`**(合并前 HEAD)。
- 干跑预判用 `git merge-tree --write-tree --name-only main origin/main`(不动工作区即知冲突文件)。
- 合并提交:`7bd7020c`。

| 冲突文件 | 判定(不是取一边,而是按口径合成) |
|---|---|
| `ButtonService.java` | 保留远端新增 `ProcessTaskService`(工序任务);按本地下架口径去掉 `QcDisposalService`(不良品处理单已随 5 面板下架删除) |
| `OrderConvertService.java` | 取远端 2026-10-06 的 `PENDING_FROM/PENDING_DATE_RANGE/PENDING_KEYWORD` 抽取与新增「工艺路线」列;同时按本地下架口径**彻底**移除 PU_REQ 占用通道 —— 本地 `b3267134` 当时只删了 `OUTER APPLY`、漏删 SELECT 里的 `p.linked`,**导致订单结转页 500**(8090 实测:`无法绑定由多个部分组成的标识符 "p.linked"`),本次一并修掉;`已采购数量` 列无人消费(frontend 仅 `en.js` 有词条)故随通道删除 |
| `frontend/src/business/menus.js` | 制程品质组**保留远端新增的三张工序检验单**(成型/切炭/组装成品检验单),去掉本地下架的 工序质检单/检验记录单;不良处理、品质追溯两组整组去掉 |
| `tools/db-migrations.txt` | **并集**(两侧都从 v2.6 往后追加):远端 13 条 + 本地 6 条。四单三条保持 `bloodline-cols → missing-cols → baseline-restore` 硬顺序;并特意把 `migrate-wh-kingdee-only` 排在 whloc 建仓**之前** —— 它自检①是「启用中非金蝶来源仓 = 0」的**全局**判定,排反会在 whloc 新建 `CK-A/CK-C/CK-D` 后 RAISERROR。合并脚本 `_merge-migrations.cjs` |
| `tools/db-inuse-tables.txt` | 按 base↔两侧**集合运算**(远端 225 − 本地下架 17 + 本地新增 0 = **208**),分组标题与合计行重算。脚本 `_merge-inuse-tables.cjs` |
| `docs/development/数据库表清单.md` | 覆盖范围按「远端 225 表 + 106 视图 为本底 − 本地 17 表 + 9 视图」重算为 **208 / 97**;删掉已下架的 `bd_pu_req`/`bl_pu_req` 行、保留远端补登的 `bd_pu_label`/`bl_pu_label`;维护记录保留远端 v2.7~v3.6,本地两条 10-09 条目**改号为 v3.7/v3.8**(版本号原本撞车)。脚本 `_merge-catalog-history.cjs` |
| `static/**`(50 处 rename/rename、modify/delete) | 全是构建产物:先取远端版,再 `npm run build` 按**合并源码**重建、`robocopy /MIR` 镜像回去(入口 chunk `index-CT8aBh-0.js` 与 dist 一致) |

## 三、代码验证

| 项 | 结果 |
|---|---|
| `mvn -DskipTests compile` | ✅ 通过(`OrderConvertService.class` / `ButtonService.class` 均已重编) |
| `npm run build`(vite) | ✅ 通过,`dist` 97 个 asset |
| `mvn package` | **未跑** —— 8090 正跑着 `target\yinjia-mes-backend-0.1.0.jar`,重打包会重命名占用中的 jar、留下**瘦 jar**(见 `build-appjar.ps1` 头注)。详见第五节「未做项」 |

## 四、数据库同步与体检(两账套)

```
HSDZ_MES       执行 50 / 跳过 385 / 失败 0   → 复跑 执行 0 / 跳过 435 / 失败 0
HSDZ_MES_TEST  执行 52 / 跳过 383 / 失败 0   → 复跑 执行 0 / 跳过 435 / 失败 0
```

过程中修掉一处**必炸**:

- `migrate-qc-tc-via-return.sql` 因合并字节变化被 DbSync 判为「有变化」重跑,而它 2026-10-05 那版写死 `d.[数量]`,
  该列已被远端 `migrate-fourdoc-missing-cols-20261008.sql` 依基线 `sp_rename` 成 `[退货数量]` ⇒ 报「列名 '数量' 无效」卡住整链。
  已按远端迁移清单里的告示改成**血统二择一**(`COL_LENGTH` 取现存列 + `sp_executesql`),提交 `42d76dc3`。

**四单回归闸(AGENTS §1 新规)**——`verify\FourDocAudit.java`,两账套均 `[PASS]`:

| 面板 | 现役/基线 | 多出 | 缺失 | 内容变 | 名次不符 |
|---|---|---|---|---|---|
| QC_RECV | 70 / 70 | 0 | 0 | 0 | 0 |
| QC_INSP | 54 / 54 | 0 | 0 | 0 | 0 |
| QC_RETURN | 34 / 34 | 0 | 0 | 0 | 0 |
| PURCHASE_IN | 171 / 171 | 0 | 0 | 0 | 0 |

越界污染(非供应商语义却指 GFDA)= 0;物理列对账:文档认定列缺失 0。

**数据库规范体检**——`verify\DbNormAudit.java`,两账套**逐项一致**,`FAIL 4 / WARN 1`:

| # | 项 | 结果 | 判定 |
|---|---|---|---|
| 05 | 元数据漂移(字段不在其所在对象里) | **PASS** | 本次修掉(见下) |
| 12 | 迁移链清单 ↔ 文件一致(清单 436 / 文件 450) | PASS | 并集没截断 |
| 03 | 拼音/英文列名的列注明(3 列) | FAIL | 存量债(本地 10-03 档也是 3 列:bl_pu_order.kf_period / bs_inv.parent_name / bs_inv.is_show_aux_barcode) |
| 04 | 业务表主键与审计四件套(38 处) | FAIL | 存量债(本地 10-03 是 49 处,已降) |
| 07 | 完全重复的字段登记行(6 处,PURCHASE_IN.*编码类) | FAIL | 与远端一致(远端档同为 6 处) |
| 09 | 缺 en 译名(218) | FAIL | 棘轮只许降:本地 10-03 = 243、远端 = 297,现 218(已降) |
| 08 | 同一列多标签(48) | WARN | 已登记 87 组白名单 |

**本次修掉的体检项(提交 `92f1e960`)**:05 由 81 处 → 0。
明细全是本地下架过的 10 个面板码(`OTHER_IN_DETAIL`/`OTHER_IN_STATS`/`OTHER_OUT`/`OTHER_OUT_DETAIL`/`OTHER_OUT_STATS`/
`OUTSOURCE_IN_DETAIL`/`OUTSOURCE_IN_STATS`/`OUTSOURCE_ISSUE_DETAIL`/`OUTSOURCE_ISSUE_STATS`/`LOT_TRACE`):
这些面板的 `yj_panel` 行、物理表、视图**都已删除**,但 `yj_field` 残留 81 行、`yj_role_panel` 残留 30 行。
成因未完全定位:两批下架脚本当时自检报「残留 0」,而残留行 id 落在旧区间 11845~12032(当前最大 id 12390 之下约 350),
呈「备份 restore 走 IDENTITY_INSERT 回灌」的形态;已排除尾空格/定长列截断(面板码 `varchar(40)`、`LEN = 字节数`,无空格)。
兜底脚本 `tools/migrate-clean-orphan-panel-rows-20261009.sql` 已入链并两账套执行。

## 五、未做项 / 需要你拍板的事

1. **8090 仍跑着合并前的构建**(`java -jar target\yinjia-mes-backend-0.1.0.jar`,jar 时间 2026-10-09 09:30:41,
   进程起于 09:30:50)。因此:
   - 本次合并带进来的前端/后端改动**在 8090 上看不到**(要看就 5173 起 vite,或重新打包);
   - **订单结转页在 8090 上仍是 500**(`p.linked` 绑定失败)—— 修复只在源码里,重启前不生效。
   要生效需:停 8090 → `mvn -DskipTests package`(或 `build-appjar.ps1`) → 起服务。
   **本次按「拉取云端仓库 + DbSync」的既定流程收尾,没有停/重启你的服务**;要不要现在重打包装上,等你一句话。
2. **`yj_panel` 的面板名/英译名存在本地↔远端历史差异**(QC_RETURN 本地 `暂收退回单`/en NULL,远端 `暂收退料单`/en 有值;
   QC_INSP 的 en 本地为 NULL)。这不是本次漂移 —— 远端 `migrate-fourdoc-baseline-restore-20261008.sql:20` 明写
   「不动 yj_panel(面板名『暂收退料单』与 en 名属 yj_panel 历史差异,不是本次漂移)」。所以:
   - 重新生成的《采购链四单字段与显示字段.md》里 QC_RETURN 的标题取自**运行时 dump**(远端那份)= `暂收退料单`,
     而库里 `yj_panel.panel_name` = `暂收退回单` —— 两者不一致是**既有差异**,字段与顺序不受影响(四单闸 12/12 ✅)。
   - 要不要把两边对齐(改 yj_panel 或改文档口径),属独立任务。
3. **`_dump-out/fields-HSDZ_MES.md` 被重新导出**(§8 第①步):diff 里除了面板名/en 差异,主要是**行 id 变了**
   (四单基线回正脚本重建过 yj_field 行,新 id 在 12375+)。这是 §8 流程的正常产物。

## 六、目录内文件

| 文件 | 说明 |
|---|---|
| `_merge-migrations.cjs` | `db-migrations.txt` 冲突块 → 并集(含顺序依据注释) |
| `_merge-inuse-tables.cjs` + `_inuse-{base,local,origin}.txt` | 在册台账集合运算合并(三版快照由 pwsh 预导出,沙箱禁 node 起子进程抓管道) |
| `_merge-catalog-history.cjs` | 表清单「维护记录」版本号撞车解决(本地两条改号 v3.7/v3.8) |
| `_q-*.sql` | 取证:迁移登记状态 / 退料数量列名 / 面板名与译名 / 孤儿字段行(面板码、id 区间、尾空格、跨表引用)/ 今日执行脚本 |
| `_fourdoc-*.post-merge.out` | 两账套四单回归闸输出 |
| `_normaudit-*.post-merge.out` | 两账套数据库规范体检输出 |
