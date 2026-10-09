// Botón "Mi ubicación" (control nativo de MapLibre): muestra tu posición y la sigue mientras te mueves.
// Funciona solo en HTTPS o en localhost (GitHub Pages sirve HTTPS). El navegador pedirá permiso.
// Script clásico: usa la variable global map. Cárgalo DESPUÉS del script principal:
//   <script src="scripts/ubicacion.js"></script>
// Los estilos van en tu archivo CSS (ver ubicacion.css).
(function () {
    map.addControl(new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,     // sigue la posición; un segundo clic desactiva el seguimiento
        showUserLocation: true,
        showAccuracyCircle: true,
        fitBoundsOptions: { maxZoom: 16 }
    }), "top-right");
})();