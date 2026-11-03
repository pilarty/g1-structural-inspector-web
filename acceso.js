/* Pantalla de acceso: los mismos pasos y textos que el inicio de sesion de la app. */
(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var destino = G1.destinoSeguro(params.get('destino'));
  var estado = { usuario: '', clave: '', usuarioRegistro: '', destinoCodigo: '' };
  var enviando = false;

  var MENSAJES = {
    NotAuthorizedException: 'Usuario o contraseña incorrectos.',
    UserNotFoundException: 'No encontramos una cuenta con ese usuario o correo.',
    UsernameExistsException: 'Ya hay una cuenta con ese correo.',
    AliasExistsException: 'Ya hay una cuenta con ese correo.',
    InvalidPasswordException: 'La contraseña no cumple los requisitos: al menos 8 caracteres, con mayúsculas, minúsculas y números.',
    CodeMismatchException: 'El código no es correcto o ya venció.',
    ExpiredCodeException: 'El código no es correcto o ya venció.',
    LimitExceededException: 'Demasiados intentos. Esperá unos minutos y probá de nuevo.',
    TooManyRequestsException: 'Demasiados intentos. Esperá unos minutos y probá de nuevo.',
    InvalidParameterException: 'Revisá los datos: el correo o la contraseña no son válidos.',
    NewPasswordRequired: 'Tenés que elegir una contraseña nueva. Usá «¿Olvidaste tu contraseña?».'
  };

  function mensaje(e, porDefecto) {
    var codigo = e && (e.code || e.name);
    if (codigo && MENSAJES[codigo]) return MENSAJES[codigo];
    if (e instanceof TypeError) return 'No se pudo conectar. Revisá tu conexión y probá de nuevo.';
    return porDefecto;
  }

  var subtitulos = {
    login: function () { return ''; },
    registro: function () { return 'Creá tu cuenta para empezar'; },
    confirmar: function () { return 'Escribí el código que te llegó a ' + (estado.usuario || 'tu correo'); },
    olvide: function () { return 'Te mandamos un código para elegir una contraseña nueva'; },
    codigo: function () { return 'Escribí el código que te llegó' + (estado.destinoCodigo ? ' a ' + estado.destinoCodigo : ' por correo'); }
  };

  function form(modo) { return document.querySelector('form[data-modo="' + modo + '"]'); }

  function irA(modo, aviso) {
    document.querySelectorAll('form[data-modo]').forEach(function (f) {
      f.hidden = f.dataset.modo !== modo;
      var err = f.querySelector('[data-error]'); if (err) err.hidden = true;
      var av = f.querySelector('[data-aviso]'); if (av) av.hidden = true;
    });
    var f = form(modo);
    if (aviso) { var av = f.querySelector('[data-aviso]'); if (av) { av.textContent = aviso; av.hidden = false; } }
    var sub = document.getElementById('subtitulo');
    var texto = subtitulos[modo]();
    sub.textContent = texto;
    sub.hidden = !texto;
    var primero = f.querySelector('input');
    if (primero) primero.focus();
  }

  function mostrarError(f, texto) {
    var el = f.querySelector('[data-error]');
    el.textContent = texto;
    el.hidden = false;
  }

  async function con(f, accion) {
    if (enviando) return;
    enviando = true;
    var boton = f.querySelector('button[type="submit"]');
    f.querySelector('[data-error]').hidden = true;
    if (boton) { boton.disabled = true; boton.textContent = boton.dataset.enviando; }
    try {
      await accion();
    } finally {
      enviando = false;
      if (boton) { boton.disabled = false; boton.textContent = boton.dataset.texto; }
    }
  }

  function valor(f, nombre) { return f.elements[nombre].value; }

  async function entrarYSeguir(usuario, clave) {
    await G1.iniciarSesion(usuario, clave);
    location.replace(destino);
  }

  // Iniciar sesión
  form('login').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = ev.currentTarget;
    con(f, async function () {
      var usuario = valor(f, 'usuario').trim();
      var clave = valor(f, 'clave');
      try {
        await entrarYSeguir(usuario, clave);
      } catch (e) {
        if ((e.code || e.name) === 'UserNotConfirmedException') {
          estado.usuario = usuario; estado.usuarioRegistro = usuario; estado.clave = clave;
          try { await G1.reenviarCodigo(usuario); } catch (x) { /* se puede reenviar despues */ }
          irA('confirmar', 'Tu cuenta todavía no está confirmada. Te mandamos un código.');
          return;
        }
        f.elements.clave.value = '';
        mostrarError(f, mensaje(e, 'No se pudo iniciar sesión.'));
      }
    });
  });

  // Crear cuenta
  form('registro').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = ev.currentTarget;
    con(f, async function () {
      var nombre = valor(f, 'nombre').trim();
      var email = valor(f, 'email').trim().toLowerCase();
      var clave = valor(f, 'clave');
      if (clave !== valor(f, 'repetir')) { mostrarError(f, 'Las contraseñas no coinciden.'); return; }
      try {
        estado.usuarioRegistro = await G1.registrar(nombre, valor(f, 'apellido').trim(), email, clave);
        estado.usuario = email; estado.clave = clave;
        irA('confirmar');
      } catch (e) {
        mostrarError(f, mensaje(e, 'No se pudo crear la cuenta.'));
      }
    });
  });

  // Confirmar el registro con el código
  form('confirmar').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = ev.currentTarget;
    con(f, async function () {
      try {
        await G1.confirmarRegistro(estado.usuarioRegistro, valor(f, 'codigo').trim());
      } catch (e) {
        mostrarError(f, mensaje(e, 'No se pudo confirmar la cuenta.'));
        return;
      }
      try {
        await entrarYSeguir(estado.usuario, estado.clave);
      } catch (e) {
        irA('login', 'Cuenta creada. Ya podés entrar.');
      }
    });
  });

  document.querySelector('[data-reenviar]').addEventListener('click', function () {
    var f = form('confirmar');
    con(f, async function () {
      try {
        await G1.reenviarCodigo(estado.usuarioRegistro);
        var av = f.querySelector('[data-aviso]'); av.textContent = 'Te mandamos otro código.'; av.hidden = false;
      } catch (e) {
        mostrarError(f, mensaje(e, 'No se pudo reenviar el código.'));
      }
    });
  });

  // Olvidé mi contraseña
  form('olvide').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = ev.currentTarget;
    con(f, async function () {
      var usuario = valor(f, 'usuario').trim();
      try {
        estado.destinoCodigo = await G1.olvideClave(usuario);
        estado.usuario = usuario;
        irA('codigo');
      } catch (e) {
        mostrarError(f, mensaje(e, 'No se pudo mandar el correo.'));
      }
    });
  });

  // Código y contraseña nueva
  form('codigo').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = ev.currentTarget;
    con(f, async function () {
      var nueva = valor(f, 'nueva');
      if (nueva !== valor(f, 'repetir')) { mostrarError(f, 'Las contraseñas no coinciden.'); return; }
      try {
        await G1.restablecerClave(estado.usuario, valor(f, 'codigo').trim(), nueva);
        form('login').elements.usuario.value = estado.usuario;
        irA('login', 'Listo, ya podés entrar con la contraseña nueva.');
      } catch (e) {
        mostrarError(f, mensaje(e, 'No se pudo cambiar la contraseña.'));
      }
    });
  });

  document.querySelectorAll('[data-ir]').forEach(function (b) {
    b.addEventListener('click', function () { irA(b.dataset.ir); });
  });

  // Si ya hay sesión, no hace falta entrar de nuevo
  G1.listo.then(function (s) {
    var modo = params.get('modo');
    // Cambiar la contraseña desde "Mi cuenta": se muestra aunque haya sesión
    if (modo === 'olvide') {
      if (s) form('olvide').elements.usuario.value = G1.usuarioDe(s).email || '';
      irA('olvide');
      return;
    }
    if (s) { location.replace(destino); return; }
    irA(modo === 'registro' ? 'registro' : 'login');
  });
})();
