/*
 * Librería — Global de Programación III.
 * Módulo: js/vistas/catalogo.js
 * Responsabilidad: render y eventos de la vista Catálogo usando API.
 *
 * Variante de enlace: scripts clásicos con IIFE. El módulo publica su contrato
 * en el namespace único window.Libreria, dentro de Libreria.vistas.
 *
 * C-08: la grilla se genera desde la API, con paginación limit/offset.
 * Cada ficha muestra título, ISBN, editorial, género, autores y precio.
 * El buscador por título filtra enviando la consulta a la API.
 * Estados: carga, catálogo vacío, búsqueda sin coincidencias, error de conexión.
 */
(function () {
  'use strict';

  window.Libreria = window.Libreria || {};
  window.Libreria.vistas = window.Libreria.vistas || {};

  var CLASE_RESULTADOS = 'vista-catalogo__resultados';
  var CLASE_GRILLA = 'grilla-catalogo';
  var CLASE_ITEM = 'grilla-catalogo__item';
  var CLASE_CONSEO = 'vista-catalogo__conteo';
  var CLASE_PAGINACION = 'vista-catalogo__paginacion';

  var MENSAJE_CATALOGO_VACIO =
    'El catálogo todavía no tiene libros cargados.';
  var PREFIJO_SIN_COINCIDENCIAS = 'No se encontraron libros para "';
  var SUFIJO_SIN_COINCIDENCIAS = '"';
  var MENSAJE_ERROR_CONEXION =
    'No se pudo cargar el catálogo. Verificá tu conexión e intentá de nuevo.';

  // Estado privado del módulo
  var consulta = '';
  var paginaActual = 1;
  var tamanoPagina = 20;
  var totalLibros = 0;
  var totalPaginas = 1;
  var cargando = false;

  var nodoRegion = null;
  var nodoResultados = null;
  var nodoMensaje = null;
  var nodoPaginacion = null;

  /** Quita el mensaje de estado propio. */
  function quitarMensaje() {
    if (nodoMensaje && nodoMensaje.parentNode) {
      nodoMensaje.parentNode.removeChild(nodoMensaje);
    }
    nodoMensaje = null;
  }

  /** Escribe un mensaje de estado en la región de mensajes. */
  function mostrarMensaje(textoMensaje, tipo) {
    quitarMensaje();
    if (!nodoRegion) return null;
    nodoMensaje = window.Libreria.ui.mostrarMensaje(nodoRegion, textoMensaje, tipo || 'aviso');
    return nodoMensaje;
  }

  /** Crea controles de paginación (Anterior / Siguiente). */
  function crearPaginacion() {
    var contenedor = document.createElement('div');
    contenedor.className = CLASE_PAGINACION;
    contenedor.setAttribute('role', 'navigation');
    contenedor.setAttribute('aria-label', 'Paginación del catálogo');

    var btnAnterior = document.createElement('button');
    btnAnterior.type = 'button';
    btnAnterior.className = 'boton boton--secundario paginacion__boton';
    btnAnterior.textContent = 'Anterior';
    btnAnterior.disabled = paginaActual <= 1;
    btnAnterior.setAttribute('aria-disabled', paginaActual <= 1);
    btnAnterior.addEventListener('click', function () {
      if (paginaActual > 1) {
        paginaActual--;
        cargarYRenderizar();
      }
    });

    var info = document.createElement('span');
    info.className = 'paginacion__info';
    info.textContent = 'Página ' + paginaActual + ' de ' + totalPaginas;

    var btnSiguiente = document.createElement('button');
    btnSiguiente.type = 'button';
    btnSiguiente.className = 'boton boton--secundario paginacion__boton';
    btnSiguiente.textContent = 'Siguiente';
    btnSiguiente.disabled = paginaActual >= totalPaginas;
    btnSiguiente.setAttribute('aria-disabled', paginaActual >= totalPaginas);
    btnSiguiente.addEventListener('click', function () {
      if (paginaActual < totalPaginas) {
        paginaActual++;
        cargarYRenderizar();
      }
    });

    contenedor.appendChild(btnAnterior);
    contenedor.appendChild(info);
    contenedor.appendChild(btnSiguiente);

    return contenedor;
  }

  /** Grilla de fichas a partir de los libros recibidos. */
  function crearGrilla(libros) {
    var grilla = document.createElement('ul');
    grilla.className = CLASE_GRILLA;

    libros.forEach(function (libro) {
      var item = document.createElement('li');
      item.className = CLASE_ITEM;
      item.appendChild(window.Libreria.catalogoFichas.crearFicha(libro));
      grilla.appendChild(item);
    });

    return grilla;
  }

  /** Resumen de resultados. */
  function textoConsejo(cantidad, total) {
    if (cantidad === total) {
      return cantidad === 1 ? '1 libro en el catálogo' : cantidad + ' libros en el catálogo';
    }
    return 'Se muestran ' + cantidad + ' de ' + total + ' libros';
  }

  /** Carga libros desde la API y renderiza. */
  async function cargarYRenderizar() {
    if (cargando) return;
    cargando = true;

    if (!nodoResultados) return;

    // Limpiar resultados anteriores
    while (nodoResultados.firstChild) {
      nodoResultados.removeChild(nodoResultados.firstChild);
    }
    quitarMensaje();

    // Mostrar loading
    window.Libreria.api.mostrarCargando(nodoResultados);

    try {
      var respuesta = await window.Libreria.api.listarLibros({
        page: paginaActual,
        size: tamanoPagina,
        titulo: consulta.trim() || undefined
      });

      window.Libreria.api.ocultarCargando(nodoResultados);

      if (!respuesta.ok) {
        throw new Error(respuesta.mensaje || 'Error al cargar catálogo');
      }

      var data = respuesta.data;
      var libros = data.items || [];
      totalLibros = data.total || 0;
      totalPaginas = data.pages || 1;

      // Validar página actual
      if (paginaActual > totalPaginas && totalPaginas > 0) {
        paginaActual = totalPaginas;
        return cargarYRenderizar();
      }

      if (libros.length === 0 && totalLibros === 0) {
        // Catálogo completamente vacío
        mostrarMensaje(MENSAJE_CATALOGO_VACIO, 'vacio');
      } else if (libros.length === 0) {
        // Página sin resultados (búsqueda sin coincidencias)
        if (consulta.trim()) {
          mostrarMensaje(PREFIJO_SIN_COINCIDENCIAS + consulta + SUFIJO_SIN_COINCIDENCIAS, 'vacio');
        } else {
          mostrarMensaje('No hay libros en esta página.', 'vacio');
        }
      } else {
        // Hay resultados
        quitarMensaje();

        var consejo = document.createElement('p');
        consejo.className = CLASE_CONSEO;
        consejo.textContent = textoConsejo(libros.length, totalLibros);
        nodoResultados.appendChild(consejo);
        nodoResultados.appendChild(crearGrilla(libros));

        // Paginación solo si hay más de una página
        if (totalPaginas > 1) {
          if (nodoPaginacion && nodoPaginacion.parentNode) {
            nodoPaginacion.parentNode.removeChild(nodoPaginacion);
          }
          nodoPaginacion = crearPaginacion();
          nodoResultados.appendChild(nodoPaginacion);
        } else if (nodoPaginacion && nodoPaginacion.parentNode) {
          nodoPaginacion.parentNode.removeChild(nodoPaginacion);
          nodoPaginacion = null;
        }
      }

    } catch (err) {
      window.Libreria.api.ocultarCargando(nodoResultados);
      mostrarMensaje(MENSAJE_ERROR_CONEXION + ' (' + err.message + ')', 'error');
    } finally {
      cargando = false;
    }
  }

  /** Crea el buscador por título. */
  function crearBuscador() {
    var buscador = window.Libreria.catalogoBuscador.crear({
      valor: consulta,
      alBuscar: function (texto) {
        consulta = texto;
        paginaActual = 1; // Reiniciar paginación al buscar (según consigna)
        cargarYRenderizar();
      },
      alCambiar: function (texto) {
        // Opcional: búsqueda en vivo (debounce se puede agregar luego)
        consulta = texto;
      },
      alLimpiar: function () {
        consulta = '';
        paginaActual = 1;
        cargarYRenderizar();
      }
    });

    return buscador.formulario;
  }

  window.Libreria.vistas.catalogo = {
    render: function (seccion) {
      var fragmento = document.createDocumentFragment();

      quitarMensaje();
      nodoRegion = seccion ? seccion.querySelector('.region-mensajes') : null;
      nodoResultados = document.createElement('div');
      nodoResultados.className = CLASE_RESULTADOS;

      fragmento.appendChild(crearBuscador());
      fragmento.appendChild(nodoResultados);

      // Cargar primera página
      cargarYRenderizar();

      return fragmento;
    },

    alCambiarElStore: function () {
      // Con API no usamos el store local, pero mantenemos la firma por compatibilidad
      // Si se hace un alta de libro desde otra vista, recargar página actual
      return cargarYRenderizar();
    }
  };
}());