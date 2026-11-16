/*
 * Librería — Global de Programación III.
 * Módulo: js/vistas/libros-formulario.js
 * Responsabilidad: armar el formulario de alta con selectores desde la API,
 * leer sus valores, limpiarlo y enviar a POST /api/libros/.
 *
 * Carga asíncrona de editoriales, géneros y autores al montar la vista.
 * Validación server-side: maneja 409 (conflicto ISBN) y 422 (validación).
 */
(function () {
  'use strict';

  window.Libreria = window.Libreria || {};

  var CLASE_CONTROL = 'control';
  var CLASE_AUTORES = 'control vista-libros__autores';
  var TEXTO_CARGANDO = 'Cargando opciones...';

  function crearCampo(id, etiqueta, control, ayuda) {
    var campo = document.createElement('div');
    campo.className = 'campo';
    var label = document.createElement('label');
    label.className = 'campo__etiqueta';
    label.setAttribute('for', id);
    label.textContent = etiqueta;
    control.id = id;
    campo.appendChild(label);
    campo.appendChild(control);
    if (ayuda) {
      var textoAyuda = document.createElement('p');
      textoAyuda.className = 'campo__ayuda';
      textoAyuda.id = id + '-ayuda';
      textoAyuda.textContent = ayuda;
      campo.appendChild(textoAyuda);
      control.setAttribute('aria-describedby', textoAyuda.id);
    }
    return campo;
  }

  function crearEntrada(id, nombre, etiqueta, tipo, requerido, atributos) {
    var control = document.createElement('input');
    control.name = nombre;
    control.type = tipo;
    control.className = CLASE_CONTROL;
    if (requerido) { control.setAttribute('required', ''); }
    (atributos || []).forEach(function (atributo) {
      control.setAttribute(atributo[0], atributo[1]);
    });
    return { control: control, campo: crearCampo(id, etiqueta, control) };
  }

  function crearSelect(id, nombre, etiqueta, opciones, configuracion) {
    var config = configuracion || {};
    var control = document.createElement('select');
    control.name = nombre;
    control.className = config.multiple ? CLASE_AUTORES : CLASE_CONTROL;
    if (config.requerido) { control.setAttribute('required', ''); }
    if (config.multiple) { control.setAttribute('multiple', ''); }
    if (config.tamano) { control.setAttribute('size', String(config.tamano)); }
    (opciones || []).forEach(function (opcion) {
      var item = document.createElement('option');
      item.value = opcion.valor;
      item.textContent = opcion.texto;
      control.appendChild(item);
    });
    return { control: control, campo: crearCampo(id, etiqueta, control, config.ayuda) };
  }

  function poblarSelect(control, opciones, mantenerValor) {
    var valorActual = mantenerValor ? control.value : '';
    while (control.firstChild) {
      control.removeChild(control.firstChild);
    }
    (opciones || []).forEach(function (opcion) {
      var item = document.createElement('option');
      item.value = opcion.valor;
      item.textContent = opcion.texto;
      control.appendChild(item);
    });
    if (valorActual) {
      control.value = valorActual;
    }
  }

  function mostrarCargando(control) {
    poblarSelect(control, [{ valor: '', texto: TEXTO_CARGANDO }]);
    control.disabled = true;
  }

  function valorDe(formulario, nombre) {
    var control = formulario.querySelector('[name="' + nombre + '"]');
    if (!control) { return ''; }
    var valor = control.value;
    return valor === null || valor === undefined ? '' : String(valor).trim();
  }

  function autoresSeleccionados(formulario) {
    var select = formulario.querySelector('[name="autorIds"]');
    var ids = [];
    if (!select || !select.options) { return ids; }
    Array.prototype.forEach.call(select.options, function (opcion) {
      if (opcion.selected) { ids.push(opcion.value); }
    });
    return ids;
  }

  function leer(formulario) {
    var generoId = valorDe(formulario, 'generoId');
    var autores = autoresSeleccionados(formulario);
    return {
      titulo: valorDe(formulario, 'titulo'),
      isbn: valorDe(formulario, 'isbn'),
      precio: valorDe(formulario, 'precio'),
      stock_inicial: 0,
      editorialId: parseInt(valorDe(formulario, 'editorialId'), 10) || null,
      generoId: generoId === '' ? null : parseInt(generoId, 10),
      autorIds: autores.map(function (id, index) {
        return { autor_id: parseInt(id, 10), rol: 'autor', orden: index + 1 };
      })
    };
  }

  function limpiar(formulario) {
    ['titulo', 'isbn', 'precio', 'editorialId', 'generoId'].forEach(function (nombre) {
      var control = formulario.querySelector('[name="' + nombre + '"]');
      if (control) { control.value = ''; }
    });
    var select = formulario.querySelector('[name="autorIds"]');
    if (select && select.options) {
      Array.prototype.forEach.call(select.options, function (opcion) {
        opcion.selected = false;
      });
    }
  }

  function deshabilitarControles(formulario, deshabilitar) {
    var controles = formulario.querySelectorAll('input, select, button');
    Array.prototype.forEach.call(controles, function (c) {
      c.disabled = deshabilitar;
    });
  }

  async function cargarOpciones(formulario) {
    var selEditorial = formulario.querySelector('[name="editorialId"]');
    var selGenero = formulario.querySelector('[name="generoId"]');
    var selAutores = formulario.querySelector('[name="autorIds"]');

    if (selEditorial) mostrarCargando(selEditorial);
    if (selGenero) mostrarCargando(selGenero);
    if (selAutores) mostrarCargando(selAutores);

    try {
      // Cargar en paralelo
      var [respEd, respGen, respAut] = await Promise.all([
        window.Libreria.api.listarEditoriales(),
        window.Libreria.api.listarGeneros(),
        window.Libreria.api.listarAutores ? window.Libreria.api.listarAutores() : Promise.resolve({ ok: true, data: { items: [] } })
      ]);

      if (respEd.ok && selEditorial) {
        var optsEd = [{ valor: '', texto: 'Elegí una editorial' }];
        (respEd.data.items || respEd.data || []).forEach(function (e) {
          optsEd.push({ valor: e.id, texto: e.nombre });
        });
        poblarSelect(selEditorial, optsEd);
      }

      if (respGen.ok && selGenero) {
        var optsGen = [{ valor: '', texto: 'Sin clasificar' }];
        (respGen.data.items || respGen.data || []).forEach(function (g) {
          optsGen.push({ valor: g.id, texto: g.nombre });
        });
        poblarSelect(selGenero, optsGen);
      }

      if (respAut.ok && selAutores) {
        var optsAut = [];
        (respAut.data.items || respAut.data || []).forEach(function (a) {
          optsAut.push({ valor: a.id, texto: a.nombre });
        });
        poblarSelect(selAutores, optsAut, true);
        if (selAutores) {
          selAutores.setAttribute('size', String(Math.max(3, Math.min(optsAut.length || 3, 6))));
        }
      }

    } catch (err) {
      console.error('Error cargando opciones:', err);
    }
  }

  function armarFormulario(alEnviar) {
    var formulario = document.createElement('form');
    formulario.className = 'formulario vista-libros__formulario';
    formulario.setAttribute('novalidate', '');

    var titulo = document.createElement('h2');
    titulo.className = 'formulario__titulo';
    titulo.textContent = 'Registrar libro';
    formulario.appendChild(titulo);

    formulario.appendChild(crearEntrada('libro-titulo', 'titulo', 'Título', 'text', true).campo);
    formulario.appendChild(crearEntrada('libro-isbn', 'isbn', 'ISBN', 'text', true).campo);
    formulario.appendChild(crearEntrada('libro-precio', 'precio', 'Precio', 'number', true, [
      ['min', '0.01'], ['step', '0.01'], ['inputmode', 'decimal']
    ]).campo);

    // Selectores vacíos iniciales; se poblarán con API
    formulario.appendChild(crearSelect('libro-editorial', 'editorialId', 'Editorial',
      [{ valor: '', texto: TEXTO_CARGANDO }], { requerido: true }).campo);
    formulario.appendChild(crearSelect('libro-genero', 'generoId', 'Género',
      [{ valor: '', texto: TEXTO_CARGANDO }], {}).campo);

    var autoresPlaceholder = [{ valor: '', texto: TEXTO_CARGANDO }];
    formulario.appendChild(crearSelect('libro-autores', 'autorIds', 'Autores', autoresPlaceholder, {
      multiple: true,
      requerido: true,
      tamano: 3,
      ayuda: 'Usá Ctrl (o Cmd) para elegir más de un autor.'
    }).campo);

    var acciones = document.createElement('div');
    acciones.className = 'campo__acciones';
    var boton = document.createElement('button');
    boton.type = 'submit';
    boton.className = 'boton boton--primario';
    boton.textContent = 'Registrar libro';
    acciones.appendChild(boton);
    formulario.appendChild(acciones);

    formulario.addEventListener('submit', async function (evento) {
      evento.preventDefault();
      if (typeof alEnviar === 'function') {
        await alEnviar(leer(formulario), formulario, evento);
      }
    });

    // Cargar opciones al montar
    setTimeout(function () { cargarOpciones(formulario); }, 0);

    return formulario;
  }

  var nodoRegion = null;
  var nodoListado = null;
  var nodoMensaje = null;

  function quitarMensaje() {
    if (nodoMensaje && nodoMensaje.parentNode) {
      nodoMensaje.parentNode.removeChild(nodoMensaje);
    }
    nodoMensaje = null;
  }

  function mostrarResultado(texto, tipo) {
    quitarMensaje();
    if (!nodoRegion) return null;
    nodoMensaje = window.Libreria.ui.mostrarMensaje(nodoRegion, texto, tipo);
    return nodoMensaje;
  }

  async function pintarListado() {
    if (!nodoListado) return false;
    while (nodoListado.firstChild) {
      nodoListado.removeChild(nodoListado.firstChild);
    }
    nodoListado.appendChild(await window.Libreria.librosListado.crear());
    return true;
  }

  window.Libreria.librosFormulario = {
    crear: function (opciones) {
      var ajustes = opciones || {};
      var formulario = armarFormulario(ajustes.alEnviar);
      return {
        formulario: formulario,
        leer: function () { return leer(formulario); },
        limpiar: function () { limpiar(formulario); }
      };
    }
  };

  // Exponer para que libros.js pueda refrescar el listado
  window.Libreria.librosFormulario.refrescarListado = function (region, listado) {
    nodoRegion = region;
    nodoListado = listado;
  };
}());