import bpy, sys, os, math
from mathutils import Matrix, Vector, Quaternion
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

def descendants(bone):
    out = []
    for c in bone.children:
        out.append(c); out.extend(descendants(c))
    return out

def load_and_pose(keep_face_local=True, tpose=True):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.preferences.addon_enable(module='bl_ext.user_default.vrm')
    # the bundled animation would override the default pose on import, so drop it first
    noanim = os.path.join(WORK, 'noanim.glb')
    strip_animations(SRC, noanim)
    bpy.ops.import_scene.gltf(filepath=noanim)
    arm = bpy.data.objects['Object_143']
    for o in list(bpy.data.objects):
        if o.type in ('MESH', 'ARMATURE') and o is not arm and o.parent is not arm:
            bpy.data.objects.remove(o)
    vl = bpy.context.view_layer
    vl.update()
    # face rig bones have incoherent bind matrices: keep their default local transform
    face_root = arm.pose.bones['Bone_head_0256']
    face = [face_root] + descendants(face_root)
    face_local = {pb.name: pb.parent.matrix.inverted() @ pb.matrix for pb in face}
    face_names = set(face_local)
    for pb in arm.pose.bones:
        if keep_face_local and pb.name in face_names:
            continue
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = (1, 0, 0, 0)
    vl.update()
    if keep_face_local:
        for pb in face:  # parent-first order
            pb.matrix = pb.parent.matrix @ face_local[pb.name]
            vl.update()
    if tpose:
        for side, sign in (('L', 1), ('R', -1)):
            ua = arm.pose.bones[[b.name for b in arm.data.bones if b.name.startswith(f'Bip001-{side}-UpperArm')][0]]
            hand = arm.pose.bones[[b.name for b in arm.data.bones if b.name.startswith(f'Bip001-{side}-Hand')][0]]
            mw = arm.matrix_world
            d = ((mw @ hand.head) - (mw @ ua.head)).normalized()
            rot = d.rotation_difference(Vector((sign, 0, 0))).to_matrix().to_4x4()
            piv = mw @ ua.head
            world = Matrix.Translation(piv) @ rot @ Matrix.Translation(-piv) @ mw @ ua.matrix
            ua.matrix = mw.inverted() @ world
            vl.update()
    return arm

def bake_rest(arm):
    """Apply current pose as rest pose and move everything to Z-up, centred, feet on ground."""
    vl = bpy.context.view_layer
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    dg = bpy.context.evaluated_depsgraph_get()
    coords = {}
    for o in meshes:
        eo = o.evaluated_get(dg)
        coords[o.name] = [eo.matrix_world @ v.co for v in eo.data.vertices]
    # apply pose as rest
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True); vl.objects.active = arm
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    # detach from the Sketchfab empties
    aw = arm.matrix_world.copy()
    arm.parent = None
    hips = arm.data.bones[[b.name for b in arm.data.bones if b.name.startswith('Bip001-Pelvis')][0]]
    hp = aw @ hips.head_local
    fix = Matrix.Rotation(math.radians(90), 4, 'X') @ Matrix.Translation(Vector((-hp.x, 0, -hp.z)))
    arm.matrix_world = fix @ aw
    for o in meshes:
        o.parent = arm
        o.matrix_parent_inverse = Matrix.Identity(4)
        o.matrix_world = Matrix.Identity(4)
        for v, c in zip(o.data.vertices, coords[o.name]):
            v.co = fix @ c
        o.data.update()
    vl.update()
    # ground
    zmin = min((fix @ c).z for cs in coords.values() for c in cs)
    arm.matrix_world = Matrix.Translation((0, 0, -zmin)) @ arm.matrix_world
    for o in meshes:
        o.matrix_world = Matrix.Identity(4)
        for v in o.data.vertices: v.co.z -= zmin
    vl.update()
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True); vl.objects.active = arm
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in meshes:
        o.matrix_world = Matrix.Identity(4)
        o.matrix_parent_inverse = Matrix.Identity(4)
    for o in list(bpy.data.objects):
        if o.type == 'EMPTY': bpy.data.objects.remove(o)
    vl.update()
    return meshes

