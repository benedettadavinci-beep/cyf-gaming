// modulo: sfondi
// dipende da: panorami
// Sfondi lontani delle città (R-405, dalla 0.20.0): la veduta classica di ogni città dipinta come una cartolina in alta
// risoluzione (moduli/panorami.js) e montata su mezzo cilindro intorno alla telecamera, con il monumento dritto in fondo
// alla discesa (R-308). Sotto c'è un disco del colore del suolo lontano (o del mare). Prima (fino alla 0.19.0) erano
// blocchi 3D a tinta unita, costruiti uno per uno.
// Dalla 0.26.0 (R-513, prima parte) la cartolina è in due piani: i monti lontani su un cilindro che segue la telecamera
// come il cielo (è "all'infinito") e la città con il monumento su un cilindro fermo sull'asse della strada: quando il
// rider si sposta a destra o a sinistra la città scorre un poco rispetto ai monti e la cartolina ha profondità. Il disco
// del suolo lontano sfuma dal colore della nebbia della pista a quello della terra o del mare, così non c'è una linea
// netta tra pista e sfondo. Anche la Neve ha la sua cartolina (prima aveva solo coni 3D).
// Dipingere una città costa qualche decimo di secondo: se il browser lo permette si dipinge in un worker (un'altra
// "corsia" del processore), così il gioco non si ferma; intanto si vede solo il cielo e, appena pronta, la cartolina.
// Se il worker non c'è o sbaglia, si dipinge nella pagina come prima. `?pittore=pagina` nell'indirizzo lo forza (prove e
// diagnosi). Si tengono in memoria al massimo due città (ogni città occupa ~15 MB sulla scheda video: ~14 la città e ~1
// i monti, dipinti a un quarto della larghezza; sul telefono ~3,8 MB).
// Si crea con PN.sfondi({ scene, telefono }) una volta sola, dal gioco.
window.PN = window.PN || {};
PN.sfondi = (() => {
  // dove sono i file dei moduli: servono al worker, che li ricarica per conto suo
  const QUI = document.currentScript ? document.currentScript.src : location.href;
  return ({ scene, telefono }) => {
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
            try { const r = PN.panorami.dipingiPiani(nome, W, cielo); const bmp = r.vicino.transferToImageBitmap();
              const lontano = r.lontano ? r.lontano.transferToImageBitmap() : null;
              postMessage({ id, bmp, lontano }, lontano ? [bmp, lontano] : [bmp]); }
            catch (err) { postMessage({ id, errore: String(err) }); } };`;
        const w = new Worker(URL.createObjectURL(new Blob([codice], { type: 'text/javascript' })));
        w.onmessage = e => { const f = attese.get(e.data.id); attese.delete(e.data.id); if (f) f(e.data); };
        w.onerror = () => { lavoro = false; for (const f of attese.values()) f({ errore: 'worker' }); attese.clear(); };
        lavoro = w;
      } catch (e) { lavoro = false; }
      return lavoro;
    }
    // dipinge la città e chiama fatto({ bmp, lontano }): nel worker se si può, altrimenti subito qui
    function dipingi(name, cielo, fatto) {
      const qui = () => { const r = PAN.dipingiPiani(name, LARGHEZZA, cielo); return { bmp: r.vicino, lontano: r.lontano }; };
      const w = worker();
      if (!w) { fatto(qui()); return; }
      const id = prossimo++;
      attese.set(id, r => fatto(r.bmp ? r : qui()));
      w.postMessage({ id, nome: name, W: LARGHEZZA, cielo });
    }

    // mezzo cilindro aperto davanti alla telecamera (verso −z), da destra (θ = π/2) a sinistra (θ = 3π/2)
    function cilindro(raggio, ordine) {
      const geo = new THREE.CylinderGeometry(raggio, raggio, G.alto - G.basso, 96, 1, true, Math.PI - G.arco / 2, G.arco);
      const uv = geo.attributes.uv;
      // nel cilindro l'angolo cresce verso sinistra, sulla tela verso destra; la tela non si capovolge (flipY = false,
      // come vuole un'immagine che arriva dal worker), quindi si capovolge qui la coordinata verticale
      for (let i = 0; i < uv.count; i++) uv.setXY(i, 1 - uv.getX(i), 1 - uv.getY(i));
      const mat = new THREE.MeshBasicMaterial({ transparent: true, fog: false, side: THREE.DoubleSide, depthWrite: false });
      const m = new THREE.Mesh(geo, mat);
      m.position.y = (G.alto + G.basso) / 2;
      m.renderOrder = ordine;
      m.visible = false;   // finché la cartolina non è pronta si vede solo il cielo
      return m;
    }
    function texture(img) {
      const tex = new THREE.Texture(img);
      tex.flipY = false;
      tex.encoding = THREE.sRGBEncoding;
      tex.anisotropy = 1;   // la cartolina si guarda di fronte: il filtro anisotropo non migliorerebbe niente
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.needsUpdate = true;
      return tex;
    }
    // il disco del suolo lontano: al centro il colore della nebbia della pista, verso il bordo quello della terra o del
    // mare della città, così la fine della pista sfuma nella cartolina senza una riga (R-513, punto 4)
    function suolo(name, cielo) {
      const terra = PAN.terra(name, cielo.nebbia), nebbia = cielo.nebbia || terra;
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      gr.addColorStop(0, nebbia); gr.addColorStop(0.22, nebbia); gr.addColorStop(0.6, terra); gr.addColorStop(1, terra);
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      const tex = new THREE.CanvasTexture(c);
      tex.encoding = THREE.sRGBEncoding;
      const disco = new THREE.Mesh(new THREE.CircleGeometry(1150, 64), new THREE.MeshBasicMaterial({ map: tex, fog: false }));
      disco.rotation.x = -Math.PI / 2;
      disco.position.y = G.basso;
      disco.name = 'suolo';
      return disco;
    }

    function costruisci(name, cielo) {
      if (!PAN.citta.includes(name)) return null;
      const g = new THREE.Group();   // il piano vicino: città e monumento, fermo sull'asse della strada
      const pano = cilindro(G.raggio, -1);
      pano.name = 'panorama';
      const disco = suolo(name, cielo);
      g.add(disco, pano);
      // il piano lontano: i monti, su un cilindro appena più largo che segue la telecamera (sta dietro al vicino)
      const monti = cilindro(G.raggio + 20, -1.5);
      monti.name = 'monti';
      const gL = new THREE.Group();
      gL.add(monti);
      g.visible = gL.visible = false;
      g.userData.pronto = false;
      g.userData.lontano = gL;
      scene.add(g, gL);
      builtSky[name] = g;   // prima di dipingere: senza worker la cartolina arriva subito
      dipingi(name, cielo, r => {
        const chiudi = img => { if (img && img.close) img.close(); };
        if (builtSky[name] !== g) { chiudi(r.bmp); chiudi(r.lontano); return; }   // nel frattempo la città è uscita dalla memoria
        pano.material.map = texture(r.bmp); pano.material.needsUpdate = true;
        pano.visible = true;
        if (r.lontano) { monti.material.map = texture(r.lontano); monti.material.needsUpdate = true; monti.visible = true; }
        g.userData.pronto = true;
      });
      return g;
    }
    function butta(o) {
      o.traverse(x => {
        if (x.geometry) x.geometry.dispose();
        if (x.material) { const m = x.material.map; if (m) { if (m.image && m.image.close) m.image.close(); m.dispose(); } x.material.dispose(); }
      });
    }
    function libera(name) {
      const g = builtSky[name];
      if (!g) return;
      delete builtSky[name];
      scene.remove(g);
      butta(g);
      const gL = g.userData.lontano;
      if (gL) { scene.remove(gL); butta(gL); }
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
    // c'è una cartolina per questo scenario?
    const ha = name => PAN.citta.includes(name);
    // mostra solo la città "name" (o nessuna), e accende insieme il suo piano lontano
    function mostra(name) {
      for (const k in builtSky) { const v = k === name; builtSky[k].visible = v; if (builtSky[k].userData.lontano) builtSky[k].userData.lontano.visible = v; }
    }
    // ogni fotogramma: i monti seguono la telecamera (sono all'infinito), la città resta sull'asse della strada
    // (xStrada: la x del centro della strada all'altezza della telecamera), così il rider spostandosi la vede scorrere
    // un poco rispetto ai monti (R-513, punto 2)
    function segui(name, camera, xStrada) {
      const g = builtSky[name];
      if (!g) return;
      const gL = g.userData.lontano;
      if (gL) gL.position.copy(camera.position);
      g.position.copy(camera.position);
      if (typeof xStrada === 'number' && isFinite(xStrada)) g.position.x = xStrada;
    }

    // chi dipinge le cartoline: 'worker', 'pagina' o '-' se non se n'è ancora dipinta nessuna (per la diagnosi)
    const pittore = () => (lavoro === null ? '-' : lavoro ? 'worker' : 'pagina');
    return { builtSky, skylineFor, ha, mostra, segui, pittore };
  };
})();
