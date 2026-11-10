# 打印代理 · Windows 7 兼容改造(2026-11-10)

现场:客户那台 **Windows 7 旗舰版 SP1 / i5-4590 / 12GB** 双击 `安装.bat`,窗口停在

```
The system cannot write to the specified device.
Write-Host : The Win32 internal error "A device attached to the system is not functioning" 0x1F
             occurred when writing console output buffer at current cursor position.
Press any key to continue . . .
```

## 病根(三条,缺一都会挂)

| # | 问题 | 为什么 Win7 才炸 |
|---|---|---|
| 1 | `安装.bat` 里 `chcp 65001` | Win7 控制台 + UTF-8 代码页下,`Write-Host` 写控制台输出缓冲区会抛 0x1F;脚本又是 `$ErrorActionPreference='Stop'`,第一行输出就把安装打断(环境检查根本没跑) |
| 2 | `Get-Printer` | 属于 PrintManagement 模块,**Windows 8/2012 才有**,Win7 上没有这个命令 |
| 3 | `Get-CimInstance Win32_Printer` / `Win32_Process` | CIM 在 Win7 依赖服务/PS3+,不如 `Get-WmiObject` 稳 |

## 改法(已落到 `deploy/print-agent/`)

1. **输出不再致命**:所有 `Write-Host` → `Say`(带颜色的也走它)。
   `Say` 先试带颜色 `Write-Host`,失败退 `[Console]::Out`,再失败只追加日志 —— 任何情况下都不会中断安装。
   日志:安装 `install.log` / 卸载 `uninstall.log` / 代理 `agent.log`(同目录)。
2. **打印机改用 .NET**:`[System.Drawing.Printing.PrinterSettings]::InstalledPrinters`(PS2/.NET2 就有);
   默认打印机优先 `Get-WmiObject Win32_Printer`(Win7 原生),失败再看 .NET 第一台。
3. **`.bat` 改 GBK + `chcp 936`**:中文与中文文件名在 Win7 正常;`.ps1` 仍是 **UTF-8 with BOM**
   (PS5.1 读脚本的硬要求,见 `说明.md` 第六节)。
4. **TLS 1.2 / 版本闸门**:Win7 默认没有 TLS1.2,安装前显式打开;PowerShell < 3 直接给 WMF 5.1 下载链接。
5. **新增 `-DryRun`**:只体检(环境/账号/打印机),不写配置、不设自启、不起代理 —— 现场排障第一步。

## 验证记录

- 安装脚本 DryRun(本机,真实 8090 登录 + 打印机枚举):

```
[OK] .NET 绘图组件可用(System.Drawing)
[OK] 检测到打印机:Kyocera ECOSYS M8124cidn / AiYin AT341 (direct) / AiYin AT341
[OK] 登录成功(http://127.0.0.1:8090)
[DryRun] 环境与账号检查通过;本次不写配置、不设开机自启、不启动代理。
```

- 代理空跑(`-Port 18799 -Mode Pdf`):`GET /health` → `200 {"ok":true,"printer":"Kyocera ECOSYS M8124cidn(系统默认)","mode":"Pdf"}`。
- 三个脚本语法解析:见 `parse-check.ps1`(`[OK] 安装.ps1 / 卸载.ps1 / print-agent.ps1`)。
- 分发 zip 重新打包后**解压再跑 DryRun** 通过(中文文件名/BOM 均正常)。

## 复跑改造

```bat
node tools/archive/_print-agent-win7-20261110/patch-win7.mjs
```

脚本幂等(已含 `function Say {` 的文件自动跳过)。注意:
- `.bat` 的 `chcp` 是**字节级**替换(原文件 GBK,按 UTF-8 读会把中文变成 `?`);
- `.ps1` 落盘必须是 **UTF-8 BOM**;用其它编辑器改完要检查前 3 字节是 `239,187,191`。

## 客户现场怎么排查

1. 确认用的是 **2026-11-10 之后**的文件夹/zip;
2. 先跑 DryRun(命令见 `说明.md` 第八节),不行就把 `install.log` 发回来;
3. 报 PowerShell 版本低 → 装 WMF 5.1 后重启;
4. 还不行再看 `agent.log`(代理)与 `uninstall.log`(卸载)。
