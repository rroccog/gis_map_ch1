// Popup con pestañas: al hacer clic muestra una pestaña por cada capa visible que haya bajo el cursor.
// Script clásico: usa las variables globales del script principal (map, items, meta, activas, idsActivos).
// IMPORTANTE: borra el map.on("click", ...) que ya tienes en tu script principal, o saldrán dos popups.
// Cárgalo DESPUÉS del script principal:  <script src="scripts/popup.js"></script>
// Los estilos (.pu-*) van en tu archivo CSS (ver popup.css).
(function () {
  let ultima = null;   // capa cuya pestaña se vio por última vez: se vuelve a elegir si aparece de nuevo

  const el = (tag, clase, texto) => {
    const e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  };
  const nombre = source => meta[source].capa.replaceAll("_", " ");
  const muestra = source => {
    const it = items.find(i => i.key === source);
    return it ? (it.sim ? it.sim.muestra : it.color) : "#888";
  };

  // Tabla de atributos; el campo de la simbología (column_info) va primero
  function tabla(f, campo) {
    const filas = Object.entries(f.properties).sort((a, b) => (b[0] === campo) - (a[0] === campo));
    const t = el("table", "pu-tabla");
    filas.forEach(([k, v]) => {
      const tr = el("tr");
      tr.append(el("th", null, k), el("td", null, v === null || v === "" ? "—" : String(v)));
      t.append(tr);
    });
    return t;
  }

  map.on("click", e => {
    if (!activas.size) return;

    // Una entidad por capa, de arriba hacia abajo según el orden de dibujo
    const vistas = new Set(), feats = [];
    for (const f of map.queryRenderedFeatures(e.point, { layers: idsActivos() })) {
      if (!vistas.has(f.source)) { vistas.add(f.source); feats.push(f); }
    }
    if (!feats.length) return;

    const caja = el("div");
    const cuerpo = el("div", "pu-cuerpo");
    const mostrar = i => {
      ultima = feats[i].source;
      caja.querySelectorAll(".pu-tab").forEach((b, j) => b.classList.toggle("on", j === i));
      cuerpo.replaceChildren(tabla(feats[i], meta[feats[i].source].campo));
    };

    if (feats.length > 1) {
      const barra = el("div", "pu-tabs");
      feats.forEach((f, i) => {
        const b = el("button", "pu-tab");
        b.type = "button";
        b.append(nombre(f.source));
        b.addEventListener("click", () => mostrar(i));
        barra.append(b);
      });
      caja.append(barra);
    } else {
      caja.append(el("div", "pu-tit", nombre(feats[0].source)));
    }
    caja.append(cuerpo);
    mostrar(Math.max(0, feats.findIndex(f => f.source === ultima)));

    new maplibregl.Popup({ maxWidth: "340px" }).setLngLat(e.lngLat).setDOMContent(caja).addTo(map);
  });
})();