"""Make every material of a VRM 0.x file unlit (flat 2D look, ignores scene lights).

Standalone use: python postprocess.py in.vrm out.vrm
"""
import json, struct, sys


def make_unlit(src, dst):
    d = open(src, 'rb').read()
    magic, ver, _ = struct.unpack_from('<III', d, 0)
    jlen, jtype = struct.unpack_from('<II', d, 12)
    js = json.loads(d[20:20 + jlen]); rest = d[20 + jlen:]
    for m in js['materials']:
        m.setdefault('extensions', {})['KHR_materials_unlit'] = {}
        m.pop('emissiveFactor', None); m.pop('emissiveTexture', None); m.pop('normalTexture', None)
    # VRM_USE_GLTFSHADER tells VRM loaders to use the glTF material (unlit) instead of MToon
    js['extensions']['VRM']['materialProperties'] = [
        {'name': m['name'], 'shader': 'VRM_USE_GLTFSHADER', 'renderQueue': 2000, 'floatProperties': {}, 'vectorProperties': {},
         'textureProperties': {}, 'keywordMap': {}, 'tagMap': {}} for m in js['materials']]
    if 'KHR_materials_unlit' not in js.setdefault('extensionsUsed', []):
        js['extensionsUsed'].append('KHR_materials_unlit')
    jb = json.dumps(js, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    jb += b' ' * ((4 - len(jb) % 4) % 4)
    with open(dst, 'wb') as f:
        f.write(struct.pack('<III', magic, ver, 20 + len(jb) + len(rest)) + struct.pack('<II', len(jb), jtype) + jb + rest)
    print('wrote', dst, 20 + len(jb) + len(rest), 'bytes;', len(js['materials']), 'materials unlit')


if __name__ == '__main__':
    make_unlit(sys.argv[1], sys.argv[2])
