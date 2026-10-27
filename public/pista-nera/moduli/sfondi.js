// modulo: sfondi
// dipende da: base, panorami
// Sfondi lontani delle città (R-405, dalla 0.20.0): la veduta classica di ogni città dipinta come una cartolina in alta
// risoluzione (moduli/panorami.js) e montata su mezzo cilindro intorno alla telecamera, con il monumento dritto in fondo
// alla discesa (R-308). Sotto c'è un disco del colore del suolo lontano (o del mare). Seguono la telecamera come il cielo:
// non si attraversano mai. Prima (fino alla 0.19.0) erano blocchi 3D a tinta unita, costruiti uno per uno.
// Dipingere una città costa qualche decimo di secondo: se il browser lo permette si dipinge in un worker (un'altra
// "corsia" del processore), così il gioco non si ferma; intanto si vede solo il cielo e, appena pronta, la cartolina.
// Se il worker non c'è o sbaglia, si dipinge nella pagina come prima. `?pittore=pagina` nell'indirizzo lo forza (prove e
// diagnosi). Si tengono in memoria al massimo due città
// (ogni tela occupa ~14 MB sulla scheda video, ~3,5 MB sul telefono).
// Si crea con PN.sfondi({ scene, telefono }) una volta sola, dal gioco.
window.PN = window.PN || {};
PN.sfondi = (() => {
  // dove sono i file dei moduli: servono al worker, che li ricarica per conto suo
  const QUI = document.currentScript ? document.currentScript.src : location.href;
  return ({ scene, telefono }) => {
    const { lin } = PN.base;
    const PAN = PN.panorami, G = PAN.GEOMETRIA;
    const LARGHEZZA = telefono ? 2048 : 4096;   // pixel della tela su 180°: sul computer ~1 pixel della tela per pixel dello schermo
    const TENUTE = 2;
    const builtSky = {};   // città → gruppo (si svuota quando una città esce dalla memoria)
    const ordine = [];     // città costruite, l'ultima usata in fondo

    // ---------- il pittore nel worker ----------
    const scelta = new URLSearchParams(location.search).get('pittore');
    let lavoro = null, attese = new Map(), prossimo = 1;
    function worker() {
      if (lavoro !== null) return lavoro;
      lavoro = false;
      if (scelta === 'pagina') return false;
      try {
        if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || !('transferToImageBitmap' in OffscreenCanvas.prototype)) return false;
        const file = n => new URL(n, QUI).href;
        const codice = `self.window = self; importScripts(${JSON.stringify(file('base.js'))}, ${JSON.stringify(file('panorami.js'))});
          onmessage = e => { const { id, nome, W, cielo } = e.data;
            try { const t = PN.panorami.dipingi(nome, W, cielo); const bmp = t.transferToImageBitmap(); postMessage({ id, bmp }, [bmp]); }
            catch (err) { postMessage({ id, errore: String(err) }); } };`;
        const w = new Worker(URL.createObjectURL(new Blob([codice], { type: 'text/javascript' })));
        w.onmessage = e => { const f = attese.get(e.data.id); attese.delete(e.data.id); if (f) f(e.data); };
        w.onerror = () => { lavoro = false; for (const f of attese.values()) f({ errore: 'worker' }); attese.clear(); };
        lavoro = w;
      } catch (e) { lavoro = false; }
      return lavoro;
    }
    // dipinge la città e chiama fatto(immagine): nel worker se si può, altrimenti subito qui
    function dipingi(name, cielo, fatto) {
      const w = worker();
      if (!w) { fatto(PAN.dipingi(name, LARGHEZZA, cielo)); return; }
      const id = prossimo++;
      attese.set(id, r => fatto(r.bmp || PAN.dipingi(name, LARGHEZZA, cielo)));
      w.postMessage({ id, nome: name, W: LARGHEZZA, cielo });
    }

    function costruisci(name, cielo) {
      if (!PAN.citta.includes(name)) return null;
      const g = new THREE.Group();
      // mezzo cilindro aperto davanti alla telecamera (verso −z), da destra (θ = π/2) a sinistra (θ = 3π/2)
      const geo = new THREE.CylinderGeometry(G.raggio, G.raggio, G.alto - G.basso, 96, 1, true, Math.PI - G.arco / 2, G.arco);
      const uv = geo.attributes.uv;
      // nel cilindro l'angolo cresce verso sinistra, sulla tela verso destra; la tela non si capovolge (flipY = false,
      // come vuole un'immagine che arriva dal worker), quindi si capovolge qui la coordinata verticale
      for (let i = 0; i < uv.count; i++) uv.setXY(i, 1 - uv.getX(i), 1 - uv.getY(i));
      const mat = new THREE.MeshBasicMaterial({ transparent: true, fog: false, side: THREE.DoubleSide, depthWrite: false });
      const pano = new THREE.Mesh(geo, mat);
      pano.position.y = (G.alto + G.basso) / 2;
      pano.renderOrder = -1;
      pano.name = 'panorama';
      pano.visible = false;   // finché la cartolina non è pronta si vede solo il cielo
      // il suolo lontano (o il mare) sotto la cartolina, fino all'orizzonte del cielo
      const disco = new THREE.Mesh(new THREE.CircleGeometry(1150, 64), new THREE.MeshBasicMaterial({ color: lin(PAN.terra(name, cielo.nebbia)), fog: false }));
      disco.rotation.x = -Math.PI / 2;
      disco.position.y = G.basso;
      g.add(disco, pano);
      g.visible = false;
      g.userData.pronto = false;
      scene.add(g);
      builtSky[name] = g;   // prima di dipingere: senza worker la cartolina arriva subito
      dipingi(name, cielo, img => {
        if (builtSky[name] !== g) { if (img && img.close) img.close(); return; }   // nel frattempo la città è uscita dalla memoria
        const tex = new THREE.Texture(img);
        tex.flipY = false;
        tex.encoding = THREE.sRGBEncoding;
        tex.anisotropy = 1;   // la cartolina si guarda di fronte: il filtro anisotropo non migliorerebbe niente
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.needsUpdate = true;
        mat.map = tex; mat.needsUpdate = true;
        pano.visible = true;
        g.userData.pronto = true;
      });
      return g;
    }
    function libera(name) {
      const g = builtSky[name];
      if (!g) return;
      delete builtSky[name];
      scene.remove(g);
      g.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { const m = o.material.map; if (m) { if (m.image && m.image.close) m.image.close(); m.dispose(); } o.material.dispose(); }
      });
    }
    // il gruppo della città (costruito se serve); cielo: { orizzonte, nebbia } i colori del cielo all'orizzonte e della
    // nebbia della pista, per la foschia della distanza e il passaggio dalla pista alla cartolina
    function skylineFor(name, cielo = {}) {
      if (!builtSky[name] && !costruisci(name, cielo)) return null;
      const i = ordine.indexOf(name);
      if (i >= 0) ordine.splice(i, 1);
      ordine.push(name);
      while (ordine.length > TENUTE) libera(ordine.shift());
      return builtSky[name];
    }

    // chi dipinge le cartoline: 'worker', 'pagina' o '-' se non se n'è ancora dipinta nessuna (per la diagnosi)
    const pittore = () => (lavoro === null ? '-' : lavoro ? 'worker' : 'pagina');
    return { builtSky, skylineFor, pittore };
  };
})();
