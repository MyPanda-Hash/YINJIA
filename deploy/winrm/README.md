# 服务器自拉 GitHub 源码部署（WinRM 一键）

> 开发机（macOS / Linux / Windows 均可）只需 `git push`，**服务器自己**从 GitHub 拉源码、
> 本地构建、备份库、换 jar、重启、验证。适用于生产服务器**不对外暴露数据库端口**的情况。

---

## 0. 为什么是这种部署方式

| 限制（实测） | 后果 |
|---|---|
| 服务器只开 **3389 / 8090 / 5985**，`22(SSH)` `445(SMB)` `1433(SQL)` 都不通 | 开发机没法 scp / 挂载上传，也没法直连数据库 |
| WinRM 单条命令有**长度上限** | 不能靠 WinRM 推 90MB 级文件（会报"文件句柄扩展太长"） |
| 服务器**能上 GitHub**（实测 96MB tarball ≈11.6 秒） | 让服务器自己拉，绕开上面两条 |

所以链路是：**开发机 `git push` → 服务器 `curl` 拉 tarball → 服务器本地 `mvn` 构建 → 换 jar**。

---

## 1. 前置

### 1.1 服务器侧
- WinRM 已启用（`winrm quickconfig`），且 **5985 对开发机的出口 IP 放通**（安全组）。
- 服务器已装：`node`（前端构建）、`JDK 25`、`tar`。**Maven 缺失时脚本会自动下载**到 `C:\yj-deploy`。
- 计划任务 `YINJIA-MES` 存在（脚本用它停/起应用）。

### 1.2 开发机侧

```bash
cd deploy/winrm
python3 -m pip install -r requirements.txt      # pywinrm（可选 requests[socks]）
cp config.example.json config.json              # 本地私有，已被 .gitignore
```

口令**两种给法**，推荐环境变量（不落盘）：

```bash
export YJ_SERVER_PASS='<服务器 administrator 口令>'
export YJ_SQL_PASS='<数据库口令>'          # 只有直连 1433 跑 SQL 时才需要
```

> 🔴 **认证方式必须显式指定**：服务器一般没开 NTLM，用默认值会报
> `InvalidCredentialsError: the specified credentials were rejected by the server`。
> 统一加：

```bash
export YJ_WINRM_TRANSPORT=basic     # 明文 HTTP，仅内网/临时；跨公网请改用 5986 + HTTPS
```

---

## 2. 标准流程（三步）

### 第 0 步：本地推代码

```bash
git push origin main
```

### 第 1 步：先只读体检（不动任何东西）

```bash
cd deploy/winrm
python deploy_src.py --check
```

打印服务器现状（现役 jar 哈希 / 库台账行数 / 前端入口 chunk / 构建时间）。
**这一步不改任何东西**，用来确认连得上、且记录"部署前基线"。

### 第 2 步：跑数据库迁移（⚠ 脚本不会自动跑）

`deploy_src.py` 里 `DbSync` 出现次数 = 0，**它不执行任何 SQL**。
凡是本批次新增/改动了 `tools/*.sql`，都必须先单独跑完，否则新代码查不存在的列会 500。

如果开发机能直连 1433：

```bash
cd tools
java -cp lib/mssql-jdbc.jar SqlRunner.java \
  "jdbc:sqlserver://<host>:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true" \
  yinjia "$YJ_SQL_PASS" migrate-xxx.sql
```

**如果 1433 不通（常见）** —— 用 `run_migrations.py`，在服务器本机用 `sqlcmd` 跑：

```bash
cd deploy/winrm
python run_migrations.py --dry-run ../tools/migrate-xxx.sql     # 先只上传校验字节
python run_migrations.py ../tools/migrate-xxx.sql               # 两个账套都跑
```

它会：base64 分块上传 → `sqlcmd -f 65001 -b -i` 逐库执行 → **自动补登 `yj_schema_log`**。

> 三个坑（脚本里已处理，改代码时别看漏）：
> ① WinRM 单命令 **8000 字符就报 `command line is too long`** ⇒ 分块必须 ≤ **1500**；
> ② 迁移脚本是 UTF-8 含中文，sqlcmd 默认按 ANSI 读会报语法错 ⇒ 必须 **`-f 65001`**；
> ③ 不加 **`-b`** 时 SQL 报错 sqlcmd 仍返回 0，会误判成功。

### 第 3 步：部署 jar

```bash
python deploy_src.py --ref <提交sha>      # 推荐写死 sha，不用 main，部署内容可复现
# 只换 jar（不备份库、不跑迁移）：回滚或纯前端修复时用
python deploy_src.py --app-only --ref <提交sha>
```

脚本内部 8 步：

```
0 环境体检 → 1 服务器拉源码 → 2 服务器本地构建 → 3 备份数据库
→ 4 停应用 → 5 归档旧 jar 并换新 → 6 启动并验证登录 → 7 验收（打印三条指纹）
```

结束后会打印：

```
jar    <SHA256>
size   <MB>
ledger <yj_schema_log 行数>
chunk  assets/index-xxxx.js
built  <前端构建时间>
回滚点  C:\yinjia\backup\app-<时间戳>.jar
库备份  C:\yinjia\backup\pre-deploy-<时间戳>.bak
```

---

## 3. 验收

以第 7 步打印的三条指纹为准，与**部署前**（第 1 步）对比：

| 指纹 | 期望 |
|---|---|
| `jar` SHA256 | 变了 |
| `chunk` | 变了（前端有新构建） |
| `ledger` | = 部署前 + 本批迁移条数（只增不减） |
| `built` | 是本次时间 |

再用业务接口抽查（生产 8090）：

```bash
curl -s -X POST http://<host>:8090/api/auth/login \
  -H 'Content-Type: application/json' -d '{"userName":"admin","password":"123456"}'
curl -s http://<host>:8090/api/build -H "Authorization: Bearer <token>"
```

---

## 4. 记账（不可豁免）

每次部署（含只换 jar / 只跑库 / 回滚）都要在
[`deploy/部署台账.md`](../部署台账.md) **追加一行 + 一节**，必填**三条指纹**、
迁移条数与清单、剔除项及理由、验收证据、回滚点。
格式见 `docs/development/部署记录规范.md`。

> 台账是「服务器现在跑到哪一版」的唯一答案；只写"部署完成"不算记录。

---

## 5. 回滚

```powershell
# 库
RESTORE DATABASE [HSDZ_MES] FROM DISK = N'C:\yinjia\backup\pre-deploy-<时间戳>.bak'
  WITH REPLACE, RECOVERY

# jar
schtasks /end /tn "YINJIA-MES"
Copy-Item 'C:\yinjia\backup\app-<时间戳>.jar' 'C:\yinjia\app.jar' -Force
schtasks /run /tn "YINJIA-MES"
```

迁移**不自动回滚**：它们都是幂等增量（只加不删），回滚 jar 后旧代码不看新列，通常无需撤库。

---

## 6. 常见故障

| 现象 | 原因 / 处置 |
|---|---|
| `InvalidCredentialsError` | 用 `YJ_WINRM_TRANSPORT=basic`；或口令错（`%` `@` 等特殊字符要加引号） |
| 连不上 5985 / 超时 | 安全组没放通开发机出口 IP；`telnet <host> 5985` 自测 |
| 代理环境下"连上了但收不到数据" | 代理的 `200 Connection established` 只代表代理自己应答，不代表到得了服务器；**以"能否拿到协议响应"为准** |
| 上传后远端文件 0 字节 | WinRM 单命令超长（把分块降到 1500） |
| sqlcmd 报语法错、中文变 `??` | 缺 `-f 65001` |
| 构建失败 | 看 `deploy_src.py` 打印的日志尾部；多为 `mvn` 下载失败或依赖缺失 |

---

## 7. 文件说明

| 文件 | 作用 |
|---|---|
| `deploy_src.py` | **主入口**：拉源码 → 构建 → 备份 → 换 jar → 起 → 验收（推荐） |
| `deploy_jar.py` | 只换 jar 的老入口（不拉源码、不构建） |
| `server_ops.py` | 服务器运维小工具（探活/日志/重启等） |
| `run_migrations.py` | 经 WinRM 在服务器本机跑迁移脚本 + 补登台账 |
| `winrm_client.py` | WinRM 连接封装（读 config.json + 环境变量覆盖） |
| `config.example.json` | 配置模板；复制成 `config.json`（已 gitignore） |
| `requirements.txt` | Python 依赖 |

> 🔴 **口令绝不入仓库**：`config.json` 已忽略；代码里的默认口令一律留空，
> 靠 `YJ_SERVER_PASS` / `YJ_SQL_PASS` 注入。
