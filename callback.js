(async function () {
  'use strict';
  var titulo = document.getElementById('titulo');
  var detalle = document.getElementById('detalle');
  var acciones = document.getElementById('acciones');

  function fallar(mensaje) {
    titulo.textContent = 'No se pudo iniciar sesión';
    detalle.textContent = mensaje;
    acciones.hidden = false;
  }

  var p = new URLSearchParams(location.search);
  if (p.get('error')) {
    fallar('El inicio de sesión se canceló o fue rechazado. Puedes volver a intentarlo.');
    return;
  }
  try {
    var destino = await G1.completarLogin(p.get('code'), p.get('state'));
    location.replace(destino);
  } catch (e) {
    fallar('El enlace de acceso venció o ya se usó. Inicia sesión de nuevo para continuar.');
  }
})();
