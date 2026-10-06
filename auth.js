/* Inicio de sesion del sitio: Cognito (inicio de sesion administrado)
   con flujo de codigo de autorizacion + PKCE. No guarda contrasenas. */
(function () {
  'use strict';

  var CONFIG = Object.freeze({
    dominio: 'https://g1structuralinspector.auth.us-east-1.amazoncognito.com',
    clientId: '4044ectglilgk2u23qeit75pue',
    api: 'https://lunkxzh9q5.execute-api.us-east-1.amazonaws.com'
  });

  var K = {
    sesion: 'g1.sesion',
    verificador: 'g1.pkce.verificador',
    estado: 'g1.pkce.estado',
    destino: 'g1.destino'
  };
  var DESTINO_POR_DEFECTO = '/cuenta.html';

  var navegar = function (url) { location.assign(url); };

  function redirectUri() { return location.origin + '/callback.html'; }

  function base64url(bytes) {
    var s = '';
    bytes.forEach(function (b) { s += String.fromCharCode(b); });
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function aleatorio(n) {
    var b = new Uint8Array(n);
    crypto.getRandomValues(b);
    return base64url(b);
  }

  async function desafio(verificador) {
    var h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador));
    return base64url(new Uint8Array(h));
  }

  // Solo se acepta volver a una ruta de este mismo sitio
  function destinoSeguro(d) {
    return typeof d === 'string' && /^\/(?![\/\\])/.test(d) ? d : DESTINO_POR_DEFECTO;
  }

  async function irALogin(modo, destino) {
    var verificador = aleatorio(64);
    var estado = aleatorio(24);
    sessionStorage.setItem(K.verificador, verificador);
    sessionStorage.setItem(K.estado, estado);
    sessionStorage.setItem(K.destino, destinoSeguro(destino));
    var p = new URLSearchParams({
      client_id: CONFIG.clientId,
      response_type: 'code',
      scope: 'openid email profile',
      redirect_uri: redirectUri(),
      state: estado,
      code_challenge: await desafio(verificador),
      code_challenge_method: 'S256',
      lang: 'es'
    });
    navegar(CONFIG.dominio + (modo === 'signup' ? '/signup' : '/oauth2/authorize') + '?' + p.toString());
  }

  async function pedirTokens(cuerpo) {
    var r = await fetch(CONFIG.dominio + '/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(cuerpo).toString()
    });
    if (!r.ok) throw new Error('token_' + r.status);
    return r.json();
  }

  function guardar(t, previa) {
    var s = {
      id_token: t.id_token,
      access_token: t.access_token,
      refresh_token: t.refresh_token || (previa && previa.refresh_token) || null,
      expira: Date.now() + Math.max(0, (t.expires_in || 3600) - 60) * 1000
    };
    localStorage.setItem(K.sesion, JSON.stringify(s));
    return s;
  }

  async function completarLogin(codigo, estado) {
    var esperado = sessionStorage.getItem(K.estado);
    var verificador = sessionStorage.getItem(K.verificador);
    var destino = destinoSeguro(sessionStorage.getItem(K.destino));
    sessionStorage.removeItem(K.estado);
    sessionStorage.removeItem(K.verificador);
    sessionStorage.removeItem(K.destino);
    if (!codigo || !estado || !esperado || estado !== esperado || !verificador) {
      throw new Error('estado_invalido');
    }
    var t = await pedirTokens({
      grant_type: 'authorization_code',
      client_id: CONFIG.clientId,
      code: codigo,
      redirect_uri: redirectUri(),
      code_verifier: verificador
    });
    guardar(t, null);
    return destino;
  }

  function leerSesion() {
    try { return JSON.parse(localStorage.getItem(K.sesion)); } catch (e) { return null; }
  }

  async function sesionActual() {
    var s = leerSesion();
    if (!s || !s.id_token) return null;
    if (Date.now() < s.expira) return s;
    if (!s.refresh_token) { localStorage.removeItem(K.sesion); return null; }
    try {
      var t = await pedirTokens({
        grant_type: 'refresh_token',
        client_id: CONFIG.clientId,
        refresh_token: s.refresh_token
      });
      return guardar(t, s);
    } catch (e) {
      localStorage.removeItem(K.sesion);
      return null;
    }
  }

  // Solo para mostrar el correo; la verificacion del token la hace la API
  function usuarioDe(s) {
    try {
      var parte = s.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      var bin = atob(parte + '='.repeat((4 - parte.length % 4) % 4));
      var texto = new TextDecoder().decode(Uint8Array.from(bin, function (c) { return c.charCodeAt(0); }));
      var p = JSON.parse(texto);
      return { email: p.email || '', nombre: p.name || '' };
    } catch (e) {
      return { email: '', nombre: '' };
    }
  }

  function cerrarSesion() {
    localStorage.removeItem(K.sesion);
    var p = new URLSearchParams({ client_id: CONFIG.clientId, logout_uri: location.origin + '/' });
    navegar(CONFIG.dominio + '/logout?' + p.toString());
  }

  async function iniciarPagina() {
    var s = await sesionActual();
    document.body.classList.toggle('con-sesion', !!s);
    var email = s ? usuarioDe(s).email : '';
    document.querySelectorAll('[data-usuario-email]').forEach(function (el) { el.textContent = email; });
    return s;
  }

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-accion]');
    if (!el) return;
    ev.preventDefault();
    var a = el.dataset.accion;
    if (a === 'login' || a === 'signup') irALogin(a, el.dataset.destino);
    else if (a === 'logout') cerrarSesion();
  });

  var listo = new Promise(function (resolver) {
    function arrancar() { iniciarPagina().then(resolver); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
    else arrancar();
  });

  window.G1 = {
    CONFIG: CONFIG,
    listo: listo,
    irALogin: irALogin,
    completarLogin: completarLogin,
    sesionActual: sesionActual,
    usuarioDe: usuarioDe,
    cerrarSesion: cerrarSesion,
    desafio: desafio,
    destinoSeguro: destinoSeguro,
    _navegar: function (fn) { navegar = fn; }
  };
})();
