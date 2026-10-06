(async function () {
  'use strict';
  var s = await G1.listo;
  if (!s) { G1.irALogin('login', '/cuenta.html'); return; }

  document.getElementById('cargando').hidden = true;
  document.getElementById('panel').hidden = false;

  var boton = document.getElementById('descargar');
  var estado = document.getElementById('estado-descarga');

  function mostrar(texto, tipo) {
    estado.textContent = texto;
    estado.dataset.tipo = tipo || '';
  }

  // Solo se sigue un enlace de descarga seguro que venga de AWS
  function enlaceValido(url) {
    try {
      var u = new URL(url);
      return u.protocol === 'https:' && /\.amazonaws\.com$/.test(u.hostname);
    } catch (e) {
      return false;
    }
  }

  boton.addEventListener('click', async function () {
    boton.disabled = true;
    mostrar('Preparando la descarga…');
    try {
      var sesion = await G1.sesionActual();
      if (!sesion) { G1.irALogin('login', '/cuenta.html'); return; }
      var r = await fetch(G1.CONFIG.api + '/descargas/instalador', {
        headers: { Authorization: 'Bearer ' + sesion.id_token }
      });
      if (r.status === 401) {
        mostrar('Tu sesión venció. Cierra sesión, vuelve a entrar y repite la descarga.', 'error');
        return;
      }
      if (r.status === 403) {
        mostrar('Tu cuenta todavía no tiene una licencia para descargar la aplicación.', 'error');
        return;
      }
      if (r.status === 404) {
        mostrar('El instalador todavía no está disponible. Estamos terminando de prepararlo; vuelve a intentar en unos días.', 'error');
        return;
      }
      if (!r.ok) throw new Error('http_' + r.status);
      var d = await r.json();
      if (!enlaceValido(d.url)) throw new Error('enlace_invalido');
      var detalle = [d.version ? 'versión ' + d.version : '', d.tamano_mb ? d.tamano_mb + ' MB' : '']
        .filter(Boolean).join(', ');
      mostrar('La descarga comenzó' + (detalle ? ' (' + detalle + ')' : '') + '. Cuando termine, abre el archivo para instalar.', 'ok');
      location.assign(d.url);
    } catch (e) {
      mostrar('No se pudo preparar la descarga. Revisa tu conexión e inténtalo de nuevo en unos minutos.', 'error');
    } finally {
      boton.disabled = false;
    }
  });
})();
