"""
export_table.py — 生成「乒乓台」低模并导出 glTF (.glb)

用法（Windows）：
  & "E:\\SteamLibrary\\steamapps\\common\\Blender\\blender.exe" `
    --background --factory-startup `
    --python tools/blender/export_table.py -- --out assets/models/ping-pong-table.glb

尺寸口径（ITTF 标准，单位米）：
  台面 2.74 x 1.525，台高 0.76（台面上表面离地）
  球网高 0.1525，网长 1.83（两侧各超出台边 0.1525）

约定：
  - 不用任何第三方插件、不访问网络；
  - 场景完全由脚本生成，重复运行结果确定（无随机数）；
  - 失败必须显式报错（非零退出），不许静默跳过。
"""

import argparse
import hashlib
import os
import sys

TABLE_L = 2.74
TABLE_W = 1.525
TABLE_H = 0.76
TABLE_T = 0.02  # 台面板厚
LEG = 0.05
NET_H = 0.1525
NET_OVERHANG = 0.1525

COLOR_TABLE = (0.05, 0.30, 0.38, 1.0)   # 深青蓝
COLOR_LINE = (0.95, 0.95, 0.95, 1.0)    # 白线
COLOR_NET = (0.08, 0.08, 0.10, 1.0)     # 深灰网
COLOR_METAL = (0.25, 0.26, 0.30, 1.0)   # 支架


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", default="assets/models/ping-pong-table.glb")
    p.add_argument("--no-draco", action="store_true", help="关闭 Draco 压缩（体积略大、兼容性最好）")
    return p.parse_args(argv)


def make_material(bpy, name, color, roughness=0.6, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf is None:
        raise RuntimeError(f"材质 {name} 缺少 Principled BSDF 节点")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


def add_box(bpy, name, size, location, material):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0], size[1], size[2])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    return obj


def build(bpy):
    # 清空默认场景（--factory-startup 下仍有立方体/灯光/相机）
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for coll in list(bpy.data.collections):
        bpy.data.collections.remove(coll)

    root = bpy.data.collections.new("PingPongTable")
    bpy.context.scene.collection.children.link(root)
    bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection.children[root.name]

    mat_table = make_material(bpy, "M_Table", COLOR_TABLE, roughness=0.35)
    mat_line = make_material(bpy, "M_Line", COLOR_LINE, roughness=0.8)
    mat_net = make_material(bpy, "M_Net", COLOR_NET, roughness=0.9)
    mat_metal = make_material(bpy, "M_Metal", COLOR_METAL, roughness=0.4, metallic=0.8)

    top_z = TABLE_H - TABLE_T / 2
    add_box(bpy, "TableTop", (TABLE_L, TABLE_W, TABLE_T), (0.0, 0.0, top_z), mat_table)

    # 中线（沿短边方向，1cm 宽）
    add_box(bpy, "CenterLine", (TABLE_L, 0.01, 0.002), (0.0, 0.0, TABLE_H + 0.001), mat_line)
    # 两侧端线 + 边线（与台面同宽/同长）
    for sign in (-1, 1):
        add_box(bpy, f"EndLine_{'N' if sign > 0 else 'S'}",
                (0.02, TABLE_W, 0.002), (sign * (TABLE_L / 2 - 0.01), 0.0, TABLE_H + 0.001), mat_line)
        add_box(bpy, f"SideLine_{'E' if sign > 0 else 'W'}",
                (TABLE_L, 0.02, 0.002), (0.0, sign * (TABLE_W / 2 - 0.01), TABLE_H + 0.001), mat_line)

    # 球网（薄片）
    net_len = TABLE_W + 2 * NET_OVERHANG
    add_box(bpy, "Net", (0.005, net_len, NET_H), (0.0, 0.0, TABLE_H + NET_H / 2), mat_net)

    # 四条腿
    leg_h = TABLE_H - TABLE_T
    for sx in (-1, 1):
        for sy in (-1, 1):
            add_box(bpy, f"Leg_{'E' if sx > 0 else 'W'}{'N' if sy > 0 else 'S'}",
                    (LEG, LEG, leg_h),
                    (sx * (TABLE_L / 2 - 0.15), sy * (TABLE_W / 2 - 0.15), leg_h / 2),
                    mat_metal)

    # 相机 + 灯光：让 glb 在任何查看器里都能直接看到像样的效果
    cam_data = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_data)
    cam.location = (3.2, -3.6, 2.4)
    cam.rotation_euler = (1.02, 0.0, 0.72)
    root.objects.link(cam)
    bpy.context.scene.camera = cam

    light_data = bpy.data.lights.new("Sun", type="SUN")
    light_data.energy = 3.0
    sun = bpy.data.objects.new("Sun", light_data)
    sun.location = (2.0, -2.0, 4.0)
    sun.rotation_euler = (0.6, 0.2, 0.4)
    root.objects.link(sun)

    # 渲染引擎名跨版本不同（4.x=BLENDER_EEVEE_NEXT，5.x=BLENDER_EEVEE），按可用枚举择优设置
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    for candidate in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        if candidate in engines:
            bpy.context.scene.render.engine = candidate
            print(f"[INFO] render engine = {candidate}")
            break
    bpy.context.scene.unit_settings.system = "METRIC"

    meshes = [o for o in root.objects if o.type == "MESH"]
    verts = sum(len(o.data.vertices) for o in meshes)
    tris = sum(len(o.data.loop_triangles) if o.data.loop_triangles else 0 for o in meshes)
    for o in meshes:
        o.data.calc_loop_triangles()
    tris = sum(len(o.data.loop_triangles) for o in meshes)
    print(f"[STAT] meshes={len(meshes)} verts={verts} tris={tris}")
    return verts, tris


def export(bpy, path, use_draco):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    kwargs = dict(
        filepath=path,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_cameras=True,
        export_lights=True,
        export_extras=True,
    )
    rna = bpy.ops.export_scene.gltf.get_rna_type()
    available = {p.identifier for p in rna.properties}
    if "export_draco_mesh_compression_enable" in available:
        kwargs["export_draco_mesh_compression_enable"] = bool(use_draco)
    else:
        print("[WARN] 当前版本没有 Draco 参数，跳过压缩设置")
    kwargs = {k: v for k, v in kwargs.items() if k in available or k == "filepath"}
    bpy.ops.export_scene.gltf(**kwargs)
    if not os.path.exists(path):
        raise RuntimeError(f"导出失败，产物不存在：{path}")
    size = os.path.getsize(path)
    with open(path, "rb") as fh:
        head = fh.read(4)
    if head != b"glTF":
        raise RuntimeError(f"产物魔数不是 glTF：{head!r}")
    sha = hashlib.sha256(open(path, "rb").read()).hexdigest()[:16]
    print(f"[DONE] {path} size={size}B sha256_16={sha}")
    return size, sha


def main():
    args = parse_args()
    import bpy  # noqa: PLC0415  （只能在 Blender 内导入）

    build(bpy)
    export(bpy, args.out, use_draco=not args.no_draco)
    print("[OK] 完成")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print(f"[FAIL] {exc}")
        sys.exit(1)
