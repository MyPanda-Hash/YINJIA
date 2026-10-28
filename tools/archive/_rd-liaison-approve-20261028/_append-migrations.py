import io, sys

P = r"C:\INCER\YINJIA-MES\tools\db-migrations.txt"
ADD = [
    "",
    "# 2026-10-28 出货检验计划表:去掉「编号」格的固定默认值(用户口径「这个默认的编号去掉，",
    "#   只保留背景提示词：请填写编号」)。四张受控文件本来都已自动发单号(IP-… 一直在生成),",
    "#   问题只在纸面那一格绑了 文档编号 而库里有 DEFAULT N'YJ-RD001';删约束 + 注销字段后",
    "#   纸面自动落到「单据编号」,与成型工艺清单/组装工艺清单/规格书口径一致。",
    "#   物理列保留,历史值不丢。",
    "migrate-drop-insp-docno-default-20261028.sql",
    "migrate-insp-docno-unregister-20261028.sql",
]

raw = io.open(P, "rb").read()
# 统一按字节追加,行尾用 LF(该文件是混合 EOL 且 .gitattributes 设了 -text,不能改写已有字节)
tail = raw[-1:]
if tail not in (b"\n",):
    raw += b"\n"

for line in ADD:
    raw += line.encode("utf-8") + b"\n"

io.open(P, "wb").write(raw)
print("appended bytes:", len(raw))
