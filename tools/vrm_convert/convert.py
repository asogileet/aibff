"""Convert the Sketchfab GLB of Mint (swimsuit) into assets/models/mint_swimsuit.vrm.

Run with Blender (see README.md):
    blender -b --python tools/vrm_convert/convert.py [-- --preview]
"""
import bpy, sys, os, re
from mathutils import Matrix, Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from build import load_and_pose, bake_rest
from postprocess import make_unlit
OUT = os.path.join(WORK, 'mint_swimsuit_mtoon.vrm')
PREVIEW = '--preview' in sys.argv

arm = load_and_pose()
meshes = bake_rest(arm)
arm.name = 'Armature'; arm.data.name = 'Armature'
vl = bpy.context.view_layer
B = {re.sub(r'_\d+$', '', b.name): b.name for b in arm.data.bones}
def P(n): return arm.data.bones[B[n]].head_local.copy()

# ---------------------------------------------------------------- expressions
# The source model has no morph targets; its face is bone-driven. Pose the face
# bones and bake the result into shape keys so VRM blend shapes can use them.
def lower_contour(side, ax):
    names = ('BON_eyeCo_in_', 'BON_eyelid02_lo_', 'BON_eyelid_lo_', 'BON_eyelid03_lo_', 'BON_eyeCo_out_')
    pts = sorted(((abs(P(n + side).x), P(n + side)) for n in names), key=lambda t: t[0])
    for (x0, p0), (x1, p1) in zip(pts, pts[1:]):
        if x0 <= ax <= x1:
            return p0.lerp(p1, (ax - x0) / (x1 - x0))
    return pts[0][1] if ax < pts[0][0] else pts[-1][1]

def eyes(close=0.0, lower_up=0.0, sides='LR'):
    d = {}
    for s in sides:
        main = {}
        for n in ('BON_eyelid02_up_' + s, 'BON_eyelid_up_' + s, 'BON_eyelid03_up_' + s):
            p = P(n); t = lower_contour(s, abs(p.x))
            main[n] = Vector((0, (t.y - p.y), (t.z - p.z))) * close
        d.update(main)
        d['BON_eyelid04_up_' + s] = main['BON_eyelid02_up_' + s] * 0.75
        d['BON_eyelid05_up_' + s] = main['BON_eyelid03_up_' + s] * 0.9
        if lower_up:
            for n in ('BON_eyelid02_lo_' + s, 'BON_eyelid_lo_' + s, 'BON_eyelid03_lo_' + s):
                d[n] = Vector((0, 0, lower_up))
    return d

def mouth(open=0.0, width=1.0, corner_up=0.0):
    d = {}
    for n, k in (('Bon_Lolip_M', 1.0), ('Bon_Lolip01_L', 0.92), ('Bon_Lolip01_R', 0.92), ('Bon_Lolip02_L', 0.62), ('Bon_Lolip02_R', 0.62), ('Bon_yachi_lo', 0.4)):
        d[n] = Vector((0, 0, -open * k))
    for n, k in (('Bon_uplip_M', 0.12), ('Bon_uplip01_L', 0.1), ('Bon_uplip01_R', 0.1)):
        d[n] = Vector((0, 0, open * k))
    for n in ('Bon_colip_L', 'Bon_colip_R', 'Bon_zuiba_L', 'Bon_zuiba_R', 'Bon_uplip02_L', 'Bon_uplip02_R', 'Bon_Lolip02_L', 'Bon_Lolip02_R', 'Bon_uplip01_L', 'Bon_uplip01_R', 'Bon_Lolip01_L', 'Bon_Lolip01_R'):
        p = P(n)
        v = d.get(n, Vector((0, 0, 0)))
        v = v + Vector((p.x * (width - 1.0), 0, 0))
        if 'colip' in n or 'zuiba' in n:
            v = v + Vector((0, 0, corner_up - open * 0.18))
        d[n] = v
    return d

def brows(inner=0.0, mid=0.0, outer=0.0):
    d = {}
    for s in 'LR':
        d['Bon_eyebrow01_' + s] = Vector((0, 0, inner))
        d['Bon_eyebrow02_' + s] = Vector((0, 0, mid))
        d['Bon_eyebrow03_' + s] = Vector((0, 0, outer))
    return d

def merge(*ds):
    out = {}
    for d in ds:
        for k, v in d.items():
            out[k] = out.get(k, Vector((0, 0, 0))) + v
    return out

EXPR = {  # name -> (VRM0 preset, bone offsets)
    'A': ('a', mouth(open=0.0075)),
    'I': ('i', mouth(open=0.0025, width=1.12)),
    'U': ('u', mouth(open=0.003, width=0.9)),
    'E': ('e', mouth(open=0.004, width=1.08)),
    'O': ('o', mouth(open=0.006, width=0.92)),
    'Blink': ('blink', eyes(close=0.97)),
    'Blink_L': ('blink_l', eyes(close=0.97, sides='L')),
    'Blink_R': ('blink_r', eyes(close=0.97, sides='R')),
    'Joy': ('joy', merge(eyes(close=0.15, lower_up=0.003), mouth(open=0.004, width=1.1, corner_up=0.004), brows(0.0015, 0.002, 0.0015))),
    'Angry': ('angry', merge(eyes(close=0.18), mouth(width=0.95, corner_up=-0.002), brows(-0.0045, -0.002, 0.002))),
    'Sorrow': ('sorrow', merge(eyes(close=0.28), mouth(width=0.95, corner_up=-0.0025), brows(0.004, 0.001, -0.003))),
    'Fun': ('fun', merge(eyes(close=0.22, lower_up=0.001), mouth(width=1.05, corner_up=0.0022), brows(0.001, 0.001, 0.001))),
    'surprised': ('unknown', merge(eyes(close=-0.12), mouth(open=0.0045, width=0.92), brows(0.005, 0.005, 0.004))),
}

def deformed():
    vl.update()
    dg = bpy.context.evaluated_depsgraph_get()
    return {o.name: [v.co.copy() for v in o.evaluated_get(dg).data.vertices] for o in meshes}

rest = {o.name: [v.co.copy() for v in o.data.vertices] for o in meshes}
binds = {}
for name, (preset, offs) in EXPR.items():
    base = deformed()
    for n, d in offs.items():
        pb = arm.pose.bones[B[n]]
        pb.matrix = Matrix.Translation(d) @ pb.bone.matrix_local
    cur = deformed()
    for pb in arm.pose.bones:
        pb.matrix_basis.identity()
    binds[name] = []
    for o in meshes:
        if max((a - b).length for a, b in zip(cur[o.name], base[o.name])) < 1e-6:
            continue
        if not o.data.shape_keys:
            o.shape_key_add(name='Basis')
        sk = o.shape_key_add(name=name, from_mix=False)
        sk.value = 0.0
        for kp, r, c, b in zip(sk.data, rest[o.name], cur[o.name], base[o.name]):
            kp.co = r + (c - b)
        binds[name].append(o.name)
    print("EXPR", name, binds[name])
vl.update()

if PREVIEW:
    for name in EXPR:
        for o in meshes:
            if o.data.shape_keys:
                for kb in o.data.shape_keys.key_blocks:
                    kb.value = 1.0 if kb.name == name else 0.0
        render(os.path.join(WORK, 'e_' + name + '.png'), res=(500, 400), zoom=0.2, center=Vector((0, 0, 1.455)))
    for o in meshes:
        if o.data.shape_keys:
            for kb in o.data.shape_keys.key_blocks:
                kb.value = 0.0

# ---------------------------------------------------------------- materials
# MToon is only the carrier that gets the textures exported; postprocess.py
# then flags every material as unlit (the "Emission only" look the author asks for).
for mat in bpy.data.materials:
    if not mat.node_tree:
        continue
    img = next(n.image for n in mat.node_tree.nodes if n.bl_idname == 'ShaderNodeTexImage')
    if not img.name.startswith('mint_'):
        img.name = 'mint_' + mat.name.replace('MI_player_019_mint_', '').replace('MI_019_mint_', '').replace('MI_', '')
    m = mat.vrm_addon_extension.mtoon1
    m.enabled = True
    m.pbr_metallic_roughness.base_color_texture.index.source = img
    m.extensions.vrmc_materials_mtoon.shade_multiply_texture.index.source = img
    m.extensions.vrmc_materials_mtoon.shade_color_factor = (1, 1, 1)
    m.double_sided = True

# ---------------------------------------------------------------- VRM 0.x settings
ext = arm.data.vrm_addon_extension
ext.spec_version = '0.0'
vrm0 = ext.vrm0
meta = vrm0.meta
meta.title = 'Mint Swimsuit (Neverness to Everness)'
meta.version = '1.0'
meta.author = 'Jun Hungry (Sketchfab)'
meta.reference = 'https://sketchfab.com/3d-models/mint-swimsuit-animated-neverness-to-everness-6dbe3e3dc6704a36bb3acef80b0bc5e4'
meta.allowed_user_name = 'Everyone'
meta.license_name = 'CC_BY'

HB = {'hips': 'Bip001-Pelvis', 'spine': 'Bip001-Spine', 'chest': 'Bip001-Spine1', 'upperChest': 'Bip001-Spine2', 'neck': 'Bip001-Neck', 'head': 'Bip001-Head',
      'leftEye': 'Bon_eyeball_L', 'rightEye': 'Bon_eyeball_R'}
for s, side in (('L', 'left'), ('R', 'right')):
    HB.update({side + 'Shoulder': 'Bip001-%s-Clavicle' % s, side + 'UpperArm': 'Bip001-%s-UpperArm' % s, side + 'LowerArm': 'Bip001-%s-Forearm' % s, side + 'Hand': 'Bip001-%s-Hand' % s,
               side + 'UpperLeg': 'Bip001-%s-Thigh' % s, side + 'LowerLeg': 'Bip001-%s-Calf' % s, side + 'Foot': 'Bip001-%s-Foot' % s, side + 'Toes': 'Bip001-%s-Toe0' % s})
    for i, f in enumerate(('Thumb', 'Index', 'Middle', 'Ring', 'Little')):
        for j, seg in enumerate(('Proximal', 'Intermediate', 'Distal')):
            HB[side + f + seg] = 'Bip001-%s-Finger%d%s' % (s, i, j if j else '')
hum = vrm0.humanoid
hum.initial_automatic_bone_assignment = False
existing = {h.bone: h for h in hum.human_bones}
for h in hum.human_bones:
    h.node.bone_name = ''
for hb, bn in HB.items():
    h = existing.get(hb)
    if h is None:
        h = hum.human_bones.add(); h.bone = hb
    h.node.bone_name = B[bn]
    print("HUMAN", hb, B[bn], "parent:", arm.data.bones[B[bn]].parent.name)

fp = vrm0.first_person
fp.first_person_bone.bone_name = B['Bip001-Head']
fp.first_person_bone_offset = (0, 0.06, 0)
fp.look_at_type_name = 'Bone'
for curve, y in ((fp.look_at_horizontal_inner, 8), (fp.look_at_horizontal_outer, 8), (fp.look_at_vertical_down, 7), (fp.look_at_vertical_up, 7)):
    curve.x_range = 90; curve.y_range = y

groups = vrm0.blend_shape_master.blend_shape_groups
while len(groups):
    groups.remove(0)
g = groups.add(); g.name = 'Neutral'; g.preset_name = 'neutral'
for name, (preset, _) in EXPR.items():
    g = groups.add(); g.name = name; g.preset_name = preset
    for on in binds[name]:
        b = g.binds.add(); b.mesh.mesh_object_name = on; b.index = name; b.weight = 1.0

sa = vrm0.secondary_animation
def spring(comment, pattern, stiff, grav, drag, radius=0.02):
    roots = [b.name for b in arm.data.bones if re.match(pattern, b.name) and not (b.parent and re.match(pattern, b.parent.name))]
    if not roots:
        return
    g = sa.bone_groups.add(); g.comment = comment; g.stiffiness = stiff; g.gravity_power = grav; g.gravity_dir = (0, 0, -1); g.drag_force = drag; g.hit_radius = radius
    for r in roots:
        b = g.bones.add(); b.bone_name = r
    print("SPRING", comment, roots)
spring('hair', r'^(Bn_._hair|Bone01[345])', 1.4, 0.05, 0.5)
spring('tail', r'^Bn_m_tail', 1.6, 0.0, 0.5)
spring('ribbon', r'^Bn_._(piaodai|tieA)', 1.2, 0.08, 0.45)
spring('skirt', r'^Bn_._(qun|bag)', 2.2, 0.05, 0.55)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(WORK, 'mint_swimsuit.blend'))
vl.objects.active = arm
res = bpy.ops.export_scene.vrm(filepath=OUT, armature_object_name=arm.name, ignore_warning=True)
print("EXPORT", res, os.path.getsize(OUT) if os.path.exists(OUT) else None)
if res == {'FINISHED'}:
    make_unlit(OUT, DST)
