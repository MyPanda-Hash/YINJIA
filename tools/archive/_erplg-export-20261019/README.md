# _erplg-export-20261019 — ERP导入日志 → Excel 推云端仓库

用户口径(2026-10-19,三句递进):
1. 「erp导入日志的数据是否有推送到云端」
2. 「推送到云端」
3. 「写成 excel 表格推送到云端就行」

## 结论(先摆事实)

| 位置 | ERPLG 批次 | ERPLG_ROW 明细 |
|---|---|---|
| 云端服务器 `36.140.66.163:8090` | **0**(`IMP-` 关键字亦 0) | **0** |
| 本机 `HSDZ_MES` / `HSDZ_MES_TEST` | 9 | 45 |

数据到云端只有两条路:① 部署(全量恢复备份 / 增量迁移 `deploy/deploy-all.bat` + `DbSync`);② 走仓库外发文件。
代码里**没有把导入日志推出去的通道**:`erp_imp_log` 运行期无写入方,`ERPLG`/`ERPLG_ROW` 是只读面板
(`PanelPermissionService.READONLY_PANELS`),`转ERP`(KingdeePushService)只推业务单据。

⇒ 本轮按用户最终口径走 **②:导出 Excel 放仓库**(`db/erplg-data-20261019/`),不动服务器库。

## 交付

| 件 | 位置 |
|---|---|
| 导出脚本 | `_export-erplg-xlsx.mjs`(现取现写 + 11 项自检) |
| 回读复核 | `_verify-xlsx.mjs`(独立读 xlsx:页签/行数/表头/前几行真实值) |
| Excel | `db/erplg-data-20261019/ERP导入日志-20261019.xlsx`(53.8 KB,4 页签) |
| 摘要 | `db/erplg-data-20261019/_export-summary.json` |
| 说明 | `db/erplg-data-20261019/README.md` |

页签:`ERP导入日志`(9)/ `导入明细`(45)/ `字段说明` / `说明`。

## 口径要点

1. **只导面板可见字段**(`yj_field` 里 `visible` 且未 `hidden`,按 `seq,id` 排序 = 界面顺序)。
2. **`原始JSON` 不导出**:45 段金蝶原始报文含客户/供应商名称与金额,而 `MyPanda-Hash/YINJIA` 是公开仓库
   (2026-10-19 未登录访问 = 200),与 2026-10-18 职员档案「脱敏后推送」同一口径。
   本地要看:`--with-json`(产物带「含原始JSON」后缀,只许放仓库外)。
3. 时间列一律 `CONVERT(varchar(19), .., 120)`,char 列 `RTRIM` —— 与职员导出同一套取数写法
   (避免 JS `Date` 的 UTC 偏移把 17:58 写成 09:58)。

## 踩坑(已写进脚本注释)

**18 位数字 ≠ 身份证号**:金蝶账套实例 ID `580147507460444160` 是 18 位,而且**校验位碰巧能过 GB 11643**,
首跑红线扫描直接误报 9 处。判据改成「18 位 + 出生日期段是真日期(1900..今年)+ 日期合法 + 校验位」四关,
误报才消失 —— 这与 2026-10-18 那次「19 位雪花号被当身份证」是同源坑,别只拿数字长度判。

## 复跑

```powershell
node tools/archive/_erplg-export-20261019/_export-erplg-xlsx.mjs   # 生成 + 自检
node tools/archive/_erplg-export-20261019/_verify-xlsx.mjs         # 独立回读复核
```
