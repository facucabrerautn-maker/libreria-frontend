/*
 * Librería — Global de Programación III.
 * Módulo: js/vistas/catalogo-fichas.js
 * Responsabilidad: construir la ficha de un libro del catálogo usando datos de la API.
 *
 * Variante de enlace: scripts clásicos con IIFE. El módulo publica su contrato
 * en el namespace único window.Libreria.
 *
 * La respuesta de la API incluye: editorial_nombre, genero_nombre, autores[]
 * Si el género es nulo, se muestra «Sin clasificar».
 */
(function () {
  'use strict';

  window.Libreria = window.Libreria || {};

  var TEXTO_SIN_GENERO = 'Sin clasificar';
  var TEXTO_SIN_AUTORES = 'Sin autores';
  var TEXTO_SIN_EDITORIAL = 'Editorial desconocida';

  /** Convierte un valor cualquiera en texto. */
  function texto(valor) {
    return valor === null || valor === undefined ? '' : String(valor);
  }

  /** Nombre de la editorial del libro (viene en libro.editorial_nombre de la API). */
  function nombreEditorial(libro) {
    var nombre = libro.editorial_nombre ? texto(libro.editorial_nombre).trim() : '';
    return nombre === '' ? TEXTO_SIN_EDITORIAL : nombre;
  }

  /** Nombre del género del libro (viene en libro.genero_nombre de la API). */
  function nombreGenero(libro) {
    if (!libro.genero_nombre) {
      return null;
    }
    var nombre = texto(libro.genero_nombre).trim();
    return nombre === '' ? null : nombre;
  }

  /** Nombres de los autores del libro (viene en libro.autores[] de la API). */
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

  /** Arma la lista de datos de la ficha (ISBN, editorial, autores, precio). */
  function crearDatos(pares) {
    var lista = document.createElement('dl');
    lista.className = 'ficha';

    pares.forEach(function (par) {
      var termino = document.createElement('dt');
      termino.className = 'ficha__etiqueta';
      termino.textContent = par[0];

      var valor = document.createElement('dd');
      valor.className = par[2] ? 'ficha__valor ' + par[2] : 'ficha__valor';
      valor.textContent = par[1];

      lista.appendChild(termino);
      lista.appendChild(valor);
    });

    return lista;
  }

  /**
   * Crea la ficha de un libro: título, ISBN, editorial, género, autores y
   * precio. Un libro sin género muestra el badge «Sin clasificar».
   */
  function crearFicha(libro) {
    if (!libro) {
      return null;
    }

    var ficha = document.createElement('article');
    ficha.className = 'tarjeta';

    var cabecera = document.createElement('div');
    cabecera.className = 'tarjeta__cabecera';

    var titulo = document.createElement('h2');
    titulo.className = 'tarjeta__titulo';
    titulo.textContent = texto(libro.titulo);
    cabecera.appendChild(titulo);

    var genero = nombreGenero(libro);
    var badge = document.createElement('span');
    badge.className = genero ? 'badge badge--acento' : 'badge badge--sin-clasificar';
    badge.textContent = genero || TEXTO_SIN_GENERO;
    cabecera.appendChild(badge);

    ficha.appendChild(cabecera);

    ficha.appendChild(
      crearDatos([
        ['ISBN', texto(libro.isbn)],
        ['Editorial', nombreEditorial(libro)],
        ['Autores', nombresAutores(libro)],
        ['Precio', window.Libreria.ui.formatearMonto(libro.precio), 'ficha__precio']
      ])
    );

    return ficha;
  }

  window.Libreria.catalogoFichas = {
    /** Ficha completa de un libro del catálogo. */
    crearFicha: crearFicha,
    /** Nombre de la editorial del libro (o el texto alternativo). */
    nombreEditorial: nombreEditorial,
    /** Nombre del género del libro, o null si no tiene género. */
    nombreGenero: nombreGenero,
    /** Nombres de los autores del libro, separados por coma. */
    nombresAutores: nombresAutores
  };
}());