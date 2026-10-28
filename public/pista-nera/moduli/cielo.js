// modulo: cielo
// dipende da: base
// Il cielo del gioco (R-513, prima parte, dalla 0.26.0): una sfera intorno alla telecamera con il colore che va
// dall'orizzonte allo zenit (i tre colori `sky` dello scenario), il sole con un alone morbido e due strati di nuvole
// dipinte dal programma della scheda video (niente immagini da scaricare) che scorrono piano a velocità diverse.
// Il sole è uno solo per tutto il gioco: la stessa direzione (SOLE) illumina la scena (la luce direzionale in game.js),
// disegna il disco nel cielo e corrisponde alla luce "da sinistra" con cui sono dipinte le cartoline (moduli/panorami.js).
// Prima (fino alla 0.25.5) la sfera stava in game.js, senza nuvole. Si crea con PN.cielo({ scene, telefono }) una volta sola.
// Costo: un solo oggetto da disegnare, nessuna texture; sul telefono le nuvole hanno un dettaglio in meno.
window.PN = window.PN || {};
PN.cielo = (() => {
  // da dove viene il sole, rispetto al rider: davanti a sinistra, 35° sopra l'orizzonte
  const SOLE = new THREE.Vector3(-26, 30, -34);
  // quante nuvole per scenario (0 = sereno, 1 = coperto); chi manca ha il valore base
  const NUVOLE = { base: 0.42, londra: 0.64, berlino: 0.56, francoforte: 0.55, milano: 0.5, zagabria: 0.48, parigi: 0.46, neve: 0.36, madrid: 0.3, lisbona: 0.34, napoli: 0.36 };
  const VERTICE = 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
  const frammento = ottave => [
    'uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol;',
    'uniform float time; uniform float nuvole; uniform vec3 nuvCol; uniform vec3 nuvOmbra; varying vec3 vW;',
    'float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }',   // numeri piccoli: regge anche la precisione media dei telefoni
    'float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }',
    'float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < ' + ottave + '; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.3); a *= 0.5; } return v; }',
    'void main(){',
    '  vec3 d = normalize(vW - cameraPosition);',
    '  float h = d.y;',
    '  vec3 c = h > 0.0 ? mix(mix(horizon, mid, smoothstep(0.0, 0.18, h)), top, smoothstep(0.15, 0.75, h)) : horizon;',
    '  vec3 sd = normalize(sunDir);',
    '  float s = max(dot(d, sd), 0.0);',
    // il sole: disco, alone stretto e alone largo e morbido
    '  c += sunCol * (pow(s, 900.0) * 2.0 + pow(s, 40.0) * 0.18 + pow(s, 6.0) * 0.08 + pow(s, 2.5) * 0.05);',
    '  if (h > 0.005 && nuvole > 0.01) {',
    // le nuvole stanno su un piano alto: la direzione dello sguardo lo buca in uv (più lontano verso l'orizzonte)
    '    vec2 uv = d.xz / (h + 0.08);',
    '    float n1 = fbm(uv * 0.55 + vec2(time * 0.0045, time * 0.0012));',        // strato alto, lento
    '    float n2 = fbm(uv * 1.35 + vec2(-time * 0.0105, time * 0.003) + 7.0);',  // strato basso, più veloce
    '    float soglia = 1.0 - nuvole;',
    '    float a1 = smoothstep(soglia, soglia + 0.32, n1) * 0.8;',
    '    float a2 = smoothstep(soglia + 0.06, soglia + 0.36, n2) * 0.6;',
    '    float vicino = smoothstep(0.0, 0.14, h);',                                 // verso l'orizzonte le nuvole si velano
    '    float a = clamp(a1 + a2 * (1.0 - a1 * 0.6), 0.0, 0.92) * vicino;',
    '    float luce = 0.55 + 0.45 * smoothstep(-0.2, 1.0, dot(d, sd));',             // dal lato del sole sono più chiare
    '    vec3 col = mix(nuvOmbra, nuvCol, luce);',
    '    c = mix(c, col, a);',
    '  }',
    '  gl_FragColor = vec4(min(c, vec3(1.0)), 1.0);',
    '}'
  ].join('\n');

  return ({ scene, telefono }) => {
    const { HORIZON, reduceMotion } = PN.base;
    // `?cielo=fermo` nell'indirizzo tiene ferme le nuvole: serve alle prove che confrontano le foto delle città
    const fermo = reduceMotion || new URLSearchParams(location.search).get('cielo') === 'fermo';
    const uniforms = {
      top: { value: new THREE.Color('#3f7fc4') }, mid: { value: new THREE.Color('#9cc5e6') }, horizon: { value: new THREE.Color(HORIZON) },
      sunDir: { value: SOLE.clone().normalize() }, sunCol: { value: new THREE.Color('#fff4dc') },
      time: { value: 0 }, nuvole: { value: NUVOLE.base }, nuvCol: { value: new THREE.Color('#ffffff') }, nuvOmbra: { value: new THREE.Color('#b7c3d2') }
    };
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(900, 32, 16),
      new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms, vertexShader: VERTICE, fragmentShader: frammento(telefono ? 2 : 3) })
    );
    mesh.renderOrder = -2;
    mesh.name = 'cielo';
    scene.add(mesh);

    // i colori dello scenario: T.sky = [zenit, mezzo, orizzonte]; T.nuvole (0-1) se lo scenario vuole più o meno nuvole
    function applica(nome, T) {
      uniforms.top.value.set(T.sky[0]); uniforms.mid.value.set(T.sky[1]); uniforms.horizon.value.set(T.sky[2]);
      uniforms.nuvole.value = T.nuvole != null ? T.nuvole : (NUVOLE[nome] != null ? NUVOLE[nome] : NUVOLE.base);
      // le nuvole prendono la luce del sole dello scenario e, nell'ombra, il colore di mezzo del cielo
      uniforms.nuvCol.value.set(T.sun || '#fff4dc').lerp(new THREE.Color('#ffffff'), 0.5);
      uniforms.nuvOmbra.value.set(T.sky[1]).lerp(new THREE.Color('#ffffff'), 0.35);
    }
    // ogni fotogramma: il cielo segue la telecamera e le nuvole avanzano (ferme se il telefono chiede meno movimento o
    // se l'indirizzo ha ?cielo=fermo)
    function aggiorna(dt, camera) {
      mesh.position.copy(camera.position);
      if (!fermo) uniforms.time.value += dt;
    }
    return { mesh, SOLE, applica, aggiorna };
  };
})();
