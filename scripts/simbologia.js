// Simbología automática según item.column_info.
//  - Campo numérico: rampa de color interpolada entre el mínimo y el máximo.
//  - Campo de texto: un color por cada valor distinto.
//  - Sin campo (o sin variación): el color único de la capa.
// Script clásico: define crearSimbologia() como global. Cárgalo ANTES del script principal.
(function () {
  const RAMPA = ["#3399ff", "#00ffff", "#00a000", "#ffff00", "#ff0000"]; // azul → cian → verde oscuro → amarillo → rojo
  const SIN_DATO = "#808080";

  function crearSimbologia(item, gj) {
    const unica = { tipo: "unica", campo: null, color: item.color, muestra: item.color };
    const campo = item.column_info;
    if (!campo) return unica;

    const vals = [];
    for (const f of gj.features) {
      const v = f.properties[campo];
      if (v !== null && v !== undefined) vals.push(v);
    }
    if (!vals.length) return unica;

    // ---- Numérico: interpolación lineal entre mínimo y máximo ----
    if (vals.every(v => typeof v === "number" && isFinite(v))) {
      let min = Infinity, max = -Infinity;
      for (const v of vals) { if (v < min) min = v; if (v > max) max = v; }
      if (min === max) return unica;
      const paradas = RAMPA.flatMap((c, i) => [min + (max - min) * i / (RAMPA.length - 1), c]);
      const color = ["case", ["==", ["typeof", ["get", campo]], "number"],
        ["interpolate", ["linear"], ["to-number", ["get", campo]], ...paradas],
        SIN_DATO];
      return { tipo: "num", campo, color, min, max, rampa: RAMPA,
               muestra: `linear-gradient(90deg, ${RAMPA.join(", ")})` };
    }

    // ---- Texto: un color por valor. El ángulo áureo reparte los tonos para que se distingan ----
    const valores = [...new Set(vals.map(String))].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
    // Los tonos verdes (70°–170°) se oscurecen para que no se confundan con parques y vegetación del mapa base
    const colores = valores.map((_, i) => {
      const h = Math.round((i * 137.508) % 360);
      return h > 70 && h < 170 ? `hsl(${h}, 85%, 32%)` : `hsl(${h}, 70%, 60%)`;
    });
    const color = ["match", ["to-string", ["get", campo]],
      ...valores.flatMap((v, i) => [v, colores[i]]),
      SIN_DATO];
    const n = Math.min(3, valores.length);
    const tramos = colores.slice(0, n).map((c, i) => `${c} ${i * 100 / n}% ${(i + 1) * 100 / n}%`);
    return { tipo: "cat", campo, color, muestra: `linear-gradient(90deg, ${tramos.join(", ")})`,
             clases: valores.map((v, i) => ({ valor: v, color: colores[i] })) };
  }

  globalThis.crearSimbologia = crearSimbologia;
})();