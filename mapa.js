/* Mapa de ejemplo de la portada: muestra como se ve un hallazgo en la aplicacion. */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var X0 = 50, Y0 = 370, M = 50;   // 1 metro = 50 unidades; el eje Y crece hacia arriba
  var ANCHO_M = 10, ALTO_M = 7;

  var NIVELES = {
    critica: { texto: 'Crítica', color: '#B3261E', radio: 11 },
    alta: { texto: 'Alta', color: '#D9661F', radio: 9.5 },
    media: { texto: 'Media', color: '#B08400', radio: 8 },
    baja: { texto: 'Baja', color: '#3F8F5F', radio: 6.5 }
  };

  var HALLAZGOS = [
    { tipo: 'Grieta diagonal', foto: 'diagonal', prob: 0.91, x: 2.1, y: 4.8 },
    { tipo: 'Desprendimiento de hormigón', foto: 'desprendimiento', prob: 0.74, x: 4.6, y: 1.9 },
    { tipo: 'Corrosión', foto: 'corrosion', prob: 0.58, x: 6.8, y: 5.6 },
    { tipo: 'Grieta de corte', foto: 'corte', prob: 0.88, x: 8.4, y: 2.7 },
    { tipo: 'Grieta de flexión', foto: 'flexion', prob: 0.52, x: 3.6, y: 6.2 },
    { tipo: 'Grieta de desprendimiento', foto: 'despegue', prob: 0.41, x: 7.4, y: 0.9 }
  ];

  var BASE_FOTO =
    '<defs><filter id="t"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/>' +
    '<feColorMatrix values="0 0 0 0 .45  0 0 0 0 .43  0 0 0 0 .40  0 0 0 .55 0"/></filter></defs>' +
    '<rect width="148" height="111" fill="#BDB9B0"/><rect width="148" height="111" filter="url(#t)"/>';

  var FOTOS = {
    diagonal:
      '<path d="M6 104 L44 70 L58 76 L96 36 L112 44 L144 8" fill="none" stroke="#23272B" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="M58 76 L70 96 M96 36 L90 14" fill="none" stroke="#23272B" stroke-width="1.4"/>',
    desprendimiento:
      '<path d="M40 40 L86 28 L118 52 L108 90 L66 98 L36 76 Z" fill="#7A756C"/>' +
      '<path d="M40 40 L86 28 L118 52" fill="none" stroke="#E4E0D8" stroke-width="2"/>' +
      '<path d="M52 62 L108 62 M50 76 L104 76" stroke="#8A4B24" stroke-width="3"/>',
    corrosion:
      '<rect y="48" width="148" height="9" fill="#6B6F73"/>' +
      '<ellipse cx="60" cy="52" rx="38" ry="18" fill="#A4521F" opacity=".55"/>' +
      '<ellipse cx="96" cy="58" rx="26" ry="14" fill="#7C3A14" opacity=".5"/>',
    corte:
      '<path d="M20 12 L74 58 L128 100" fill="none" stroke="#23272B" stroke-width="2.2"/>' +
      '<path d="M128 14 L74 58 L18 98" fill="none" stroke="#23272B" stroke-width="2.2"/>',
    flexion:
      '<path d="M4 58 L30 54 L46 62 L70 52 L92 60 L116 50 L144 56" fill="none" stroke="#23272B" stroke-width="2.2" stroke-linejoin="round"/>',
    despegue:
      '<path d="M8 38 Q70 28 142 52 L142 62 Q70 40 8 48 Z" fill="#8F8A80"/>' +
      '<path d="M8 30 Q70 20 142 44" fill="none" stroke="#23272B" stroke-width="2"/>' +
      '<path d="M8 38 Q70 28 142 52" fill="none" stroke="#23272B" stroke-width="1.2"/>'
  };

  // Mismos cortes que usa la aplicacion para asignar el nivel de alerta
  function nivelDe(p) {
    return p >= 0.85 ? 'critica' : p >= 0.65 ? 'alta' : p >= 0.45 ? 'media' : 'baja';
  }

  function el(nombre, atributos, texto) {
    var e = document.createElementNS(NS, nombre);
    Object.keys(atributos || {}).forEach(function (k) { e.setAttribute(k, atributos[k]); });
    if (texto != null) e.textContent = texto;
    return e;
  }

  function px(x) { return X0 + x * M; }
  function py(y) { return Y0 - y * M; }

  function dibujarBase(svg) {
    var fondo = el('rect', { x: px(0), y: py(ALTO_M), width: ANCHO_M * M, height: ALTO_M * M, fill: '#FFFFFF' });
    var grilla = el('g', { 'class': 'grilla' });
    var eje = el('g', { 'class': 'eje' });
    var i;
    for (i = 0; i <= ANCHO_M; i++) {
      grilla.appendChild(el('line', { x1: px(i), y1: py(0), x2: px(i), y2: py(ALTO_M), 'class': i % 5 === 0 ? 'mayor' : '' }));
      if (i % 2 === 0) eje.appendChild(el('text', { x: px(i), y: py(0) + 20, 'text-anchor': 'middle' }, String(i)));
    }
    for (i = 0; i <= ALTO_M; i++) {
      grilla.appendChild(el('line', { x1: px(0), y1: py(i), x2: px(ANCHO_M), y2: py(i), 'class': i % 5 === 0 ? 'mayor' : '' }));
      eje.appendChild(el('text', { x: px(0) - 10, y: py(i) + 4, 'text-anchor': 'end' }, String(i)));
    }
    eje.appendChild(el('text', { x: px(ANCHO_M / 2), y: 414, 'text-anchor': 'middle', 'class': 'titulo-eje' }, 'Posición X (m)'));
    eje.appendChild(el('text', {
      transform: 'translate(14 ' + py(ALTO_M / 2) + ') rotate(-90)', 'text-anchor': 'middle', 'class': 'titulo-eje'
    }, 'Posición Y (m)'));
    svg.appendChild(fondo);
    svg.appendChild(grilla);
    svg.appendChild(eje);
  }

  function decimal(n) {
    return n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  function iniciar() {
    var svg = document.getElementById('mapa');
    if (!svg) return;
    var foto = document.getElementById('hallazgo-foto');
    var tipo = document.getElementById('hallazgo-tipo');
    var nivelEl = document.getElementById('hallazgo-nivel');
    var prob = document.getElementById('hallazgo-prob');
    var pos = document.getElementById('hallazgo-pos');
    var marcas = [];

    dibujarBase(svg);

    function seleccionar(i) {
      var h = HALLAZGOS[i];
      var n = NIVELES[nivelDe(h.prob)];
      marcas.forEach(function (m, j) { m.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
      foto.innerHTML = '<svg viewBox="0 0 148 111" role="img" aria-label="Foto de ejemplo del hallazgo">' + BASE_FOTO + FOTOS[h.foto] + '</svg>';
      tipo.textContent = h.tipo;
      nivelEl.style.setProperty('--c', n.color);
      nivelEl.lastChild.textContent = n.texto;
      prob.textContent = Math.round(h.prob * 100) + '%';
      pos.textContent = decimal(h.x) + ' m en X, ' + decimal(h.y) + ' m en Y';
    }

    HALLAZGOS.forEach(function (h, i) {
      var n = NIVELES[nivelDe(h.prob)];
      var g = el('g', {
        'class': 'marca', tabindex: '0', role: 'button', 'aria-pressed': 'false',
        'aria-label': h.tipo + ', nivel ' + n.texto.toLowerCase() + ', ' + Math.round(h.prob * 100) + '%'
      });
      g.style.setProperty('--c', n.color);
      g.style.setProperty('--i', String(i));
      g.appendChild(el('circle', { cx: px(h.x), cy: py(h.y), r: 30, fill: 'transparent' }));
      var cuerpo = el('g', { 'class': 'cuerpo' });
      cuerpo.appendChild(el('circle', { 'class': 'halo', cx: px(h.x), cy: py(h.y), r: n.radio + 11 }));
      cuerpo.appendChild(el('circle', { 'class': 'punto', cx: px(h.x), cy: py(h.y), r: n.radio }));
      cuerpo.appendChild(el('circle', { 'class': 'aro', cx: px(h.x), cy: py(h.y), r: n.radio + 6 }));
      g.appendChild(cuerpo);
      g.addEventListener('click', function () { seleccionar(i); });
      g.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); seleccionar(i); }
      });
      svg.appendChild(g);
      marcas.push(g);
    });

    seleccionar(0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
