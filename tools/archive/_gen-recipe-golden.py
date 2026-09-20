# -*- coding: utf-8 -*-
"""
_gen-recipe-golden.py — 生成配方计算引擎的黄金向量(一次性任务产物,2026-09-20)

用途:前端把《炭棒工艺配方设计器》exe 的配方计算引擎搬成 JS 纯模块
(`frontend/src/core/mold/recipeEngine.js`),验收标准是**与 exe 逐位一致**。
本脚本直接从 exe 里取出真引擎跑测试用例,把输入与期望输出固化成 fixture,
供 `frontend/src/core/mold/recipeEngine.test.js` 逐位比对。

取真引擎的做法(PyInstaller 归档 → PYZ → app.domain.engine):
  exe 的 CArchive 尾部有 MEI cookie;PYZ.pyz 里的 Python 模块可用 PyInstaller 自带的
  CArchiveReader 直接取出代码对象,不需要反编译 —— 取出即**可执行**,所以本脚本
  拿到的期望值是真引擎算的,不是照文档推的。

复现(需要 Python 3.10,python 3.13 读不了 3.10 的 marshal):
  uv run --python 3.10 --with pyinstaller python tools/archive/_gen-recipe-golden.py

⚠ 别用 Python ≥3.12 生成:`sum()` 从 3.12 起对 float 改用补偿求和(Neumaier),
  与 3.10 的朴素左到右累加会差最后一两个 ulp,而前端引擎按 3.10 的次序写的、验收口径是逐位一致。

⚠ calc_history 里 1~19 号记录的 result_json 是**旧构建**写的(exe 在 2026-09-17 17:19 前后重编过):
  它们的 params 回显是老单键 `length_tol`,20~24 号才是当前构建的 `length_tol_low/high`。
  经逐字段核对,两版**数值口径完全一致,只有这个回显键名不同** —— 故前端测试对历史记录先做键名归一化
  (见 recipeEngine.test.js 的 assertSameAsStored),不是让实现去迁就旧键名。

产出:
  frontend/src/core/mold/__fixtures__/recipeHistory.json  — 24 条 calc_history 真实记录
  frontend/src/core/mold/__fixtures__/recipeGolden.json   — 边界 + 随机组合
"""
import json
import os
import random
import sqlite3
import sys
import tempfile
import marshal
import importlib.util

EXE = r"C:\Users\x1787\OneDrive\Desktop\产品开发\产品开发\计算器\炭棒工艺配方设计器\炭棒工艺配方设计器\炭棒工艺配方设计器.exe"
DB = r"C:\Users\x1787\OneDrive\Desktop\产品开发\产品开发\计算器\炭棒工艺配方设计器\炭棒工艺配方设计器\data\app.db"
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..",
                       "frontend", "src", "core", "mold", "__fixtures__")

POWDER_SLOTS = [0, 1, 2, 3, 4]
GLUE_SLOTS = [5, 6]
CONVERTED_SLOTS = [7, 8, 9]


def load_engine():
    """从 exe 归档里取出 app.domain.engine,落成可导入的 pyc 树后 import 之。"""
    from PyInstaller.archive.readers import CArchiveReader

    reader = CArchiveReader(EXE)
    pyz = reader.open_embedded_archive("PYZ.pyz")
    root = tempfile.mkdtemp(prefix="recipe_engine_")
    packages = {"app", "app.domain"}
    for mod in ("app", "app.domain", "app.domain.constants", "app.domain.engine"):
        code = pyz.extract(mod)
        rel = mod.replace(".", os.sep)
        if mod in packages:
            d = os.path.join(root, rel)
            os.makedirs(d, exist_ok=True)
            path = os.path.join(d, "__init__.pyc")
        else:
            d = os.path.dirname(os.path.join(root, rel))
            os.makedirs(d, exist_ok=True)
            path = os.path.join(root, rel + ".pyc")
        with open(path, "wb") as f:
            f.write(importlib.util.MAGIC_NUMBER + b"\0" * 12 + marshal.dumps(code))
    sys.path.insert(0, root)
    from app.domain.engine import compute
    from app.domain import constants
    return compute, constants


def slot(code=None, ratio=None, amount=None, moisture=None):
    """照 exe 前端的 payload 形状造一个料位(design_ratio 是小数,不是百分数)。"""
    item = {}
    if code is not None:
        item["code"] = code
    if ratio is not None:
        item["design_ratio"] = ratio
    if amount is not None:
        item["amount_g"] = amount
    item["moisture"] = moisture
    return item


def base_params(**over):
    p = {
        "od": 45.0, "id": 30.0, "length": 200.0, "cavities": 1,
        "density_low": 1.2, "density_high": 1.4, "conversion_ratio": 0.5,
        "length_tol_low": 2.5, "length_tol_high": 2.5,
        "demold_low_factor": 1.0, "demold_high_factor": 1.0,
    }
    p.update(over)
    return p


def recipe_5plus2plus3(powder=(0.62, 0, 0, 0, 0), glue=(0.33, 0.05), conv=(0, 0, 0),
                       moist=(0.06, 0.06, 0.06, 0.06, 0.06), conv_moist=0.08):
    r = []
    for i in range(5):
        r.append(slot("P%d" % (i + 1), ratio=powder[i], moisture=moist[i]))
    for i in range(2):
        r.append(slot("G%d" % (i + 1), ratio=glue[i], moisture=None))
    for i in range(3):
        r.append(slot("C%d" % (i + 1), amount=conv[i], moisture=conv_moist))
    return r


def boundary_cases():
    cases = []

    def add(name, params, recipe):
        cases.append({"name": name, "params": params, "recipe": recipe})

    # 维度: 腔数 / 长度
    add("腔数1·长度0(料头仍算出13mm)", base_params(length=0), recipe_5plus2plus3())
    add("腔数4·长度150", base_params(length=150, cavities=4), recipe_5plus2plus3())
    # 密度: 相等 / 倒挂
    add("密度上下限相等", base_params(density_low=0.59, density_high=0.59), recipe_5plus2plus3())
    add("密度下限大于上限(应告警)", base_params(density_low=0.9, density_high=0.5), recipe_5plus2plus3())
    # 折算比: 0 / 1 / 越界
    add("折算比0", base_params(conversion_ratio=0), recipe_5plus2plus3(conv=(2, 1, 0.5)))
    add("折算比1", base_params(conversion_ratio=1), recipe_5plus2plus3(conv=(2, 1, 0.5)))
    add("折算比1.5(应告警)", base_params(conversion_ratio=1.5), recipe_5plus2plus3(conv=(2, 1, 0.5)))
    add("折算比-0.1(应告警)", base_params(conversion_ratio=-0.1), recipe_5plus2plus3(conv=(2, 1, 0.5)))
    # 含水率: None / '' / 0 / 极端
    add("粉料含水率全缺(应逐位告警)", base_params(),
        recipe_5plus2plus3(moist=(None, None, None, None, None)))
    add("粉料含水率空串(应逐位告警)", base_params(),
        recipe_5plus2plus3(moist=("", "", "", "", "")))
    add("粉料含水率0(不告警)", base_params(), recipe_5plus2plus3(moist=(0, 0, 0, 0, 0)))
    add("粉料含水率0.9(分母0.1)", base_params(), recipe_5plus2plus3(moist=(0.9, 0.9, 0.9, 0.9, 0.9)))
    # 配平
    add("1~7位合计0.80(应告警)", base_params(), recipe_5plus2plus3(powder=(0.5, 0, 0, 0, 0), glue=(0.3, 0)))
    add("折算料过量致料位1为负(应告警)", base_params(cavities=2, conversion_ratio=0.5),
        recipe_5plus2plus3(powder=(0.5, 0.1, 0.1, 0.1, 0.1), glue=(0.05, 0.05), conv=(30, 30, 30)))
    # 空配方 → total=0 的除零护栏
    add("空配方(全0,不得产生NaN)", base_params(),
        [slot(None, moisture=None) for _ in range(10)])
    add("只有折算料(粉胶比例全0)", base_params(),
        recipe_5plus2plus3(powder=(0, 0, 0, 0, 0), glue=(0, 0), conv=(1, 1, 1)))
    # 公差与漂移
    add("老键 length_tol 单值兜底", {k: v for k, v in base_params().items()
                                     if k not in ("length_tol_low", "length_tol_high")}
        | {"length_tol": 2.5}, recipe_5plus2plus3())
    add("非对称公差1.2/3.4", base_params(length_tol_low=1.2, length_tol_high=3.4), recipe_5plus2plus3())
    add("公差0(三值相同)", base_params(length_tol_low=0, length_tol_high=0), recipe_5plus2plus3())
    add("漂移系数0.995/1.005", base_params(demold_low_factor=0.995, demold_high_factor=1.005),
        recipe_5plus2plus3())
    add("漂移系数0/0(实际水分=1)", base_params(demold_low_factor=0, demold_high_factor=0),
        recipe_5plus2plus3())
    add("漂移系数缺省键", {k: v for k, v in base_params().items()
                           if k not in ("demold_low_factor", "demold_high_factor")},
        recipe_5plus2plus3())
    # 料位字段缺键
    add("料位缺 design_ratio/amount_g 键", base_params(),
        [slot(None, moisture=0.05) for _ in range(10)])
    add("折算料 amount_g 为 None", base_params(),
        recipe_5plus2plus3(conv=(None, 1.5, 0)))
    # 大尺寸/大腔数
    add("大尺寸腔数2(59.5/39.5x120)", base_params(od=59.5, id=39.5, length=120, cavities=2,
                                                 density_low=0.58, density_high=0.6),
        recipe_5plus2plus3(powder=(0.62, 0, 0, 0, 0), glue=(0.33, 0.05), conv=(0, 0, 0),
                           moist=(0.06, 0.06, 0.06, 0.06, 0.06)))
    return cases


def random_cases(count=60, seed=20260920):
    """定种子随机:dialog 里可能出现的任意组合,含越界与缺键。"""
    rng = random.Random(seed)
    cases = []
    for n in range(count):
        od = round(rng.uniform(12, 110), 1)
        idv = round(rng.uniform(5, od * 0.9), 1)
        params = {
            "od": od, "id": idv,
            "length": round(rng.uniform(0, 300), 1),
            "cavities": rng.choice([1, 1, 2, 2, 3, 4]),
            "density_low": round(rng.uniform(0.4, 1.6), 3),
            "density_high": round(rng.uniform(0.4, 1.6), 3),
            "conversion_ratio": rng.choice([0, 0.3, 0.5, 0.65, 0.8, 1, 1.2]),
            "length_tol_low": round(rng.uniform(0, 5), 2),
            "length_tol_high": round(rng.uniform(0, 5), 2),
            "demold_low_factor": round(rng.uniform(0.9, 1.1), 4),
            "demold_high_factor": round(rng.uniform(0.9, 1.1), 4),
        }
        # 一半用例让粉/胶比例合计恰好 1,另一半故意不配平
        if n % 2 == 0:
            powder = [0.0] * 5
            powder[0] = round(rng.uniform(0.3, 0.8), 4)
            rest = 1.0 - powder[0]
            glue = [round(rest * rng.uniform(0.6, 0.9), 4)]
            glue.append(round(rest - glue[0], 4))
        else:
            powder = [round(rng.uniform(0, 0.5), 4) for _ in range(5)]
            glue = [round(rng.uniform(0, 0.5), 4) for _ in range(2)]
        moist = [rng.choice([None, "", 0, 0.02, 0.05, 0.08, 0.12, 0.3]) for _ in range(5)]
        conv = [rng.choice([None, 0, round(rng.uniform(0, 20), 3)]) for _ in range(3)]
        recipe = recipe_5plus2plus3(powder=powder, glue=glue, conv=conv, moist=moist,
                                    conv_moist=rng.choice([None, 0.05, 0.08]))
        cases.append({"name": "随机#%02d" % (n + 1), "params": params, "recipe": recipe})
    return cases


def history_cases():
    """app.db calc_history 的 24 条真实记录(用户当年用 exe 算过的)。"""
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    out = []
    for row in con.execute("select * from calc_history order by id"):
        out.append({
            "name": "历史#%s %s" % (row["id"], row["spec"] or ""),
            "id": row["id"],
            "version": row["version"],
            "params": json.loads(row["params_json"]),
            "recipe": json.loads(row["recipe_json"]),
            "result": json.loads(row["result_json"]),
        })
    con.close()
    return out


def main():
    compute, constants = load_engine()
    print("引擎常量:", {k: getattr(constants, k) for k in
                    ("ENGINE_VERSION", "PI", "VOLUME_DIVISOR", "BLANK_LENGTH_BASE",
                     "BLANK_LENGTH_PER_CAVITY", "DEFAULT_LENGTH_TOL")})

    out_dir = os.path.abspath(OUT_DIR)
    os.makedirs(out_dir, exist_ok=True)

    history = history_cases()
    with open(os.path.join(out_dir, "recipeHistory.json"), "w", encoding="utf-8") as f:
        # 紧凑写:golden/history 都是机器比对的数字化数据,逐数字换行会让文件大三倍
        json.dump(history, f, ensure_ascii=False, separators=(",", ":"))
    print("recipeHistory.json: %d 条真实记录" % len(history))

    golden = []
    for case in boundary_cases() + random_cases():
        result = compute(case["params"], case["recipe"])
        golden.append({"name": case["name"], "params": case["params"],
                       "recipe": case["recipe"], "result": result})
    with open(os.path.join(out_dir, "recipeGolden.json"), "w", encoding="utf-8") as f:
        json.dump(golden, f, ensure_ascii=False, separators=(",", ":"))
    print("recipeGolden.json: %d 条用例" % len(golden))

    warned = sum(1 for g in golden if g["result"]["warnings"])
    print("其中带告警 %d 条,覆盖告警文案:" % warned)
    for warning in sorted({w for g in golden for w in g["result"]["warnings"]}):
        print("   -", warning)


if __name__ == "__main__":
    main()
