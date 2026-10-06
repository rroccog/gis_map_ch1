// Control de MapLibre para cambiar el mapa base (botón arriba a la derecha, bajo el zoom).
// Para agregar o quitar opciones, edita la lista BASEMAPS.
// Script clásico: usa la variable global map. Cárgalo DESPUÉS del script principal:
//   <script src="scripts/basemaps.js"></script>
// Los estilos (.mb-*) van en tu archivo CSS (ver basemaps.css).
(function () {
  const BASEMAPS = [
    { id: "osm", nombre: "Calles",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      attribution: "© OpenStreetMap", maxzoom: 19 },
    { id: "sat", nombre: "Satélite",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      attribution: "Esri, Maxar, Earthstar Geographics", maxzoom: 19 },
    // Mismas imágenes satelitales, sin color: no hace peticiones extra
    { id: "sat-bn", nombre: "Satélite B/N", fuente: "sat", saturacion: -1 }
  ];
  const INICIAL = "osm";

  const el = (tag, clase, texto) => {
    const e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  };

  class MapasBase {
    onAdd(map) {
      this._map = map;
      this._activo = INICIAL;
      this._listo = false;

      this._el = el("div", "maplibregl-ctrl maplibregl-ctrl-group mb-ctrl");
      const btn = el("button");
      btn.type = "button";
      btn.title = "Mapa base";
      btn.setAttribute("aria-label", "Mapa base");
      btn.innerHTML = '<i class="fa-solid fa-layer-group"></i>';

      this._panel = el("div", "mb-panel");
      this._panel.hidden = true;
      this._panel.append(el("div", "mb-t", "Mapa base"));
      BASEMAPS.forEach(b => {
        const r = el("input");
        r.type = "radio";
        r.name = "mapabase";
        r.value = b.id;
        r.checked = b.id === INICIAL;
        r.addEventListener("change", () => this.cambiar(b.id));
        const l = el("label");
        l.append(r, b.nombre);
        this._panel.append(l);
      });

      btn.addEventListener("click", () => { this._panel.hidden = !this._panel.hidden; });
      this._fuera = e => { if (!this._el.contains(e.target)) this._panel.hidden = true; };
      document.addEventListener("click", this._fuera);
      this._el.append(btn, this._panel);

      if (map.isStyleLoaded()) this.iniciar();
      else map.once("load", () => this.iniciar());
      return this._el;
    }

    onRemove() {
      document.removeEventListener("click", this._fuera);
      this._el.remove();
    }

    iniciar() {
      const map = this._map;
      const capas = map.getStyle().layers;
      // El mapa base original del estilo (capas raster) se oculta: lo reemplazan estas opciones
      capas.filter(l => l.type === "raster").forEach(l => map.setLayoutProperty(l.id, "visibility", "none"));
      // Las capas base se insertan debajo de cualquier capa de datos que ya exista
      const primera = capas.find(l => l.type !== "raster");
      const antes = primera ? primera.id : undefined;

      BASEMAPS.forEach(b => {
        const src = b.fuente || b.id;
        if (!map.getSource("base-" + src)) {
          const def = BASEMAPS.find(x => x.id === src);
          map.addSource("base-" + src, { type: "raster", tiles: def.tiles, tileSize: 256,
            maxzoom: def.maxzoom || 19, attribution: def.attribution });
        }
        map.addLayer({
          id: "base-" + b.id, type: "raster", source: "base-" + src,
          layout: { visibility: b.id === this._activo ? "visible" : "none" },
          paint: b.saturacion !== undefined ? { "raster-saturation": b.saturacion } : {}
        }, antes);
      });
      this._listo = true;
    }

    cambiar(id) {
      this._activo = id;
      if (!this._listo) return;
      BASEMAPS.forEach(b =>
        this._map.setLayoutProperty("base-" + b.id, "visibility", b.id === id ? "visible" : "none"));
    }
  }

  map.addControl(new MapasBase(), "top-right");
})();