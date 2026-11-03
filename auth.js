/* Sesion del sitio con Amazon Cognito, con el mismo grupo de usuarios y el mismo
   cliente que la aplicacion de escritorio. El inicio de sesion usa SRP (la contrasena
   nunca viaja ni se guarda); registro, codigos y renovacion usan la API publica de Cognito. */
(function () {
  'use strict';

  var CONFIG = Object.freeze({
    region: 'us-east-1',
    poolId: 'us-east-1_s9afR6W9w',
    clientId: '4044ectglilgk2u23qeit75pue',
    api: 'https://lunkxzh9q5.execute-api.us-east-1.amazonaws.com'
  });

  var CLAVE_SESION = 'g1.sesion';
  var DESTINO_POR_DEFECTO = '/cuenta.html';
  var navegar = function (url) { location.assign(url); };

  // Solo se acepta volver a una ruta de este mismo sitio
  function destinoSeguro(d) {
    return typeof d === 'string' && /^\/(?![\/\\])/.test(d) ? d : DESTINO_POR_DEFECTO;
  }

  function irALogin(modo, destino) {
    var p = new URLSearchParams({ modo: modo === 'signup' ? 'registro' : 'login' });
    if (destino) p.set('destino', destinoSeguro(destino));
    navegar('/acceso.html?' + p.toString());
  }

  /* ── Llamadas a la API publica de Cognito ── */
  async function cognito(accion, cuerpo) {
    var r = await fetch('https://cognito-idp.' + CONFIG.region + '.amazonaws.com/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.' + accion
      },
      body: JSON.stringify(cuerpo)
    });
    var d = {};
    try { d = await r.json(); } catch (e) { /* sin cuerpo */ }
    if (!r.ok) {
      var err = new Error(d.message || d.Message || 'error_cognito');
      err.code = String(d.__type || '').split('#').pop();
      throw err;
    }
    return d;
  }

  /* ── Sesion guardada en el navegador ── */
  function guardar(id, acceso, refresco, expiraEnSeg) {
    var s = {
      id_token: id,
      access_token: acceso,
      refresh_token: refresco,
      expira: Date.now() + Math.max(0, (expiraEnSeg || 3600) - 60) * 1000
    };
    localStorage.setItem(CLAVE_SESION, JSON.stringify(s));
    return s;
  }

  function leerSesion() {
    try { return JSON.parse(localStorage.getItem(CLAVE_SESION)); } catch (e) { return null; }
  }

  async function sesionActual() {
    var s = leerSesion();
    if (!s || !s.id_token) return null;
    if (Date.now() < s.expira) return s;
    if (!s.refresh_token) { localStorage.removeItem(CLAVE_SESION); return null; }
    try {
      var d = await cognito('InitiateAuth', {
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: CONFIG.clientId,
        AuthParameters: { REFRESH_TOKEN: s.refresh_token }
      });
      var a = d.AuthenticationResult;
      return guardar(a.IdToken, a.AccessToken, a.RefreshToken || s.refresh_token, a.ExpiresIn);
    } catch (e) {
      localStorage.removeItem(CLAVE_SESION);
      return null;
    }
  }

  /* ── Acciones de la pantalla de acceso ── */
  function iniciarSesion(usuario, clave) {
    var C = window.AmazonCognitoIdentity;
    var pool = new C.CognitoUserPool({ UserPoolId: CONFIG.poolId, ClientId: CONFIG.clientId, Storage: sessionStorage });
    var user = new C.CognitoUser({ Username: usuario, Pool: pool, Storage: sessionStorage });
    var datos = new C.AuthenticationDetails({ Username: usuario, Password: clave });
    return new Promise(function (resolver, rechazar) {
      user.authenticateUser(datos, {
        onSuccess: function (ses) {
          var id = ses.getIdToken();
          var seg = id.getExpiration() - Math.floor(Date.now() / 1000);
          resolver(guardar(id.getJwtToken(), ses.getAccessToken().getJwtToken(), ses.getRefreshToken().getToken(), seg));
        },
        onFailure: function (e) { rechazar(e); },
        newPasswordRequired: function () {
          var e = new Error('nueva_clave'); e.code = 'NewPasswordRequired'; rechazar(e);
        }
      });
    });
  }

  // Igual que la app: si el grupo no acepta un correo como usuario, se arma uno con el correo
  function crc32(texto) {
    var bytes = new TextEncoder().encode(texto), c, crc = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) {
      c = (crc ^ bytes[i]) & 0xFF;
      for (var k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1;
      crc = (crc >>> 8) ^ c;
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  async function registrar(nombre, apellido, email, clave) {
    var atributos = [
      { Name: 'email', Value: email },
      { Name: 'given_name', Value: nombre },
      { Name: 'family_name', Value: apellido },
      { Name: 'name', Value: (nombre + ' ' + apellido).trim() }
    ];
    var cuerpo = { ClientId: CONFIG.clientId, Username: email, Password: clave, UserAttributes: atributos };
    try {
      await cognito('SignUp', cuerpo);
      return email;
    } catch (e) {
      if (!/email format/i.test(e.message)) throw e;
    }
    var usuario = email.split('@')[0].replace(/\./g, '_') + '_' + (crc32(email) % 10000);
    cuerpo.Username = usuario;
    await cognito('SignUp', cuerpo);
    return usuario;
  }

  function confirmarRegistro(usuario, codigo) {
    return cognito('ConfirmSignUp', { ClientId: CONFIG.clientId, Username: usuario, ConfirmationCode: codigo });
  }
  function reenviarCodigo(usuario) {
    return cognito('ResendConfirmationCode', { ClientId: CONFIG.clientId, Username: usuario });
  }
  async function olvideClave(usuario) {
    var d = await cognito('ForgotPassword', { ClientId: CONFIG.clientId, Username: usuario });
    return (d.CodeDeliveryDetails && d.CodeDeliveryDetails.Destination) || '';
  }
  function restablecerClave(usuario, codigo, nueva) {
    return cognito('ConfirmForgotPassword', { ClientId: CONFIG.clientId, Username: usuario, ConfirmationCode: codigo, Password: nueva });
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
    localStorage.removeItem(CLAVE_SESION);
    navegar('/');
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
    destinoSeguro: destinoSeguro,
    sesionActual: sesionActual,
    usuarioDe: usuarioDe,
    cerrarSesion: cerrarSesion,
    iniciarSesion: iniciarSesion,
    registrar: registrar,
    confirmarRegistro: confirmarRegistro,
    reenviarCodigo: reenviarCodigo,
    olvideClave: olvideClave,
    restablecerClave: restablecerClave
  };
})();
