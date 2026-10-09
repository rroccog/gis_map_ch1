// Orden de dibujo por arrastre: cambia el zindex de las capas arrastrándolas en el menú.
// Botón de orden junto al título "Capas": activa el modo y muestra un asa en cada capa.
// En ese modo la lista se ordena por zindex (arriba = se dibuja encima). Al salir vuelve al orden del menú.
// El orden se guarda en este navegador (localStorage); no escribe en la base de datos.
// Script clásico: usa las variables globales del script principal (map, items, porZ).
// Cárgalo DESPUÉS del script principal:  <script src="scripts/orden.js"></script>
// Los estilos (.grip, .btn-ord, .ord-ayuda...) van en tu archivo CSS (ver orden.css).
(function () {
  const LLAVE = "orden-dibujo";
  const z = it => it.z_index ?? it.orden ?? 0;
  const lista = document.getElementById("lista");
  const menu = document.getElementById("menu");

  const el = (tag, clase, texto) => {
    const e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  };
  const leer = () => { try { return JSON.parse(localStorage.getItem(LLAVE)) || {}; } catch (e) { return {}; } };
  const guardar = () => {
    try {
      const o = {};
      items.forEach(it => { o[it.capa] = z(it); });
      localStorage.setItem(LLAVE, JSON.stringify(o));
    } catch (e) { /* sin almacenamiento: el orden vale solo para esta sesión */ }
  };

  // porZ se modifica en el mismo arreglo, porque el script principal lo usa para insertar capas nuevas
  function reconstruir() {
    porZ.length = 0;
    porZ.push(...[...items].sort((a, b) => z(a) - z(b) || a.id - b.id));
  }

  // Reordena las capas que ya están en el mapa: de menor a mayor zindex, cada una sube a la cima
  function aplicarMapa() {
    porZ.forEach(it => ["relleno", "lineas", "puntos"].forEach(s => {
      const id = `${it.key}-${s}`;
      if (map.getLayer(id)) map.moveLayer(id);
    }));
  }

  // En modo orden: de mayor a menor zindex. Fuera de él: el orden original del menú
  function colocar() {
    const orden = menu.classList.contains("ordenando") ? [...porZ].reverse() : items;
    lista.append(...orden.map(it => it.bloque));
  }

  function alSoltar() {
    const porBloque = new Map(items.map(it => [it.bloque, it]));
    const filas = [...lista.children];
    filas.forEach((b, i) => { porBloque.get(b).z_index = (filas.length - i) * 10; });
    reconstruir();
    aplicarMapa();
    guardar();
  }

  function arrastrar(e, b) {
    e.preventDefault();
    b.classList.add("arrastrando");
    document.body.style.userSelect = "none";
    const mover = ev => {
      const bajo = document.elementFromPoint(ev.clientX, ev.clientY);
      const otro = bajo && bajo.closest("#lista > .blq");
      if (!otro || otro === b) return;
      const r = otro.getBoundingClientRect();
      lista.insertBefore(b, ev.clientY > r.top + r.height / 2 ? otro.nextSibling : otro);
    };
    const fin = () => {
      document.removeEventListener("pointermove", mover);
      document.removeEventListener("pointerup", fin);
      document.removeEventListener("pointercancel", fin);
      document.body.style.userSelect = "";
      b.classList.remove("arrastrando");
      alSoltar();
    };
    document.addEventListener("pointermove", mover);
    document.addEventListener("pointerup", fin);
    document.addEventListener("pointercancel", fin);
  }

  function iniciar() {
    const guardado = leer();
    items.forEach((it, i) => {
      it.bloque = lista.children[i];
      it.bloque.classList.add("blq");
      it.zOriginal = z(it);
      if (guardado[it.capa] !== undefined) it.z_index = guardado[it.capa];
      const grip = el("span", "grip");
      grip.title = "Arrastrar para cambiar el orden de dibujo";
      grip.innerHTML = '<i class="fa-solid fa-grip-vertical"></i>';
      grip.addEventListener("pointerdown", e => arrastrar(e, it.bloque));
      it.bloque.querySelector(".fila").prepend(grip);
    });
    reconstruir();

    const btn = el("button", "btn-ord");
    btn.type = "button";
    btn.title = "Orden de dibujo";
    btn.innerHTML = '<i class="fa-solid fa-sort"></i>';
    document.querySelector("#menu h1").append(btn);

    const reset = el("button", "ord-reset", "Restablecer");
    reset.type = "button";
    const ayuda = el("div", "ord-ayuda");
    ayuda.append(el("span", null, "Arriba = encima en el mapa"), reset);
    lista.before(ayuda);

    btn.addEventListener("click", () => { menu.classList.toggle("ordenando"); colocar(); });
    reset.addEventListener("click", () => {
      items.forEach(it => { it.z_index = it.zOriginal; });
      reconstruir();
      aplicarMapa();
      try { localStorage.removeItem(LLAVE); } catch (e) { /* nada que borrar */ }
      colocar();
    });
  }

  // El menú se arma de forma asíncrona (después de pedir las capas): se espera a que esté listo
  const listo = () => items.length > 0 && lista.querySelectorAll(":scope > div").length === items.length;
  if (listo()) iniciar();
  else {
    const obs = new MutationObserver(() => { if (listo()) { obs.disconnect(); iniciar(); } });
    obs.observe(lista, { childList: true });
  }
})();