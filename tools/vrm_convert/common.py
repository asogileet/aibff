import bpy, json, struct, math, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.normpath(os.path.join(HERE, "..", "..", "assets", "models"))
SRC = os.path.join(MODELS, "mint_swimsuit_animated-_neverness_to_everness.glb")
DST = os.path.join(MODELS, "mint_swimsuit.vrm")
WORK = os.path.join(HERE, "_work")  # intermediate files and preview renders (git-ignored)
os.makedirs(WORK, exist_ok=True)

def strip_animations(src, dst):
    with open(src, 'rb') as f:
        data = f.read()
    magic, ver, total = struct.unpack_from('<III', data, 0)
    jlen, jtype = struct.unpack_from('<II', data, 12)
    js = json.loads(data[20:20+jlen])
    rest = data[20+jlen:]
    js.pop('animations', None)
    jb = json.dumps(js, separators=(',', ':')).encode('utf-8')
    jb += b' ' * ((4 - len(jb) % 4) % 4)
    out = struct.pack('<III', magic, ver, 12 + 8 + len(jb) + len(rest)) + struct.pack('<II', len(jb), jtype) + jb + rest
    with open(dst, 'wb') as f:
        f.write(out)
    return js

def world_bounds(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    mn = Vector((1e9,)*3); mx = Vector((-1e9,)*3)
    for o in objs:
        eo = o.evaluated_get(dg)
        for v in eo.data.vertices:
            c = eo.matrix_world @ v.co
            for i in range(3):
                mn[i] = min(mn[i], c[i]); mx[i] = max(mx[i], c[i])
    return mn, mx

def render(path, objs=None, view='front', res=(900, 1200), zoom=None, center=None):
    scene = bpy.context.scene
    objs = objs or [o for o in scene.objects if o.type == 'MESH' and not o.hide_render]
    mn, mx = world_bounds(objs)
    c = center or (mn + mx) / 2
    size = zoom or max(mx.x - mn.x, (mx.z - mn.z) * res[0] / res[1], mx.y - mn.y if view == 'side' else 0) * 1.1
    cam_data = bpy.data.cameras.new('cam'); cam_data.type = 'ORTHO'; cam_data.ortho_scale = size
    cam_data.clip_end = 1000
    cam = bpy.data.objects.new('cam', cam_data); scene.collection.objects.link(cam)
    d = {'front': (Vector((0, -50, 0)), (math.pi/2, 0, 0)),
         'back': (Vector((0, 50, 0)), (math.pi/2, 0, math.pi)),
         'side': (Vector((50, 0, 0)), (math.pi/2, 0, math.pi/2))}[view]
    cam.location = Vector(c) + d[0]; cam.rotation_euler = d[1]
    scene.camera = cam
    scene.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.film_transparent = False
    if not scene.world:
        scene.world = bpy.data.worlds.new('w')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get('Background')
    if bg: bg.inputs[0].default_value = (0.25, 0.25, 0.28, 1)
    scene.view_settings.view_transform = 'Standard'
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)
    print("RENDERED", path, "bounds", [round(v, 3) for v in (*mn, *mx)])
