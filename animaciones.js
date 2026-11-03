/* Transiciones suaves: los bloques aparecen al llegar a ellos y la cabecera se marca al bajar. */
(function () {
  'use strict';
  var cabecera = document.querySelector('.cabecera');
  function alBajar() { if (cabecera) cabecera.classList.toggle('con-borde', window.scrollY > 8); }
  window.addEventListener('scroll', alBajar, { passive: true });
  alBajar();

  var bloques = document.querySelectorAll('.aparece');
  var quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (quieto || !('IntersectionObserver' in window)) {
    bloques.forEach(function (el) { el.classList.add('visible'); });
    return;
  }
  // Los elementos de una misma fila aparecen uno detras del otro
  var grupos = new Map();
  bloques.forEach(function (el) {
    var padre = el.parentElement;
    var i = grupos.get(padre) || 0;
    el.style.transitionDelay = Math.min(i, 5) * 90 + 'ms';
    grupos.set(padre, i + 1);
  });
  var obs = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('visible');
      obs.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  bloques.forEach(function (el) { obs.observe(el); });
})();

/* Selector de período de los planes: el precio cambia contando de un valor al otro */
(function () {
  var tarjeta = document.querySelector('.precio-tarjeta');
  if (!tarjeta) return;
  var cifra = tarjeta.querySelector('[data-cifra]');
  var botones = tarjeta.querySelectorAll('[data-periodo]');
  var precios = { mensual: 89.99, anual: 899.99 };
  var actual = precios.mensual, animacion = null;
  var quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function formato(v) { return v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function contar(hasta) {
    cancelAnimationFrame(animacion);
    var desde = actual, inicio = null, dur = quieto ? 0 : 650;
    function paso(t) {
      if (inicio === null) inicio = t;
      var k = dur ? Math.min(1, (t - inicio) / dur) : 1;
      var e = 1 - Math.pow(1 - k, 4);
      actual = desde + (hasta - desde) * e;
      cifra.textContent = formato(actual);
      if (k < 1) animacion = requestAnimationFrame(paso); else actual = hasta;
    }
    animacion = requestAnimationFrame(paso);
  }
  botones.forEach(function (b) {
    b.addEventListener('click', function () {
      var p = b.dataset.periodo;
      if (tarjeta.dataset.plan === p) return;
      tarjeta.dataset.plan = p;
      botones.forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
      contar(precios[p]);
    });
  });
})();

/* Marca en el menu la seccion que se esta viendo */
(function () {
  var enlaces = Array.prototype.slice.call(document.querySelectorAll('.menu a[href^="#"]'));
  if (!enlaces.length || !('IntersectionObserver' in window)) return;
  var porId = {};
  enlaces.forEach(function (a) { porId[a.getAttribute('href').slice(1)] = a; });
  var obs = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (!e.isIntersecting) return;
      enlaces.forEach(function (a) { a.classList.remove('activo'); });
      var a = porId[e.target.id]; if (a) a.classList.add('activo');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('main section[id]').forEach(function (s) { obs.observe(s); });
})();

/* Carrusel de daños: se duplica la lista para que el giro sea continuo */
(function () {
  var lista = document.querySelector('.danios');
  if (!lista) return;
  Array.prototype.slice.call(lista.children).forEach(function (li) {
    var copia = li.cloneNode(true);
    copia.setAttribute('aria-hidden', 'true');
    lista.appendChild(copia);
  });
})();
