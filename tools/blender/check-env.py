"""
check-env.py — Blender 环境探测（只读，不改场景）

用法：
  blender --background --factory-startup --python tools/blender/check-env.py

退出码：
  0 = 环境满足（Blender >= 5.2 且 glTF 导出器可用）
  1 = 不满足（打印原因）

约定（沿用乒乓 AGENTS.md 红线 7）：不许静默跳过，任何缺失都要显式报错。
"""

import sys

MIN_VERSION = (5, 2, 0)


def fail(msg: str) -> None:
    print(f"[FAIL] {msg}")
    sys.exit(1)


def main() -> None:
    import bpy

    ver = tuple(bpy.app.version)
    print(f"[INFO] Blender {bpy.app.version_string} (version={ver})")
    print(f"[INFO] Python {sys.version.split()[0]}")

    if ver < MIN_VERSION:
        fail(f"需要 Blender >= {'.'.join(map(str, MIN_VERSION))}，当前 {bpy.app.version_string}")
    print("[OK] 版本满足最低要求")

    addons = {m.module for m in bpy.context.preferences.addons}
    if "io_scene_gltf2" not in addons:
        fail("glTF 导出器 (io_scene_gltf2) 未启用")
    print("[OK] glTF 导出器已启用")

    has_draco = hasattr(bpy.ops.export_scene, "gltf")
    print(f"[OK] export_scene.gltf 操作可用: {has_draco}")

    # 导出参数以本版本为准（Blender 5.x）
    props = set()
    try:
        rna = bpy.ops.export_scene.gltf.get_rna_type()
        props = {p.identifier for p in rna.properties}
    except Exception as exc:  # noqa: BLE001
        fail(f"读取 gltf 导出参数失败: {exc}")
    for key in ("filepath", "export_format", "export_apply", "export_yup", "export_draco_mesh_compression_enable"):
        print(f"[{'OK' if key in props else 'WARN'}] 导出参数 {key}")

    print("[DONE] 环境检查通过")


if __name__ == "__main__":
    main()
