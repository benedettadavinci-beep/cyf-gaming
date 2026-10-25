// modulo: geometria
// dipende da: base
// Forme di base condivise da tutti gli scenari: unione di pezzi colorati (merge), sassi (lumpy), abete, roccia,
// cristallo, palina, rampa della neve (GEO) e porta (gateGeo). Solo geometria: niente scena, niente stato di gioco.
window.PN = window.PN || {};
PN.geometria = (() => {
  const { TAU, lin, mulberry32 } = PN.base;
  // ---------- shared geometry ----------
  function merge(parts) {
    const pos = [], nor = [], col = [];
    for (const p of parts) {
      const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
      if (p.sx) g.scale(p.sx, p.sy, p.sz);
      if (p.ry) g.rotateY(p.ry);
      g.translate(p.x || 0, p.y || 0, p.z || 0);
      const pa = g.attributes.position.array, na = g.attributes.normal.array;
      const c = lin(p.color);
      for (let i = 0; i < pa.length; i += 3) { pos.push(pa[i], pa[i + 1], pa[i + 2]); nor.push(na[i], na[i + 1], na[i + 2]); col.push(c.r, c.g, c.b); }
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    out.computeBoundingSphere();
    return out;
  }
  function lumpy(g, amt, rr) {
    const p = g.attributes.position;
    const seen = new Map();
    for (let i = 0; i < p.count; i++) {
      const key = p.getX(i).toFixed(3) + ',' + p.getY(i).toFixed(3) + ',' + p.getZ(i).toFixed(3);
      if (!seen.has(key)) seen.set(key, 1 + (rr() * 2 - 1) * amt);
      const k = seen.get(key);
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    return g;
  }
  // illuminazione calcolata per pixel (più morbida della vecchia per vertice)
  const vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  function spruce(slim) {
    const parts = [{ geo: new THREE.CylinderGeometry(0.12, 0.2, 1.4, 6), color: '#4a3020', y: 0.7 }];
    const tiers = 6;
    for (let i = 0; i < tiers; i++) {
      const f = i / (tiers - 1);
      const r = (1.75 - f * 1.35) * (slim ? 0.78 : 1), h = 1.5 - f * 0.55, y = 1.3 + f * 4.2;
      const green = ['#142f24', '#17372a', '#1a3e2f', '#1d4533', '#204c38', '#22533c'][i];
      parts.push({ geo: new THREE.ConeGeometry(r, h, 11), color: green, y: y + h / 2, ry: i * 0.6 });
      parts.push({ geo: new THREE.ConeGeometry(r * 0.78, h * 0.32, 11), color: '#f1f6fa', y: y + h * 0.62, ry: i * 0.6 + 0.3 });
    }
    parts.push({ geo: new THREE.ConeGeometry(0.22, 0.6, 6), color: '#f1f6fa', y: 6.2 });
    parts.push({ geo: new THREE.SphereGeometry(1.1, 8, 4, 0, TAU, 0, Math.PI / 2), color: '#e9f1f7', sx: 1, sy: 0.25, sz: 1, y: -0.05 });
    return merge(parts);
  }
  const geoRng = mulberry32(11);
  const GEO = {
    trees: [spruce(false), spruce(true)],
    rock: merge([
      { geo: lumpy(new THREE.IcosahedronGeometry(1, 1), 0.18, geoRng), color: '#5f6b7a', sx: 1.2, sy: 0.7, sz: 1.0, y: 0.3 },
      { geo: lumpy(new THREE.IcosahedronGeometry(0.85, 1), 0.12, geoRng), color: '#f2f6fa', sx: 1.15, sy: 0.3, sz: 0.9, y: 0.78, x: -0.12 }
    ]),
    // in città le rocce non hanno la neve sopra
    rockCity: merge([
      { geo: lumpy(new THREE.IcosahedronGeometry(1, 2), 0.16, mulberry32(12)), color: '#7d766d', sx: 1.2, sy: 0.75, sz: 1.0, y: 0.3 },
      { geo: lumpy(new THREE.IcosahedronGeometry(0.55, 1), 0.2, mulberry32(13)), color: '#8e877c', sx: 1.0, sy: 0.7, sz: 0.9, y: 0.5, x: 0.55, z: 0.2 }
    ]),
    marker: merge([
      { geo: new THREE.CylinderGeometry(0.045, 0.045, 1.6, 6), color: '#0f1824', y: 0.8 },
      { geo: new THREE.CylinderGeometry(0.055, 0.055, 0.3, 6), color: '#ff5a1f', y: 1.5 },
      { geo: new THREE.CylinderGeometry(0.2, 0.28, 0.12, 8), color: '#e9f1f7', y: 0.02 }
    ]),
    ramp: (() => {
      const shape = new THREE.Shape();
      shape.moveTo(-0.6, 0); shape.lineTo(4, 0); shape.lineTo(4, 1.1); shape.quadraticCurveTo(1.6, 0.55, -0.6, 0);
      const g = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: true, bevelSize: 0.25, bevelThickness: 0.25, bevelSegments: 2, curveSegments: 6 });
      g.translate(-2, 0, -1.5);
      g.rotateY(Math.PI / 2);
      return merge([{ geo: g, color: '#dfeaf3' }, { geo: new THREE.BoxGeometry(3.3, 0.06, 0.12), color: '#2f7fd0', y: 1.18, z: -2 }]);
    })()
  };
  // bandierina di un colore solo, oppure a scacchi (due colori: Zagabria)
  function gateGeo(color) {
    const parts = [];
    for (const s of [-1, 1]) {
      const px = s * 2.4;
      parts.push({ geo: new THREE.CylinderGeometry(0.03, 0.03, 1.9, 6), color: '#f4f6f8', x: px, y: 0.95 });
      if (Array.isArray(color)) {
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) parts.push({ geo: new THREE.BoxGeometry(0.2125, 0.2, 0.02), color: color[(i + j) % 2], x: px - s * 0.45 - 0.31875 + i * 0.2125, y: 1.65 - j * 0.2, z: 0 });
      } else parts.push({ geo: new THREE.BoxGeometry(0.85, 0.6, 0.02), color, x: px - s * 0.45, y: 1.45 });
    }
    return merge(parts);
  }
  return { merge, lumpy, vcMat, GEO, gateGeo };
})();
