# _print-layout-20261105 — 领料单版面回归(空行/二维码大小/分页)

用户 2026-11-05 口径(附一张打歪的 PDF):

> 「生产领料单打印有问题,明细只有 3 行,却给了多行的数据,并且二维码过大。
>   而且打印行数,会有限制吗?如果大于 9 行,还能打印吗」

## 一、三个问题与改法(全在打印代理端 `print-agent.ps1`,不动服务器 jar)

| 问题 | 根因 | 改法 |
|---|---|---|
| 只有 3 行明细却像有 8 行 | 纸表固定补到 8 行,且**空行也印订单号** `GD-…-#1` | 空行 `$vals = @('',…)`,只有真有数据的行才写订单号/材料 |
| 二维码过大 | `$qrSize = 132`(占整张中一刀近 1/6) | 132 → **96**(≈24mm);`领料部门/日期` 随之上移(166→134),表格起点 200→166 |
| 行数会不会有限制 | `<#13> if ($rowCount -gt 12) { $rowCount = 12 }` —— **第 13 行起被静默丢弃** | 一页 `PER_PAGE=10`,超出**自动续页**(`$e.HasMorePages`),每页重画抬头/表格线/签名,右上角标「第 n/N 页」,**无上限** |

## 二、验收(真代理链路:另起 18778 端口、`-Mode Pdf`、`-Server` 指向本机 8090)

| 用例 | 载荷 | 结果 |
|---|---|---|
| 3 行单据 | `明细` 3 行 | **1 页**;只有 3 行印订单号,其余 5 行空格子 —— `pdf-3rows.png` |
| 13 行单据 | `明细` 13 行 | **2 页**(`/Type/Page x2`)、13 行全在;第 2 页 3 行数据 + 5 行空格子,右上角「第 2/2 页」 —— `pdf-13rows-p1.png` / `pdf-13rows-p2.png` |

产出文件(本机):
- `deploy/print-agent/print-out/GD-LAYOUT-3_L1_20261105-105240-732.pdf`
- `deploy/print-agent/print-out/GD-LAYOUT-13_L1_20261105-105251-778.pdf`

> 截图是本轮用 ego 浏览器打开 PDF(Chrome PDFium)后截的;`round-41~43.mjs` 为本目录脚本。

## 三、两份代理文件要保持一致

`tools/printing/print-agent.ps1`(源)与 `deploy/print-agent/print-agent.ps1`(客户电脑拷走的那份)
内容一致,只有一处差别:**deploy 那份带 UTF-8 BOM**(Windows PowerShell 5.1 读无 BOM 的
UTF-8 会把中文读成 GBK,纸面文字会乱码)。

改完同步命令(仓库根):

```powershell
$src = [System.IO.File]::ReadAllBytes("tools\printing\print-agent.ps1")
$bom = [byte[]](0xEF,0xBB,0xBF)
[System.IO.File]::WriteAllBytes("deploy\print-agent\print-agent.ps1", $bom + $src)
```

## 四、现场怎么生效

版式在**代理端**,换完 `print-agent.ps1` 要让代理重启(PowerShell 是启动时读脚本)。
服务器 jar 不用换,数据库也不用动。
