/*
 * Librería — Global de Programación III.
 * Módulo: js/vistas/clientes.js
 * Responsabilidad: render y eventos de la vista Clientes: alta, validación,
 * mensajes y listado de clientes registrados usando la API.
 *
 * Variante de enlace: scripts clásicos con IIFE. El módulo publica su contrato
 * en el namespace único window.Libreria, dentro de Libreria.vistas.
 *
 * El submit se intercepta con preventDefault, valida y llama a POST /api/clientes/.
 * Si hay errores (409 email duplicado, 422 validación), se muestran junto a su control.
 * El alta exitosa limpia el formulario, informa y refresca el listado.
 */
(function () {
  'use strict';

  window.Libreria = window.Libreria || {};
  window.Libreria.vistas = window.Libreria.vistas || {};

  var CLASE_CONTENIDO = 'vista-clientes__contenido';
  var CLASE_LISTADO = 'vista-clientes__listado';
  var SELECTOR_REGION = '.region-mensajes';
  var MENSAJE_FALLO = 'No se pudo registrar el cliente: revisá los datos e intentá de nuevo.';

  var nodoRegion = null;
  var nodoListado = null;
  var nodoMensaje = null;
  var limpiarFormulario = null;

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

  /** Repinta solo el listado, sin duplicar nodos. */
  async function pintarListado() {
    if (!nodoListado) {
      return false;
    }
    while (nodoListado.firstChild) {
      nodoListado.removeChild(nodoListado.firstChild);
    }
    nodoListado.appendChild(await window.Libreria.clientesListado.crear());
    return true;
  }

  function textoDeAlta(cliente) {
    return 'Cliente «' + cliente.nombre + '» registrado correctamente.';
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
    var nombre = contexto.nombre ? contexto.nombre.trim() : '';
    var email = contexto.email ? contexto.email.trim() : '';
    if (!nombre) errores.push({ campo: 'nombre', mensaje: 'El nombre es obligatorio.' });
    if (!email) errores.push({ campo: 'email', mensaje: 'El email es obligatorio.' });
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errores.push({ campo: 'email', mensaje: 'El email no tiene un formato válido.' });
    }

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
      var data = { nombre: nombre, email: email };
      var respuesta = await window.Libreria.api.crearCliente(data);

      if (!respuesta.ok) {
        if (respuesta.status === 409) {
          ui.mostrarErrores(nodoRegion, [{
            campo: 'email',
            mensaje: respuesta.mensaje || 'Ya existe un cliente con ese email.'
          }], { formulario: formulario });
        } else if (respuesta.status === 422) {
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
          throw new Error(respuesta.mensaje || 'Error al registrar cliente');
        }
        ui.enfocarPrimerError(formulario);
        return false;
      }

      // Éxito
      var clienteCreado = respuesta.data;
      // Limpiar formulario usando la función del formulario creado
      if (typeof limpiarFormulario === 'function') {
        limpiarFormulario();
      }

      await pintarListado();
      mostrarResultado(textoDeAlta(clienteCreado), 'exito');
      return true;

    } catch (err) {
      mostrarResultado(MENSAJE_FALLO + ' (' + err.message + ')', 'error');
      return false;
    } finally {
      if (boton) {
        boton.disabled = false;
        boton.textContent = 'Registrar cliente';
      }
    }
  }

  window.Libreria.vistas.clientes = {
    /**
     * Renderiza la vista Clientes: devuelve el fragmento con el formulario y el
     * listado. La sección ya trae su h1 y su región de mensajes.
     */
    render: function (seccion) {
      var fragmento = document.createDocumentFragment();

      quitarMensaje();
      nodoRegion = seccion ? seccion.querySelector(SELECTOR_REGION) : null;

      var contenido = document.createElement('div');
      contenido.className = CLASE_CONTENIDO;

      var piezas = window.Libreria.clientesFormulario.crear({ alEnviar: alEnviar });
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
     * Repinta solo el listado cuando se solicita.
     */
    alCambiarElStore: function () {
      return pintarListado();
    }
  };
}());