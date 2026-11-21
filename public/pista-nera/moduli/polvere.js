// modulo: polvere
// dipende da: base
// R-513, seconda parte (riga 4 dei prossimi passi, dalla 0.38.0): polvere di neve. Sulla pista di neve, dietro la tavola
// si alza una nuvola di neve fine, morbida e trasparente, che si allarga e sparisce in 1-1,6 s: poca quando si va dritti
// veloci (da 8 m/s in su), di più curvando forte, uno sbuffo all'atterraggio e alla caduta. È in più degli spruzzi
// piccoli di `effetti` (quelli restano uguali). Solo grafica, niente stato di gioco: non cambia niente nella guida.
// Effetto pesante solo dove il dispositivo regge (R-513): qualità alta tutta, media metà, bassa niente; niente polvere
// se il dispositivo chiede meno movimento, nelle città (asfalto) e quando non si gioca (menu, conto alla rovescia).
// Si crea con PN.polvere({ world, hgt, renderer, stato, grafica }) una volta sola, dal gioco; il gioco chiama passo(dt)
// a ogni fotogramma. stato dà P, mode e theme; grafica è la qualità automatica (dà livello).
window.PN = window.PN || {};
PN.polvere = ({ world, hgt, renderer, stato, grafica }) => {
  const { isPhone, rand, reduceMotion } = PN.base;
  const N = isPhone ? 70 : 160;                     // particelle al massimo (nuvole morbide e grandi: ne servono poche)
  const QUANTA = { alta: 1, media: 0.5, bassa: 0 };  // quanta polvere per livello di qualità (A-14)
  const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), vita = new Float32Array(N), durata = new Float32Array(N);
  const misura = new Float32Array(N), alfa = new Float32Array(N), m0 = new Float32Array(N);
  for (let i = 0; i < N; i++) pos[i * 3 + 1] = -999;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aMisura', new THREE.BufferAttribute(misura, 1));
  geo.setAttribute('aAlfa', new THREE.BufferAttribute(alfa, 1));
  // punti con misura vera in metri (uguale su ogni schermo) e trasparenza propria: bordo sfumato, niente immagini
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColore: { value: new THREE.Color('#e4edf7') }, uAltezza: { value: 600 } },
    vertexShader: 'attribute float aMisura; attribute float aAlfa; uniform float uAltezza; varying float vA;\n' +
      'void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vA = aAlfa;\n' +
      '  gl_PointSize = aMisura * projectionMatrix[1][1] * uAltezza * 0.5 / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColore; varying float vA;\n' +
      'void main() { vec2 d = gl_PointCoord - 0.5; float r = dot(d, d) * 4.0; if (r > 1.0 || vA <= 0.0) discard;\n' +
      '  float a = vA * (1.0 - r) * (1.0 - r); gl_FragColor = vec4(uColore, a); }',
    transparent: true, depthWrite: false
  });
  const punti = new THREE.Points(geo, mat);
  punti.frustumCulled = false;
  punti.renderOrder = 2;
  world.add(punti);
  const buf = new THREE.Vector2();
  let prossima = 0, accumulo = 0, eraInAria = false, vyAria = 0, eraCaduto = false, vive = 0, nate = 0, nateAlGiro = 0;

  // una nuvoletta in (x, z) sulla neve: forza = quanto si allarga e sale, lato = spinta di lato (curva)
  function nuvola(x, z, forza, lato) {
    const i = prossima; prossima = (prossima + 1) % N;
    const o = i * 3, suolo = hgt(x, z);
    pos[o] = x + rand(-0.3, 0.3); pos[o + 1] = suolo + rand(0.05, 0.3); pos[o + 2] = z + rand(-0.2, 0.4);
    vel[o] = rand(-0.8, 0.8) * forza + lato; vel[o + 1] = rand(0.5, 1.4) * forza; vel[o + 2] = rand(0, 1.6) * forza;
    durata[i] = vita[i] = rand(1.0, 1.6);
    m0[i] = rand(0.5, 0.9) * (0.8 + 0.3 * forza);
    nate++; nateAlGiro++;
  }
  function sbuffo(x, z, n, forza) { for (let k = 0; k < n; k++) nuvola(x, z, forza, 0); }

  function passo(dt) {
    const P = stato.P, mode = stato.mode;
    const quanta = reduceMotion || stato.theme !== 'neve' ? 0 : (QUANTA[grafica.livello] ?? 1);
    if (P && quanta > 0 && (mode === 'solo' || mode === 'race' || mode === 'finished')) {
      const aTerra = !P.air && !P.onRamp && P.crash <= 0;
      // atterraggio: sbuffo più grande se si arriva giù forte (vy prima di toccare terra)
      if (eraInAria && !P.air && P.crash <= 0) sbuffo(P.x, P.z, Math.round((5 + Math.min(1, Math.abs(vyAria) / 14) * 9) * quanta), 1.3);
      if (P.crash > 0 && !eraCaduto) sbuffo(P.x, P.z, Math.round(14 * quanta), 1.6);
      if (aTerra && P.speed > 8) {
        const curva = Math.max(0, Math.abs(P.ang) - 0.3);
        accumulo += ((P.speed - 8) * 0.6 + curva * 34) * quanta * dt;   // nuvolette al secondo: ~7 dritti a 20 m/s, ~25 in curva forte
        const lato = Math.sign(P.ang) * Math.min(1.5, curva * 2.5);
        while (accumulo >= 1) { accumulo -= 1; nuvola(P.x, P.z, 0.8 + curva, lato); }
      } else accumulo = 0;
    }
    if (P) { if (P.air) vyAria = P.vy; eraInAria = !!P.air; eraCaduto = P.crash > 0; }
    // movimento: l'aria frena la neve, che sale piano, si allarga e sparisce
    const attrito = Math.pow(0.9, dt * 60), cerano = vive;
    vive = 0;
    for (let i = 0; i < N; i++) {
      if (vita[i] <= 0) continue;
      vita[i] -= dt;
      if (vita[i] <= 0) { pos[i * 3 + 1] = -999; alfa[i] = 0; continue; }
      vive++;
      const o = i * 3, k = 1 - vita[i] / durata[i];   // 0 appena nata → 1 alla fine
      vel[o] *= attrito; vel[o + 1] = vel[o + 1] * attrito - 0.4 * dt; vel[o + 2] *= attrito;
      pos[o] += vel[o] * dt; pos[o + 1] += vel[o + 1] * dt; pos[o + 2] += vel[o + 2] * dt;
      misura[i] = m0[i] * (1 + 2.2 * k);
      alfa[i] = 0.42 * Math.min(1, k * 8) * Math.pow(1 - k, 1.5);
    }
    if (vive || cerano || nateAlGiro) {
      nateAlGiro = 0;
      renderer.getDrawingBufferSize(buf); mat.uniforms.uAltezza.value = buf.y;
      geo.attributes.position.needsUpdate = true; geo.attributes.aMisura.needsUpdate = true; geo.attributes.aAlfa.needsUpdate = true;
    }
    punti.visible = vive > 0;
  }
  // per le prove e la diagnosi: quante nuvolette sono in aria ora e quante ne sono nate dall'apertura
  const conta = () => ({ vive, nate, max: N });
  return { passo, conta, punti };
};
