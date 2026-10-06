function obtenerGeoJSON(item) {
  if (!cache.has(item.capa)) {
    const p = fetch(`${API_BASE}/capas/${encodeURIComponent(item.capa)}`).then(r => {
      if (!r.ok) throw new Error(r.status === 404 ? "capa no disponible" : "API " + r.status);
      return r.json();
    });
    p.catch(() => cache.delete(item.capa)); // si falla, se podrá reintentar
    cache.set(item.capa, p);
  }
  return cache.get(item.capa);
}

function setHover(source, id) {
  if (hover) map.setFeatureState(hover, { hover: false });
  hover = source ? { source, id } : null;
  if (hover) map.setFeatureState(hover, { hover: true });
}

function idsActivos() {
  return [...activas].flatMap(k => SUFIJOS.map(s => `${k}-${s}`));
}

function visible(k, v) {
  SUFIJOS.forEach(s => map.setLayoutProperty(`${k}-${s}`, "visibility", v ? "visible" : "none"));
  if (v) activas.add(k);
  else { activas.delete(k); setHover(null); tooltip.remove(); }
}

// Orden de dibujo según "zindex" (mayor = más arriba). El orden del menú es aparte ("orden").
// La capa nueva se inserta justo debajo de la siguiente capa con zindex mayor que ya esté en el mapa.
function antesDe(item) {
  for (let j = porZ.indexOf(item) + 1; j < porZ.length; j++) {
    const id = `${porZ[j].key}-relleno`;
    if (map.getLayer(id)) return id;
  }
  return undefined;
}

function agregarCapa(item, geojson) {
  const k = item.key, antes = antesDe(item);
  const sim = crearSimbologia(item, geojson);
  item.sim = sim;
  if (item.sw) item.sw.style.background = sim.muestra;
  const c = sim.color;
  const h = ["boolean", ["feature-state", "hover"], false];
  map.addSource(k, { type: "geojson", data: geojson, generateId: true });
  map.addLayer({
    id: `${k}-relleno`, type: "fill", source: k, filter: ["==", "$type", "Polygon"],
    paint: { "fill-color": c, "fill-opacity": ["case", h, 0.8, 0.5] }
  }, antes);
  map.addLayer({
    id: `${k}-lineas`, type: "line", source: k, filter: ["in", "$type", "Polygon", "LineString"],
    paint: { "line-color": c, "line-width": ["case", h, 3, 1.5] }
  }, antes);
  map.addLayer({
    id: `${k}-puntos`, type: "circle", source: k, filter: ["==", "$type", "Point"],
    paint: {
      "circle-radius": ["case", h, 7, 4], "circle-color": c,
      "circle-stroke-width": 1, "circle-stroke-color": "#212121"
    }
  }, antes);
}

async function alternar(item, cb, est) {
  const k = item.key;
  if (!cb.checked) { if (map.getSource(k)) visible(k, false); return; }

  // Flag de "ya cargada": si la fuente existe en el mapa, solo se vuelve a mostrar
  if (!map.getSource(k)) {
    est.className = "est";
    est.textContent = "cargando…";
    try {
      const gj = await obtenerGeoJSON(item);
      if (!map.getSource(k)) {
        agregarCapa(item, gj);
        const b = new maplibregl.LngLatBounds();
        gj.features.forEach(f => extender(f.geometry.coordinates, b));
        if (cb.checked && !b.isEmpty()) map.fitBounds(b, { padding: 60, maxZoom: 16 });
      }
      est.textContent = "";
    } catch (e) {
      console.error(e);
      cb.checked = false;
      est.className = "est err";
      est.textContent = e.message;
      return;
    }
  }
  visible(k, cb.checked);
}