/*
 * Librería — Global de Programación III.
 * Módulo: js/vistas/libros-listado.js
 * Responsabilidad: construir la tabla de libros registrados usando la API.
 *
 * Variante de enlace: scripts clásicos con IIFE. El módulo publica su contrato
 * en el namespace único window.Libreria.
 *
 * Usa GET /api/libros/ para obtener la lista con datos relacionados.
 * Un libro sin género muestra «Sin clasificar».
 */
(function () {
  'use strict';

  window.Libreria = window.Libreria || {};

  var ENCABEZADOS = ['Título', 'ISBN', 'Editorial', 'Género', 'Autores', 'Precio'];
  var TEXTO_SIN_GENERO = 'Sin clasificar';
  var TEXTO_SIN_AUTORES = 'Sin autores';
  var TEXTO_SIN_EDITORIAL = 'Editorial desconocida';

  function texto(valor) {
    return valor === null || valor === undefined ? '' : String(valor);
  }

  function nombreEditorial(libro) {
    var nombre = libro.editorial_nombre ? texto(libro.editorial_nombre).trim() : '';
    return nombre === '' ? TEXTO_SIN_EDITORIAL : nombre;
  }

  function nombreGenero(libro) {
    if (!libro.genero_nombre) {
      return TEXTO_SIN_GENERO;
    }
    var nombre = texto(libro.genero_nombre).trim();
    return nombre === '' ? TEXTO_SIN_GENERO : nombre;
  }

  function nombresAutores(libro) {
    var autores = Array.isArray(libro.autores) ? libro.autores : [];
    var nombres = autores
      .map(function (a) {
        return a && a.autor_nombre ? texto(a.autor_nombre).trim() : '';
      })
      .filter(function (nombre) {
        return nombre !== '';
      });
    return nombres.length === 0 ? TEXTO_SIN_AUTORES : nombres.join(', ');
  }

  function fila(libro) {
    return [
      texto(libro.titulo),
      texto(libro.isbn),
      nombreEditorial(libro),
      nombreGenero(libro),
      nombresAutores(libro),
      window.Libreria.ui.formatearMonto(libro.precio)
    ];
  }

  window.Libreria.librosListado = {
    /**
     * Devuelve un fragmento con el título del listado y la tabla de libros desde la API.
     */
    crear: async function () {
      var fragmento = document.createDocumentFragment();

      var titulo = document.createElement('h2');
      titulo.className = 'vista-libros__listado-titulo';
      titulo.textContent = 'Libros registrados';
      fragmento.appendChild(titulo);

      // Cargar desde API
      var contenedorTabla = document.createElement('div');
      fragmento.appendChild(contenedorTabla);

      window.Libreria.api.mostrarCargando(contenedorTabla);

      try {
        var respuesta = await window.Libreria.api.listarLibros({ page: 1, size: 100 });
        window.Libreria.api.ocultarCargando(contenedorTabla);

        if (!respuesta.ok) {
          throw new Error(respuesta.mensaje || 'Error al cargar listado');
        }

        var libros = respuesta.data.items || [];

        if (libros.length === 0) {
          var vacio = document.createElement('p');
          vacio.className = 'tabla__vacio';
          vacio.textContent = 'Todavía no hay libros registrados.';
          contenedorTabla.appendChild(vacio);
        } else {
          contenedorTabla.appendChild(
            window.Libreria.ui.crearTabla(ENCABEZADOS, libros.map(fila), {
              claseTabla: 'tabla tabla-libros',
              vacia: 'Todavía no hay libros registrados.'
            })
          );
        }
      } catch (err) {
        window.Libreria.api.ocultarCargando(contenedorTabla);
        var error = document.createElement('p');
        error.className = 'tabla__error';
        error.textContent = 'No se pudo cargar el listado: ' + err.message;
        contenedorTabla.appendChild(error);
      }

      return fragmento;
    }
  };
}());