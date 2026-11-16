/*
 * Librería — Global de Programación III.
 * Módulo: js/vistas/libros.js
 * Responsabilidad: render y eventos de la vista Libros: formulario de alta,
 * validación, mensajes y listado de libros registrados usando la API.
 *
 * Variante de enlace: scripts clásicos con IIFE. El módulo publica su contrato
 * en el namespace único window.Libreria, dentro de Libreria.vistas.
 *
 * El submit se intercepta con preventDefault, valida y llama a POST /api/libros/.
 * Si hay errores (409, 422), se muestran junto a su control.
 * El alta exitosa limpia el formulario, informa y refresca el listado (GET /api/libros/).
 */
(function () {
  'use strict';

  window.Libreria = window.Libreria || {};
  window.Libreria.vistas = window.Libreria.vistas || {};

  var CLASE_CONTENIDO = 'vista-libros__contenido';
  var CLASE_LISTADO = 'vista-libros__listado';
  var SELECTOR_REGION = '.region-mensajes';
  var MENSAJE_FALLO = 'No se pudo registrar el libro: revisá los datos e intentá de nuevo.';

  var nodoRegion = null;
  var nodoListado = null;
  var nodoMensaje = null;

  /** Quita el mensaje propio de la vista, sin tocar los mensajes ajenos. */
  function quitarMensaje() {
    if (nodoMensaje && nodoMensaje.parentNode) {
      nodoMensaje.parentNode.removeChild(nodoMensaje);
    }
    nodoMensaje = null;
  }

  /** Escribe un mensaje de resultado en la región de mensajes de la vista. */
  function mostrarResultado(texto, tipo) {
    quitarMensaje();
    if (!nodoRegion) {
      return null;
    }
    nodoMensaje = window.Libreria.ui.mostrarMensaje(nodoRegion, texto, tipo);
    return nodoMensaje;
  }

  /** Repinta solo el listado desde la API, sin duplicar nodos. */
  async function pintarListado() {
    if (!nodoListado) {
      return false;
    }
    while (nodoListado.firstChild) {
      nodoListado.removeChild(nodoListado.firstChild);
    }
    nodoListado.appendChild(await window.Libreria.librosListado.crear());
    return true;
  }

  function textoDeAlta(libro) {
    return 'Libro «' + libro.titulo + '» registrado correctamente.';
  }

  /**
   * Maneja el envío: limpia errores previos, valida y, si todo pasa, da de
   * alta en la API, limpia el formulario, informa y refresca el listado.
   */
  async function alEnviar(contexto, formulario, evento) {
    var ui = window.Libreria.ui;

    ui.limpiarErrores(nodoRegion, formulario);

    // Validación client-side básica
    var errores = [];
    if (!contexto.titulo) errores.push({ campo: 'titulo', mensaje: 'El título es obligatorio.' });
    if (!contexto.isbn) errores.push({ campo: 'isbn', mensaje: 'El ISBN es obligatorio.' });
    var precio = parseFloat(contexto.precio);
    if (!precio || precio <= 0) errores.push({ campo: 'precio', mensaje: 'El precio debe ser mayor a cero.' });
    if (!contexto.editorialId) errores.push({ campo: 'editorialId', mensaje: 'Debés elegir una editorial.' });
    var autores = contexto.autorIds || [];
    if (autores.length === 0) errores.push({ campo: 'autorIds', mensaje: 'Debés elegir al menos un autor.' });

    if (errores.length > 0) {
      quitarMensaje();
      ui.mostrarErrores(nodoRegion, errores, { formulario: formulario });
      ui.enfocarPrimerError(formulario);
      return false;
    }

    // Deshabilitar botón durante envío
    var boton = formulario.querySelector('button[type="submit"]');
    if (boton) {
      boton.disabled = true;
      boton.textContent = 'Registrando...';
    }

    try {
      // Preparar datos para API (formato que espera el backend)
      var data = {
        titulo: contexto.titulo,
        isbn: contexto.isbn,
        precio: parseFloat(contexto.precio),
        stock_inicial: 0,
        editorial_id: contexto.editorialId,
        genero_id: contexto.generoId,
        autores: autores.map(function (id, index) {
          return { autor_id: id, rol: 'autor', orden: index + 1 };
        })
      };

      var respuesta = await window.Libreria.api.crearLibro(data);

      if (!respuesta.ok) {
        if (respuesta.status === 409) {
          // Conflicto: ISBN duplicado u otro
          ui.mostrarErrores(nodoRegion, [{
            campo: 'isbn',
            mensaje: respuesta.mensaje || 'Ya existe un libro con ese ISBN.'
          }], { formulario: formulario });
        } else if (respuesta.status === 422) {
          // Validación server-side
          var det = respuesta.data;
          if (det && det.detail && Array.isArray(det.detail)) {
            var errs = det.detail.map(function (d) {
              return { campo: d.loc && d.loc[d.loc.length - 1] || 'formulario', mensaje: d.msg };
            });
            ui.mostrarErrores(nodoRegion, errs, { formulario: formulario });
          } else {
            ui.mostrarErrores(nodoRegion, [{ campo: 'formulario', mensaje: respuesta.mensaje || 'Datos inválidos.' }], { formulario: formulario });
          }
        } else {
          throw new Error(respuesta.mensaje || 'Error al registrar libro');
        }
        ui.enfocarPrimerError(formulario);
        return false;
      }

      // Éxito
      var libroCreado = respuesta.data;
      if (typeof limpiarFormulario === 'function') {
        limpiarFormulario();
      }
      await pintarListado();
      mostrarResultado(textoDeAlta(libroCreado), 'exito');
      return true;

    } catch (err) {
      mostrarResultado(MENSAJE_FALLO + ' (' + err.message + ')', 'error');
      return false;
    } finally {
      if (boton) {
        boton.disabled = false;
        boton.textContent = 'Registrar libro';
      }
    }
  }

  window.Libreria.vistas.libros = {
    /**
     * Renderiza la vista Libros: devuelve el fragmento con el formulario y el
     * listado. La sección ya trae su h1 y su región de mensajes.
     */
    render: function (seccion) {
      var fragmento = document.createDocumentFragment();

      quitarMensaje();
      nodoRegion = seccion ? seccion.querySelector(SELECTOR_REGION) : null;

      var contenido = document.createElement('div');
      contenido.className = CLASE_CONTENIDO;

      var piezas = window.Libreria.librosFormulario.crear({ alEnviar: alEnviar });
      limpiarFormulario = piezas.limpiar;

      nodoListado = document.createElement('div');
      nodoListado.className = CLASE_LISTADO;

      contenido.appendChild(piezas.formulario);
      contenido.appendChild(nodoListado);
      fragmento.appendChild(contenido);

      // Cargar listado inicial
      pintarListado();

      return fragmento;
    },

    /**
     * Repinta solo el listado cuando se solicita (tras alta exitosa).
     */
    alCambiarElStore: function () {
      return pintarListado();
    }
  };
}());