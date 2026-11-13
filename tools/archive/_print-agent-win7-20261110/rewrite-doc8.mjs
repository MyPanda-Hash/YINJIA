#!/usr/bin/env node
// 重写 说明.md 第八节(原版是用 PowerShell 双引号 here-string 追加的,$ 与反引号被吃掉)
import { readFileSync, writeFileSync } from 'node:fs'

const p = 'D:\\YINJIA-main\\deploy\\print-agent\\说明.md'
let t = readFileSync(p, 'utf8').replace(/^\uFEFF/, '')
const i = t.indexOf('## 八、Windows 7')
if (i < 0) throw new Error('找不到第八节')
t = t.slice(0, i) + `## 八、Windows 7 老电脑(2026-11-10 兼容改造)

现场那台 Win7 双击「安装.bat」先后踩了两个坑:

**坑 1(0x1F 输出中断)**:安装.bat 里 \`chcp 65001\` 在 Win7 控制台上会让 \`Write-Host\` 写不进输出缓冲区,
而脚本又是 \`$ErrorActionPreference='Stop'\`,第一行输出就把安装打断(环境检查都没跑完)。

**坑 2(PowerShell 2.0)**:Win7 自带的是 PowerShell 2.0,没有 \`ConvertFrom-Json\` / \`ConvertTo-Json\` /
\`Invoke-WebRequest\`(都是 3.0+ 才有)。原来脚本直接退出「请先装 WMF 5.1」。

**现在两个坑都补了:客户双击「安装.bat」即可,不需要装 WMF、不需要任何额外操作。**

| 改动 | 说明 |
|---|---|
| 去掉 \`chcp 65001\` | 改成 \`chcp 936\`,安装.bat 以 **GBK** 保存(中文/中文文件名在 Win7 正常) |
| \`Write-Host\` → \`Say\` | 先试带颜色输出;写不进控制台就退 \`[Console]::Out\`,再不行只写日志 —— **不会再把安装打断** |
| **PS 2.0 兼容层 \`compat-ps2.ps1\`** | PS<3 时自动加载,补上 JSON 解析/生成与 HTTP 请求;PS 3~5 仍用系统自带命令 |
| \`Get-Printer\` → \`.NET InstalledPrinters\` | Win7/PS2 就有,Win10 同样可用 |
| \`Get-CimInstance\` → \`Get-WmiObject\` / .NET | Win7 原生 WMI,不依赖 CIM 服务 |
| 开 TLS 1.2 | Win7 默认没有 TLS1.2,HTTPS 服务器不加会「连不上」 |
| 安装日志 | 同目录 \`install.log\`(卸载 \`uninstall.log\`,代理 \`agent.log\`),让客户直接发回来 |
| 先体检再安装 | 可跑 \`-DryRun\`:只检查环境/账号/打印机,不写配置、不设自启、不起代理 |

排障顺序(让客户照做):

1. 确认用的是 **2026-11-10 之后**的文件夹,且里面有 \`compat-ps2.ps1\`(整个文件夹一起拷,别只拷一个文件);
2. 先跑体检(DryRun),看 \`install.log\` 最后几行:

\`\`\`bat
powershell -NoProfile -ExecutionPolicy Bypass -File "安装.ps1" -Server http://36.140.66.163:8090 -User admin -Pass 你的密码 -Station 打印机名 -DryRun
\`\`\`

3. 通过后再双击「安装.bat」正常安装(会问服务器地址/账号/打印点);
4. 只有极老系统(连 **.NET 3.5** 都没有)才会提示先装 .NET 3.5 —— Win7 默认自带,一般遇不到;
5. 仍失败就把 \`install.log\` 整段发回来 —— 现在所有输出都落这个文件,不用再靠截图。
`
writeFileSync(p, '\uFEFF' + t, 'utf8')
console.log('[ok] 说明.md 第八节已重写')
