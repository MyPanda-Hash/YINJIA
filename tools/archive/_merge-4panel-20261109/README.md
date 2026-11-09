# _merge-4panel-20261109 —— 拉取远程仓库后「研发 · 实验室使用记录表」四个面板的对照取证

> 用户口径(2026-11-09):「拉取远程仓库的代码到本地,这四个面版与服务器实现有差距,研发完全对照着远程仓库的来。」
> 追问后选择:**「保留这列,把服务器也更新成这版」**。

## 做了什么

1. `git fetch` + `git merge origin/main`:**36 个远端提交**并入本地(本地领先 61 个),冲突 6 处按两侧并集解决
   (迁移清单 / 数据库表清单票号 / PanelxList 的 sheetDetailFields / en.js+zh-TW.js 词条 / android README);
2. `node --test` **1604/1604** 通过,`npm run build` 通过,static 同步 + `mvn package` + 重启 8090;
3. **逐字段比对**服务器(36.140.66.163:8090,正式库)与本机(127.0.0.1:8090)这四个面板的元数据;
4. 组装增量包 `deploy/pkg-incr-20261109c`（5 条迁移 + 新 jar）把服务器更新成这一版。

## 四面板对照结论(接口 `getNewFormPermMatrix`,只读)

| 面板 | 表头 | 明细 | 判读 |
|---|---|---|---|
| 加标水配置记录表 `RD_SPIKE_WATER` | 4 = 4,顺序一致 | 服务器 21 / 本机 22 | 只多「手机照片」(附件,宽 110,行尾) |
| 测试申请单 `RD_DOM_TEST` | 8 = 8,顺序一致 | 26 = 26,顺序一致 | **完全一致** |
| 设备使用登记表 `RD_EQUIP_USE` | 4 = 4,顺序一致 | 服务器 7 / 本机 8 | 同上 |
| 仪器使用记录表 `RD_INSTR_USE` | 4 = 4,顺序一致 | 服务器 9 / 本机 10 | 同上 |

复跑:`node tools/archive/_merge-4panel-20261109/compare-panels.mjs`(读两个 8090,只读登录)。
原始应答落在 `.tmp/panelcmp/<面板>.{srv,loc}.json`(本地临时,未入库)。

## 界面取证(8090 = 合并后 jar 内 static,正式库 YJ)

| 面板 | 截图 | 结果 |
|---|---|---|
| 设备使用登记表 | `ego/RD_EQUIP_USE.png` | 纸面正常,明细最后一列就是「手机照片」 |
| 加标水配置记录表 | `ego/RD_SPIKE_WATER.png` | 纸面正常(列集来自标准库模版,「+ 新增数据记录行」在) |
| 测试申请单 | `ego/RD_DOM_TEST.png` | 三个页签(内部委托 / 销售端 / 委托测试汇总表)都在 |
| 仪器使用记录表 | `ego/RD_INSTR_USE.png` | 纸面正常,含表下说明段 |

复跑:`node …/ego/round-02.mjs`(`ego-browser nodejs -e "await import('file:///…')"`;截图前恢复窗口)。

## 服务器更新

见 `deploy/pkg-incr-20261109c/steps.md`(用户 RDP:`verify-package.ps1` → `deploy-incremental.bat CHECK` → `GO`)。
台账待部署完成后按《部署记录规范》追加。
