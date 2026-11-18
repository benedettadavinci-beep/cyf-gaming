"""R-534 (personaggi 3D veri, strada A): prepara i modelli del rider per il gioco.

Parte dai personaggi CC0 di Quaternius "Universal Base Characters" (versione Standard, gratis) e scrive
public/pista-nera/modelli/rider-m.glb e rider-f.glb, già "vestiti" da snowboarder e leggeri per il telefono:
- il corpo è diviso in pezzi (testa, giacca, braccia, avambracci, mani, pantaloni, piedi): ognuno ha il suo materiale,
  così il gioco cambia colore a giacca, maniche, pantaloni, guanti e scarpe senza texture nuove;
- giacca, pantaloni e scarponi sono il corpo lisciato e gonfiato (imbottitura), senza i muscoli del modello nudo;
- la giacca ha le coordinate di texture "a cilindro" uguali a quelle del vecchio busto: la texture della maglia
  (scritta CYF sulla schiena, stemmi) di rider.js si usa così com'è;
- capelli (3 acconciature per modello, più la barba) e sopracciglia legati all'osso della testa;
- texture rimpicciolite (viso 512 px, occhi 64 px, capelli 256 px grigi da colorare), niente normal map.

Uso: python3 tools/modelli/prepara_rider.py "<cartella Universal Base Characters[Standard]>" public/pista-nera/modelli
"""
import json, os, struct, sys, io
import numpy as np
from PIL import Image

SRC = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else 'public/pista-nera/modelli'
BASE = os.path.join(SRC, 'Base Characters')
HAIR = os.path.join(SRC, 'Hairstyles', 'Rigged to Head Bone', 'glTF (Godot -Unreal)')

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def carica(path):
    g = json.load(open(path))
    bins = [open(os.path.join(os.path.dirname(path), b['uri']), 'rb').read() for b in g['buffers']]
    def acc(i):
        a = g['accessors'][i]; bv = g['bufferViews'][a['bufferView']]
        dt = np.dtype(CT[a['componentType']]); n = NC[a['type']]
        off = bv.get('byteOffset', 0) + a.get('byteOffset', 0); stride = bv.get('byteStride', dt.itemsize * n)
        raw = bins[bv['buffer']]
        if stride == dt.itemsize * n:
            arr = np.frombuffer(raw, dt, a['count'] * n, off).reshape(a['count'], n)
        else:
            arr = np.stack([np.frombuffer(raw, dt, n, off + k * stride) for k in range(a['count'])])
        arr = arr.astype(np.float64) if dt != np.float32 else arr.astype(np.float64)
        if a.get('normalized'):
            arr = arr / float(np.iinfo(dt).max)
        return arr
    return g, acc

def prim(g, acc, mesh_name):
    m = [m for m in g['meshes'] if m['name'] == mesh_name][0]['primitives'][0]
    A = m['attributes']
    d = {'pos': acc(A['POSITION']), 'nor': acc(A['NORMAL']), 'idx': acc(m['indices']).astype(np.int64).ravel(),
         'joi': acc(A['JOINTS_0']).astype(np.int64), 'wei': acc(A['WEIGHTS_0'])}
    if 'TEXCOORD_0' in A: d['uv'] = acc(A['TEXCOORD_0'])
    return d

def normali(pos, idx):
    t = idx.reshape(-1, 3); n = np.zeros_like(pos)
    f = np.cross(pos[t[:, 1]] - pos[t[:, 0]], pos[t[:, 2]] - pos[t[:, 0]])
    for k in range(3): np.add.at(n, t[:, k], f)
    l = np.linalg.norm(n, axis=1, keepdims=True); l[l == 0] = 1
    return n / l

# gruppi di ossa → pezzo del corpo
GRUPPI = {
    'testa': ['neck_01', 'Head'],
    'giacca': ['spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r'],
    'braccia': ['upperarm_l', 'upperarm_r'],
    'avambracci': ['lowerarm_l', 'lowerarm_r'],
    'pantaloni': ['pelvis', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'root'],
    'piedi': ['foot_l', 'foot_r', 'ball_l', 'ball_r', 'ball_leaf_l', 'ball_leaf_r'],
}
PEZZI = ['testa', 'giacca', 'braccia', 'avambracci', 'mani', 'pantaloni', 'piedi']
# imbottitura (metri, prima della scala del gioco) e passate di lisciatura per pezzo
GONFIA = {'testa': 0, 'giacca': 0.034, 'braccia': 0.026, 'avambracci': 0.016, 'mani': 0.006, 'pantaloni': 0.026, 'piedi': 0.03}
LISCIA = {'testa': 0, 'giacca': 10, 'braccia': 6, 'avambracci': 3, 'mani': 0, 'pantaloni': 8, 'piedi': 8}

def gruppo_osso(nome):
    for k, v in GRUPPI.items():
        if nome in v: return k
    return 'mani'   # mani e dita

def prepara(sesso):
    nome = 'Superhero_Male_FullBody' if sesso == 'm' else 'Superhero_Female_FullBody'
    g, acc = carica(os.path.join(BASE, 'Godot - UE', nome + '.gltf'))
    skin = g['skins'][0]; joints = skin['joints']
    ossa = [g['nodes'][j]['name'] for j in joints]
    corpo_nome = [m['name'] for m in g['meshes'] if m['primitives'][0]['material'] == 2][0]
    occhi_nome = [m['name'] for m in g['meshes'] if m['primitives'][0]['material'] == 1][0]
    sopra_nome = [m['name'] for m in g['meshes'] if m['primitives'][0]['material'] == 0][0]
    C = prim(g, acc, corpo_nome)
    pos, idx = C['pos'].copy(), C['idx']
    # pezzo di ogni vertice: il gruppo di ossa che pesa di più
    gid = np.array([PEZZI.index(gruppo_osso(n)) for n in ossa])
    peso = np.zeros((len(pos), len(PEZZI)))
    for k in range(4): np.add.at(peso, (np.arange(len(pos)), gid[C['joi'][:, k]]), C['wei'][:, k])
    reg = peso.argmax(1)
    # saldatura dei vertici doppi (cuciture delle texture) per lisciare e calcolare le normali senza spigoli
    chiave = np.round(pos * 1e5).astype(np.int64)
    _, wid, inv = np.unique(chiave, axis=0, return_index=True, return_inverse=True)
    inv = inv.ravel(); W = len(wid)
    wp = pos[wid].copy(); wreg = reg[wid]
    widx = inv[idx]
    t = widx.reshape(-1, 3)
    vic = [set() for _ in range(W)]
    for a, b, c in t:
        vic[a].update((b, c)); vic[b].update((a, c)); vic[c].update((a, b))
    vic = [np.array(sorted(v)) for v in vic]
    passate = np.array([LISCIA[PEZZI[r]] for r in wreg])
    for it in range(max(LISCIA.values())):
        sel = np.where(passate > it)[0]
        media = np.array([wp[vic[i]].mean(0) for i in sel])
        wp[sel] += 0.6 * (media - wp[sel])
    gonf = np.array([GONFIA[PEZZI[r]] for r in wreg])
    for _ in range(4):   # passaggio graduale dell'imbottitura tra un pezzo e l'altro
        gonf = np.array([0.5 * gonf[i] + 0.5 * gonf[vic[i]].mean() for i in range(W)])
    wn = normali(wp, widx)
    wp += wn * gonf[:, None]
    wn = normali(wp, widx)
    pos = wp[inv]; nor = wn[inv]
    # coordinate "a cilindro" della giacca, come il vecchio busto (u = 0 fianco verso la telecamera, 0,25 petto,
    # 0,75 schiena; v dal fondo della giacca al collo). Nel modello il davanti è +z e la sinistra +x.
    sp = np.where(np.isin(np.array(ossa), ['spine_01', 'spine_03']))[0]
    zc = -0.02
    ycil = (pos[:, 1] - 0.9) / (1.55 - 0.9)
    ucil = (np.arctan2(pos[:, 2] - zc, -pos[:, 0]) / (2 * np.pi)) % 1.0
    uvcil = np.stack([ucil, np.clip(ycil, 0, 1)], 1)
    tri_reg = np.array([np.bincount(reg[tr], minlength=len(PEZZI)).argmax() for tr in idx.reshape(-1, 3)])

    J_HEAD = ossa.index('Head')
    prims = []
    def aggiungi(nome, P, N, IDX, JO, WE, UV=None, colore=None, tex=None):
        prims.append(dict(nome=nome, pos=P, nor=N, idx=IDX, joi=JO, wei=WE, uv=UV, colore=colore, tex=tex))

    for r, pz in enumerate(PEZZI):
        tri = idx.reshape(-1, 3)[tri_reg == r]
        if not len(tri): continue
        if pz == 'giacca':
            # cucitura della texture a u = 0: i triangoli a cavallo prendono copie dei vertici con u + 1
            nv = []; uvs = []; mappa = {}
            out = []
            for tr in tri:
                u = uvcil[tr, 0]; giro = (u.max() - u.min()) > 0.5
                riga = []
                for v in tr:
                    uu = uvcil[v, 0] + (1.0 if giro and uvcil[v, 0] < 0.5 else 0.0)
                    k = (v, uu > 1)
                    if k not in mappa:
                        mappa[k] = len(nv); nv.append(v); uvs.append((uu, uvcil[v, 1]))
                    riga.append(mappa[k])
                out.append(riga)
            nv = np.array(nv)
            aggiungi(pz, pos[nv], nor[nv], np.array(out).ravel(), C['joi'][nv], C['wei'][nv], np.array(uvs))
        else:
            uni, loc = np.unique(tri.ravel(), return_inverse=True)
            aggiungi(pz, pos[uni], nor[uni], loc, C['joi'][uni], C['wei'][uni], C['uv'][uni] if pz in ('testa', 'mani', 'avambracci') else None)
    # occhi e sopracciglia del modello
    for nm, pz in ((occhi_nome, 'occhi'), (sopra_nome, 'sopracciglia')):
        D = prim(g, acc, nm)
        aggiungi(pz, D['pos'], D['nor'], D['idx'], D['joi'], D['wei'], D.get('uv') if pz == 'occhi' else None)
    # capelli: tutti legati all'osso della testa
    capelli = ['Hair_SimpleParted', 'Hair_Buzzed', 'Hair_Beard'] if sesso == 'm' else ['Hair_Long', 'Hair_Buns', 'Hair_BuzzedFemale']
    for hn in capelli:
        hg, hacc = carica(os.path.join(HAIR, hn + '.gltf'))
        D = prim(hg, hacc, hg['meshes'][0]['name'])
        jo = np.zeros((len(D['pos']), 4), np.int64); jo[:, 0] = J_HEAD
        we = np.zeros((len(D['pos']), 4)); we[:, 0] = 1
        aggiungi('capelli_' + hn[5:].lower(), D['pos'], D['nor'], D['idx'], jo, we, D['uv'])

    # texture rimpicciolite
    T = os.path.join(BASE, 'Textures')
    pelle = 'T_Superhero_Male_Ligh.png' if sesso == 'm' else 'T_Superhero_Female_Light_BaseColor.png'
    def jpg(path, lato, grigio=False):
        im = Image.open(path).convert('RGB')
        if grigio:
            im = im.convert('L'); a = np.asarray(im).astype(np.float64); a = np.clip(a / max(1, np.percentile(a, 97)) * 255, 0, 255)
            im = Image.fromarray(a.astype(np.uint8)).convert('RGB')
        im = im.resize((lato, lato), Image.LANCZOS); b = io.BytesIO(); im.save(b, 'JPEG', quality=82); return b.getvalue()
    texs = {'pelle': jpg(os.path.join(T, pelle), 512), 'occhi': jpg(os.path.join(T, 'T_Eye_Brown.png'), 64),
            'capelli': jpg(os.path.join(T, 'T_Hair_1_BaseColor.png' if sesso == 'm' else 'T_Hair_2_BaseColor.png'), 256, True)}
    TEX_DI = {'testa': 'pelle', 'occhi': 'occhi'}
    for p in prims:
        p['tex'] = TEX_DI.get(p['nome']) or ('capelli' if p['nome'].startswith('capelli_') else None)
    scrivi_glb(g, joints, prims, texs, os.path.join(OUT, 'rider-' + sesso + '.glb'), acc(skin['inverseBindMatrices']))

def scrivi_glb(g, joints, prims, texs, path, ibm_src):
    blob = bytearray(); views = []; accs = []
    def push(data, target=None):
        while len(blob) % 4: blob.append(0)
        off = len(blob); blob.extend(data); v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
        if target: v['target'] = target
        views.append(v); return len(views) - 1
    def accessor(arr, ct, typ, target=None, normalized=False, minmax=False):
        a = {'bufferView': push(arr.tobytes(), target), 'componentType': ct, 'count': len(arr), 'type': typ}
        if normalized: a['normalized'] = True
        if minmax: a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
        accs.append(a); return len(accs) - 1
    # nodi: copio l'albero delle ossa con lo stesso ordine
    vecchi = {}
    def copia(i):
        if i in vecchi: return vecchi[i]
        n = g['nodes'][i]; nn = {k: n[k] for k in ('name', 'translation', 'rotation', 'scale') if k in n}
        nodes.append(nn); vecchi[i] = len(nodes) - 1
        if n.get('children'): nn['children'] = [copia(c) for c in n['children'] if 'mesh' not in g['nodes'][c]]
        return vecchi[i]
    nodes = []
    arm = [i for i, n in enumerate(g['nodes']) if n['name'] == 'Armature'][0]
    radice = copia(arm)
    skin_joints = [vecchi[j] for j in joints]
    # matrici inverse di bind: le ricalcolo dal modello (posizione di riposo)
    src_skin = g['skins'][0]
    images, textures, materials = [], [], []
    tex_idx = {}
    for k, b in texs.items():
        images.append({'bufferView': push(b), 'mimeType': 'image/jpeg', 'name': k})
        textures.append({'source': len(images) - 1, 'sampler': 0}); tex_idx[k] = len(textures) - 1
    gp = []
    for p in prims:
        mat = {'name': p['nome'], 'pbrMetallicRoughness': {'metallicFactor': 0, 'roughnessFactor': 0.75}}
        if p['tex']: mat['pbrMetallicRoughness']['baseColorTexture'] = {'index': tex_idx[p['tex']]}
        materials.append(mat)
        at = {'POSITION': accessor(p['pos'].astype(np.float32), 5126, 'VEC3', 34962, minmax=True),
              'NORMAL': accessor(p['nor'].astype(np.float32), 5126, 'VEC3', 34962),
              'JOINTS_0': accessor(p['joi'].astype(np.uint8), 5121, 'VEC4', 34962),
              'WEIGHTS_0': accessor(np.round(p['wei'] / p['wei'].sum(1, keepdims=True) * 255).astype(np.uint8), 5121, 'VEC4', 34962, normalized=True)}
        if p['uv'] is not None: at['TEXCOORD_0'] = accessor(p['uv'].astype(np.float32), 5126, 'VEC2', 34962)
        ind = accessor(p['idx'].astype(np.uint16), 5123, 'SCALAR', 34963)
        gp.append({'attributes': at, 'indices': ind, 'material': len(materials) - 1})
    # un nodo per pezzo (così ogni pezzo è un oggetto con il suo nome nel gioco)
    meshes = []
    figli = []
    for p, pr in zip(prims, gp):
        meshes.append({'name': p['nome'], 'primitives': [pr]})
        nodes.append({'name': p['nome'], 'mesh': len(meshes) - 1, 'skin': 0}); figli.append(len(nodes) - 1)
    ibm = accessor(ibm_src.astype(np.float32), 5126, 'MAT4')
    nodes[radice].setdefault('children', []).extend(figli)
    gl = {'asset': {'version': '2.0', 'generator': 'CYF prepara_rider.py (Quaternius Universal Base Characters, CC0)'},
          'scene': 0, 'scenes': [{'nodes': [radice]}], 'nodes': nodes, 'meshes': meshes, 'materials': materials,
          'skins': [{'joints': skin_joints, 'inverseBindMatrices': ibm}], 'accessors': accs, 'bufferViews': views,
          'buffers': [{'byteLength': len(blob)}], 'images': images, 'textures': textures,
          'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}]}
    while len(blob) % 4: blob.append(0)
    js = json.dumps(gl, separators=(',', ':')).encode()
    while len(js) % 4: js += b' '
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(blob), 0x004E4942) + bytes(blob)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'wb').write(out)
    print(path, len(out) // 1024, 'KB', 'triangoli', sum(len(p['idx']) // 3 for p in prims), {p['nome']: len(p['idx']) // 3 for p in prims})

for s in ('m', 'f'):
    prepara(s)
