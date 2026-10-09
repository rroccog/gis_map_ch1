// Leyenda de capas: control de MapLibre (abajo a la izquierda) que lista las capas visibles
// con su simbología (color único, categorías o rampa numérica).
// Si hay varias capas activas, un combo permite elegir cuál leyenda ver.
// Es interactiva: clic en una categoría la oculta o muestra; en las capas numéricas se edita el rango visible.
// Los estilos (.leyenda, .leyenda-*) van en tu archivo CSS.
// Script clásico: usa las variables globales del script principal (map, porZ, activas, cache).
// Cárgalo DESPUÉS del script principal:  <script src="scripts/leyenda.js"></script>
(function () {
  const MAX_CLASES = 12;
  const num = x => x.toLocaleString("es", { maximumFractionDigits: 2 });
  const el = (tag, clase, texto) => {
    const e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  };
  function simbolo(geom, color) {
    const sw = el("span", "leyenda-sw " + geom);
    sw.style.setProperty("--c", color);
    return sw;
  }

  // Filtro desde la leyenda: se aplica con setFilter sobre las capas de MapLibre, así que se
  // combina con el filtro por atributos del panel (que recorta los datos con setData).
  const BASE = {
    relleno: ["==", "$type", "Polygon"],
    lineas: ["in", "$type", "Polygon", "LineString"],
    puntos: ["==", "$type", "Point"]
  };

  function filtroExtra(it) {
    const sim = it.sim;
    if (sim.tipo === "cat" && it.ocultas && it.ocultas.size) {
      const vals = [];
      it.ocultas.forEach(v => {   // las categorías son texto; se añaden también sus equivalentes numérico y booleano
        vals.push(v);
        if (v !== "" && !isNaN(v)) vals.push(Number(v));
        if (v === "true") vals.push(true);
        if (v === "false") vals.push(false);
      });
      return ["!in", sim.campo, ...vals];
    }
    if (sim.tipo === "num" && it.rango && (it.rango[0] > sim.min || it.rango[1] < sim.max))
      return ["all", [">=", sim.campo, it.rango[0]], ["<=", sim.campo, it.rango[1]]];
    return null;
  }

  function filtrarPorLeyenda(it) {
    const extra = filtroExtra(it);
    for (const [s, base] of Object.entries(BASE))
      map.setFilter(`${it.key}-${s}`, extra ? ["all", base, extra] : base);
  }

  // Tipo de geometría de cada capa (para dibujar el símbolo correcto), leído del GeoJSON ya descargado
  const tipos = {};
  async function tipoDe(it) {
    if (!tipos[it.key]) {
      try {
        const gj = await cache.get(it.capa);
        const g = gj.features.find(f => f.geometry);
        tipos[it.key] = g ? g.geometry.type.replace("Multi", "") : "Polygon";
      } catch (e) {
        tipos[it.key] = "Polygon";
      }
    }
    return tipos[it.key];
  }

  // Opacidad por capa: en polígonos controla el relleno (el contorno queda sólido); en líneas y puntos, todo el trazo
  const OPACIDAD_RELLENO = 0.18;   // igual al valor inicial que usa agregarCapa
  function aplicarOpacidad(it, geom) {
    const o = it.opacidad, k = it.key;
    if (geom === "Polygon") {
      const h = ["boolean", ["feature-state", "hover"], false];
      map.setPaintProperty(`${k}-relleno`, "fill-opacity", ["case", h, Math.min(o + 0.32, 1), o]);
    } else if (geom === "LineString") {
      map.setPaintProperty(`${k}-lineas`, "line-opacity", o);
    } else {
      map.setPaintProperty(`${k}-puntos`, "circle-opacity", o);
      map.setPaintProperty(`${k}-puntos`, "circle-stroke-opacity", o);
    }
  }

  function controlOpacidad(it, geom) {
    const o = it.opacidad ?? (geom === "Polygon" ? OPACIDAD_RELLENO : 1);
    const caja = el("div", "leyenda-op");
    const r = el("input");
    r.type = "range";
    r.min = 0;
    r.max = 100;
    r.step = 5;
    r.value = Math.round(o * 100);
    r.title = "Opacidad de la capa";
    const v = el("span", "leyenda-opv", r.value + "%");
    r.addEventListener("input", () => {
      it.opacidad = r.value / 100;
      v.textContent = r.value + "%";
      aplicarOpacidad(it, geom);
    });
    caja.append(el("span", null, geom === "Polygon" ? "Relleno" : "Opacidad"), r, v);
    return caja;
  }

  const filtrada = it => it.est && it.est.textContent === "filtrada";

  class Leyenda {
    onAdd(map) {
      this._map = map;
      this._sig = "";
      this._el = el("div", "maplibregl-ctrl leyenda");
      this._el.hidden = true;
      // "idle" se dispara cuando el mapa termina de dibujar: tras mostrar u ocultar una capa
      this._fn = () => this.actualizar();
      map.on("idle", this._fn);
      return this._el;
    }

    onRemove() {
      this._map.off("idle", this._fn);
      this._el.remove();
    }

    async actualizar() {
      // Las capas visibles, de arriba hacia abajo (mayor zindex primero)
      const vis = porZ.filter(it => activas.has(it.key)).reverse();
      const sig = vis.map(it => it.key + (filtrada(it) ? "*" : "")).join("|");
      if (sig === this._sig) return;   // nada cambió, no se redibuja
      this._sig = sig;
      this._el.hidden = vis.length === 0;

      // Capa seleccionada en el combo: la recién activada; si la actual se apagó, la de más arriba
      const previas = new Set(this._claves || []);
      this._claves = vis.map(it => it.key);
      const nueva = vis.find(it => !previas.has(it.key));
      if (nueva) this._sel = nueva.key;
      else if (!vis.some(it => it.key === this._sel)) this._sel = vis.length ? vis[0].key : null;
      if (!vis.length) return;

      const geoms = await Promise.all(vis.map(tipoDe));
      if (sig !== this._sig) return;   // cambió mientras esperaba; el siguiente "idle" lo resuelve
      this._vis = vis;
      this._geoms = geoms;
      this.dibujar();
    }

    // Combo con las capas activas (si hay más de una) y la leyenda de la capa elegida
    dibujar() {
      const vis = this._vis;
      const i = Math.max(0, vis.findIndex(it => it.key === this._sel));
      const partes = [el("div", "leyenda-t", "Leyenda")];
      if (vis.length > 1) {
        const sel = el("select", "leyenda-sel");
        vis.forEach(it => sel.append(new Option(it.capa.replaceAll("_", " "), it.key)));
        sel.value = vis[i].key;
        sel.addEventListener("change", () => { this._sel = sel.value; this.dibujar(); });
        partes.push(sel);
      }
      partes.push(this.bloque(vis[i], this._geoms[i], filtrada(vis[i])));
      this._el.replaceChildren(...partes);
    }

    bloque(it, geom, filtrada) {
      const sim = it.sim || { tipo: "unica", color: it.color };
      const nombre = it.capa.replaceAll("_", " ");
      const b = el("div", "leyenda-b");

      if (sim.tipo === "unica") {
        const f = el("div", "leyenda-f");
        f.append(simbolo(geom, sim.color), el("span", "leyenda-n", nombre));
        if (filtrada) f.append(el("small", null, "filtrada"));
        b.append(f, controlOpacidad(it, geom));
        return b;
      }

      const cab = el("div", "leyenda-c");
      cab.append(el("span", "leyenda-n", nombre), el("small", null, sim.campo));
      if (filtrada) cab.append(el("small", null, "· filtrada"));
      b.append(cab, controlOpacidad(it, geom));

      if (sim.tipo === "cat") {
        it.ocultas = it.ocultas || new Set();
        const filas = [];
        const ver = el("small", "leyenda-ver", "ver todas");
        ver.title = "Mostrar todas las categorías";
        const pintar = () => {
          filas.forEach(([f, v]) => f.classList.toggle("off", it.ocultas.has(v)));
          ver.hidden = it.ocultas.size === 0;
        };
        const sync = () => { pintar(); filtrarPorLeyenda(it); };
        ver.addEventListener("click", () => { it.ocultas.clear(); sync(); });
        cab.append(ver);

        sim.clases.slice(0, MAX_CLASES).forEach(c => {
          const f = el("div", "leyenda-f clic");
          f.title = "Clic: ocultar o mostrar · Doble clic: ver solo esta";
          f.append(simbolo(geom, c.color), el("span", "leyenda-n", c.valor));
          f.addEventListener("click", () => {
            if (it.ocultas.has(c.valor)) it.ocultas.delete(c.valor);
            else it.ocultas.add(c.valor);
            sync();
          });
          f.addEventListener("dblclick", () => {
            it.ocultas = new Set(sim.clases.map(x => x.valor).filter(v => v !== c.valor));
            sync();
          });
          filas.push([f, c.valor]);
          b.append(f);
        });
        if (sim.clases.length > MAX_CLASES)
          b.append(el("small", "leyenda-mas", `… y ${sim.clases.length - MAX_CLASES} más`));
        pintar();
      } else {
        const g = el("div", "leyenda-g");
        g.style.background = `linear-gradient(90deg, ${sim.rampa.join(", ")})`;
        const m = el("div", "leyenda-m");
        const lo = el("input"), hi = el("input");
        [lo, hi].forEach(i => { i.type = "number"; i.step = "any"; });
        lo.title = "Valor mínimo visible";
        hi.title = "Valor máximo visible";
        const r = it.rango || [sim.min, sim.max];
        lo.value = r[0];
        hi.value = r[1];
        const aplicar = () => {
          let x = parseFloat(lo.value), y = parseFloat(hi.value);
          if (isNaN(x)) x = sim.min;
          if (isNaN(y)) y = sim.max;
          if (x > y) [x, y] = [y, x];
          lo.value = x;
          hi.value = y;
          it.rango = [x, y];
          filtrarPorLeyenda(it);
        };
        lo.addEventListener("change", aplicar);
        hi.addEventListener("change", aplicar);
        m.append(lo, hi);
        b.append(g, m);
      }
      return b;
    }
  }

  map.addControl(new Leyenda(), "bottom-left");
})();