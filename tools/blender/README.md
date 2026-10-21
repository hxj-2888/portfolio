# Blender 资产脚本 · AI 技术拓展 P1 示例

> 目的：验证「AI 起草的 bpy 脚本 → 可复跑、确定性的 glTF → 可提交进仓库的静态资产」这条链路。
> 环境：Blender **5.2.2 LTS**（`E:\SteamLibrary\steamapps\common\Blender\blender.exe`，build 2026-09-15）
> 依赖：无。不装任何插件、不联网。脚本只用 Blender 自带 Python（5.2 内置 3.13.13）。

---

## 1. 复跑命令

```powershell
# 环境探测（只读）
& "E:\SteamLibrary\steamapps\common\Blender\blender.exe" --background --factory-startup `
  --python tools/blender/check-env.py

# 生成乒乓台并导出
& "E:\SteamLibrary\steamapps\common\Blender\blender.exe" --background --factory-startup `
  --python tools/blender/export_table.py -- --out assets/models/ping-pong-table.glb
```

参数：
- `--out <path>`：产物路径，默认 `assets/models/ping-pong-table.glb`
- `--no-draco`：关闭 Draco 网格压缩（体积略大、兼容性最好；默认开启）

## 2. 产物

| 文件 | 大小 | 网格 / 顶点 / 三角 | 说明 |
|---|---|---|---|
| `assets/models/ping-pong-table.glb` | 12,468 B | 11 / 88 / 132 | ITTF 标准尺寸，含台面、中线、端线、边线、球网、四条腿、相机与太阳光 |

命名约定：`<项目>_<对象>_<版本>.glb`（本文件首版，故不加版本后缀；出现 2.0 版时改名 `ping-pong-table_v2.glb` 并保留旧版一个迭代）。

## 3. 确定性验证（2026-10-21 实测）

```
[STAT] meshes=11 verts=88 tris=132
[DONE] size=12468B sha256_16=93d6505ed9ba436f
run1 sha256 = 93D6505ED9BA436F3EE8DDD97666F59548B1D89B43AB29B9654ADAA47A2CBA32
run2 sha256 = 93D6505ED9BA436F3EE8DDD97666F59548B1D89B43AB29B9654ADAA47A2CBA32
identical = True
GLB header: magic=glTF version=2 length=12468
```

同一个 Blender 版本下**字节级可复现**，因此产物可以安全入库、`git diff` 能反映真实改动。

## 4. 踩坑记录（写下来给下次的自己和 AI）

| 现象 | 根因 | 处置 |
|---|---|---|
| `enum "BLENDER_EEVEE_NEXT" not found in ('BLENDER_EEVEE','BLENDER_WORKBENCH','CYCLES')` | 渲染引擎枚举名在 4.x→5.x 变了（4.x 叫 `BLENDER_EEVEE_NEXT`，5.x 回到 `BLENDER_EEVEE`） | 脚本改为**运行时读枚举**择优设置，不再硬编码 |
| 导出参数未来可能改名 | glTF 导出器参数随版本增删 | 用 `bpy.ops.export_scene.gltf.get_rna_type()` 取可用参数，**只传存在的**，缺失的打 `[WARN]` |
| `--factory-startup` 下仍有默认立方体 | 不是「空场景」而是「默认场景」 | 脚本先 `select_all + delete` 再建根 collection |

## 5. 下一步（P2）

- 网页侧加载这个 glb：优先**纯 WebGL 手写**（零依赖，约 150 行）或 **Three.js vendor**（约 600 KB）；
- 大厅加一个「3D 资产」小节，展示同一个 glb 的旋转预览；
- 验收：DevTools Network 里**没有任何外部请求**，六档视口正常。

## 6. 版权与来源

本脚本与产物均为自制（无第三方素材、无 AI 生图），可直接进 MIT 仓库；一旦引入 AI 生成贴图，请在 `assets/ATTRIBUTION.md` 按《AI 技术拓展路线图》§4 登记。
