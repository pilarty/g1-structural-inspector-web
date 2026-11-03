/* Panel de la cuenta: plan, aplicación, actividad y datos. */
(async function () {
  'use strict';
  var s = await G1.listo;
  if (!s) { G1.irALogin('login', '/cuenta.html'); return; }

  document.getElementById('cargando').hidden = true;
  document.getElementById('panel').hidden = false;

  var api = G1.CONFIG.api;
  var usuario = G1.usuarioDe(s);
  var nombre = (usuario.nombre && usuario.nombre.indexOf('@') < 0) ? usuario.nombre : '';
  document.querySelector('[data-nombre]').textContent = nombre ? ', ' + nombre.split(' ')[0] : '';
  document.querySelector('[data-dato-nombre]').textContent = nombre || '—';

  function el(sel) { return document.querySelector(sel); }

  async function pedir(ruta) {
    var sesion = await G1.sesionActual();
    if (!sesion) { G1.irALogin('login', '/cuenta.html'); throw new Error('sin_sesion'); }
    return fetch(api + ruta, { headers: { Authorization: 'Bearer ' + sesion.id_token } });
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

  /* ── Plan y aplicación ──
     El servidor solo entrega el instalador a cuentas con suscripción activa,
     así que esa misma respuesta indica el estado del plan. */
  var insignia = el('[data-plan-insignia]');
  function plan(estado, titulo, texto, boton) {
    insignia.dataset.estado = estado;
    insignia.textContent = estado === 'activa' ? 'Activa' : estado === 'inactiva' ? 'Sin plan' : 'Sin datos';
    el('[data-plan-titulo]').textContent = titulo;
    el('[data-plan-texto]').textContent = texto;
    el('[data-plan-boton]').textContent = boton;
    // Sin plan, el botón para elegirlo ya está en la tarjeta de la aplicación
    el('[data-plan-boton]').hidden = estado !== 'activa';
  }

  try {
    var r = await pedir('/descargas/instalador');
    if (r.ok || r.status === 404) {
      plan('activa', 'Suscripción activa', 'Tenés acceso a todas las funciones de la aplicación.', 'Cambiar plan');
      el('[data-app-con-plan]').hidden = false;
      if (r.ok) {
        var d = await r.json();
        if (d.version) el('[data-version]').textContent = 'versión ' + d.version;
      }
    } else if (r.status === 403) {
      plan('inactiva', 'Sin suscripción', 'Elegí el plan mensual o el anual para empezar a inspeccionar.', 'Ver planes');
      el('[data-app-sin-plan]').hidden = false;
    } else {
      throw new Error('http_' + r.status);
    }
  } catch (e) {
    plan('', 'No se pudo consultar', 'Revisá tu conexión y recargá la página.', 'Ver planes');
    el('[data-app-sin-plan]').hidden = false;
  }

  var boton = document.getElementById('descargar');
  var estado = document.getElementById('estado-descarga');
  function mostrar(texto, tipo) { estado.textContent = texto; estado.dataset.tipo = tipo || ''; }

  // Descarga desactivada por ahora: el botón se muestra pero no descarga nada
  boton.addEventListener('click', function (ev) { ev.preventDefault(); });

  /* ── Actividad: los mismos datos de la nube que usa la aplicación ── */
  function contar(nodo, hasta) {
    var inicio = null, dur = 900;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || hasta === 0) { nodo.textContent = String(hasta); return; }
    function paso(t) {
      if (inicio === null) inicio = t;
      var k = Math.min(1, (t - inicio) / dur);
      nodo.textContent = Math.round(hasta * (1 - Math.pow(1 - k, 3))).toLocaleString('es-AR');
      if (k < 1) requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
  }

  // Cada dato se pide por separado: si una ruta falla, las demás se muestran igual
  var fallas = [];
  // El servidor puede redirigir "/ruta" a "/ruta/" (o al revés), y el navegador bloquea
  // esa redirección; si pasa, se prueba directamente con la otra forma.
  async function pedirSinRedireccion(ruta) {
    try {
      return await pedir(ruta);
    } catch (e) {
      if (!(e instanceof TypeError)) throw e;
      return pedir(ruta.endsWith('/') ? ruta.slice(0, -1) : ruta + '/');
    }
  }

  async function lista(ruta) {
    try {
      var r = await pedirSinRedireccion(ruta);
      if (!r.ok) { fallas.push(ruta + ' (' + r.status + ')'); return null; }
      var d = await r.json();
      return Array.isArray(d) ? d : null;
    } catch (e) {
      fallas.push(ruta + ' (' + (e instanceof TypeError ? 'bloqueada por el navegador' : e.message) + ')');
      return null;
    }
  }

  var datos = await Promise.all([lista('/edificaciones'), lista('/resumen/relevamientos')]);
  var edificaciones = datos[0], relevamientos = datos[1];
  if (fallas.length) {
    console.warn('Actividad: no respondieron', fallas.join(', '));
    var aviso = el('[data-actividad-estado]');
    aviso.textContent = 'No se pudo cargar parte de la actividad: ' + fallas.join(', ') + '.';
    aviso.dataset.tipo = 'error';
  }
  if (edificaciones) contar(el('[data-cifra-edificaciones]'), edificaciones.length);

  try {
    if (!relevamientos) throw new Error('sin_resumen');
    var hallazgos = relevamientos.reduce(function (t, x) { return t + (Number(x.detecciones) || 0); }, 0);
    contar(el('[data-cifra-inspecciones]'), relevamientos.length);
    contar(el('[data-cifra-hallazgos]'), hallazgos);

    var fechas = relevamientos
      .map(function (x) { return x.fecha_inicio || x.fecha_programada; })
      .filter(Boolean)
      .map(function (f) { return new Date(f); })
      .filter(function (f) { return !isNaN(f); })
      .sort(function (a, b) { return b - a; });
    el('[data-ultima]').textContent = fechas.length
      ? 'Última inspección: ' + fechas[0].toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'Todavía no hay inspecciones';
  } catch (e) {
    /* el aviso de arriba ya dice qué ruta falló */
  }
})();
