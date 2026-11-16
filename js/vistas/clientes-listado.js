/*
 * Librería — Global de Programación III.
 * Módulo: js/vistas/clientes-listado.js
 * Responsabilidad: construir la tabla de clientes registrados usando la API.
 *
 * Variante de enlace: scripts clásicos con IIFE. El módulo publica su contrato
 * en el namespace único window.Libreria.
 *
 * Usa GET /api/clientes/ (si existe) o fallback para listar.
 * La tabla muestra nombre y email; no edita ni borra.
 */
(function () {
  'use strict';

  window.Libreria = window.Libreria || {};

  var ENCABEZADOS = ['Nombre completo', 'Email'];
  var CAPTION = 'Clientes registrados';
  var TEXTO_VACIO = 'Todavía no hay clientes registrados.';

  window.Libreria.clientesListado = {
    /**
     * Devuelve la tabla de clientes dentro de su contenedor con scroll propio.
     * La tabla sale de la API (GET /api/clientes/).
     */
    crear: async function () {
      var contenedor = document.createElement('div');

      window.Libreria.api.mostrarCargando(contenedor);

      try {
        // Intentar listar clientes desde la API (paginado, traer todo con size grande)
        var respuesta = await window.Libreria.api.listarClientes({ page: 1, size: 100 });
        window.Libreria.api.ocultarCargando(contenedor);

        var clientes = [];
        if (respuesta.ok && respuesta.data && respuesta.data.items) {
          clientes = respuesta.data.items;
        } else {
          // Fallback: si la API falla, usar localStorage
          if (window.Libreria.datos && window.Libreria.datos.listarClientes) {
            clientes = window.Libreria.datos.listarClientes();
          }
        }

        var filas = clientes.map(function (cliente) {
          return [cliente.nombre, cliente.email];
        });

        contenedor.appendChild(
          window.Libreria.ui.crearTabla(ENCABEZADOS, filas, {
            claseTabla: 'tabla tabla-clientes',
            titulo: CAPTION,
            vacia: TEXTO_VACIO
          })
        );
      } catch (err) {
        window.Libreria.api.ocultarCargando(contenedor);
        var error = document.createElement('p');
        error.className = 'tabla__error';
        error.textContent = 'No se pudo cargar el listado: ' + err.message;
        contenedor.appendChild(error);
      }

      return contenedor;
    }
  };
}());