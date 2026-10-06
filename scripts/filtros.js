   // ---------- Filtro por atributos (un panel desplegable por capa) ----------
    // Se filtra en el navegador sobre el GeoJSON ya descargado: no hay llamadas extra a la API.
    const OPS_TXT = [["=", "es igual a"], ["!=", "es distinto de"], ["contiene", "contiene"]];
    const OPS_NUM = [["=", "="], ["!=", "≠"], [">", ">"], [">=", "≥"], ["<", "<"], ["<=", "≤"]];

    function coincide(v, op, texto) {
      if (v === null || v === undefined) return false;
      if (typeof v === "number") {
        const n = parseFloat(texto.replace(",", "."));
        if (isNaN(n)) return false;
        return { "=": v === n, "!=": v !== n, ">": v > n, ">=": v >= n, "<": v < n, "<=": v <= n }[op];
      }
      const a = String(v).toLowerCase(), b = texto.toLowerCase();
      return { "=": a === b, "!=": a !== b, "contiene": a.includes(b) }[op];
    }

    function construirFiltro(it, caja) {
      const campo = document.createElement("select");
      const op = document.createElement("select");
      const valor = document.createElement("input");
      const lista = document.createElement("datalist");
      lista.id = `lista-${it.key}`;
      valor.setAttribute("list", lista.id);
      valor.autocomplete = "off";
      const campoL = document.createElement("label"); campoL.append("Campo", campo);
      const opL = document.createElement("label"); opL.append("Condición", op);
      const valorL = document.createElement("label"); valorL.append("Valor", valor);
      const aplicar = document.createElement("button"); aplicar.textContent = "Aplicar";
      const limpiar = document.createElement("button"); limpiar.textContent = "Limpiar";
      const botones = document.createElement("div"); botones.className = "botones";
      botones.append(aplicar, limpiar);
      const res = document.createElement("div"); res.className = "res";
      caja.append(campoL, opL, valorL, lista, botones, res);

      it.tipos = {};
      it.ui = { campo, op, valor, lista, res };
      campo.addEventListener("change", () => { llenarOperadores(it); valor.value = ""; llenarValores(it); });
      aplicar.addEventListener("click", () => aplicarFiltro(it));
      limpiar.addEventListener("click", () => limpiarFiltro(it));
      valor.addEventListener("keydown", e => { if (e.key === "Enter") aplicarFiltro(it); });
    }

    function llenarOperadores(it) {
      const ops = it.tipos[it.ui.campo.value] === "num" ? OPS_NUM : OPS_TXT;
      it.ui.op.replaceChildren(...ops.map(([v, t]) => new Option(t, v)));
    }

    async function llenarValores(it) {
      const campo = it.ui.campo.value;
      if (it.tipos[campo] === "num") { it.ui.lista.replaceChildren(); return; }
      const gj = await obtenerGeoJSON(it);
      const valores = [...new Set(gj.features.map(f => f.properties[campo])
        .filter(v => v !== null && v !== undefined).map(String))].sort().slice(0, 200);
      it.ui.lista.replaceChildren(...valores.map(v => new Option(v)));
    }

    async function llenarCampos(it) {
      const gj = await obtenerGeoJSON(it);
      const muestra = gj.features.slice(0, 300);
      const claves = new Set();
      muestra.forEach(f => Object.keys(f.properties).forEach(k => claves.add(k)));
      it.tipos = {};
      claves.forEach(c => {
        const vals = muestra.map(f => f.properties[c]).filter(v => v !== null && v !== undefined);
        it.tipos[c] = vals.length > 0 && vals.every(v => typeof v === "number") ? "num" : "txt";
      });
      it.ui.campo.replaceChildren(...[...claves].map(c => new Option(c, c)));
      it.ui.campo.value = claves.has(it.column_info) ? it.column_info : [...claves][0];
      llenarOperadores(it);
      llenarValores(it);
    }

    async function aplicarFiltro(it) {
      const u = it.ui, texto = u.valor.value.trim();
      if (texto === "") { u.res.textContent = "Escribe un valor para filtrar."; return; }
      const campo = u.campo.value, op = u.op.value;
      const gj = await obtenerGeoJSON(it);
      const filtradas = gj.features.filter(f => coincide(f.properties[campo], op, texto));
      setHover(null); tooltip.remove();
      map.getSource(it.key).setData({ type: "FeatureCollection", features: filtradas });
      it.est.className = "est";
      it.est.textContent = "filtrada";
      u.res.textContent = `${filtradas.length} de ${gj.features.length} entidades`;
      const b = new maplibregl.LngLatBounds();
      filtradas.forEach(f => extender(f.geometry.coordinates, b));
      if (!b.isEmpty()) map.fitBounds(b, { padding: 60, maxZoom: 16 });
    }

    async function limpiarFiltro(it) {
      if (!map.getSource(it.key)) return;
      const gj = await obtenerGeoJSON(it);
      setHover(null); tooltip.remove();
      map.getSource(it.key).setData(gj);
      it.est.textContent = "";
      it.ui.valor.value = "";
      it.ui.res.textContent = "Filtro quitado";
    }

    // Abre o cierra el panel de la capa; si la capa aún no se ha cargado, la carga primero
    async function alternarPanel(it, cb, est, btn, caja) {
      const abrir = caja.hidden;
      caja.hidden = !abrir;
      btn.classList.toggle("abierto", abrir);
      btn.setAttribute("aria-expanded", String(abrir));
      if (!abrir || it.camposListos) return;
      if (!map.getSource(it.key)) { cb.checked = true; await alternar(it, cb, est); }
      if (map.getSource(it.key)) { await llenarCampos(it); it.camposListos = true; }
      else it.ui.res.textContent = "No se pudo cargar la capa.";
    }