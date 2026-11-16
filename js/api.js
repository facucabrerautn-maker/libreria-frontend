/*
 * Librería — Global de Programación III.
 * Módulo: js/api.js
 * Responsabilidad: cliente HTTP centralizado para consumir la API FastAPI.
 * Base URL: /api/ (con barra final, según consigna).
 * Manejo de estados: carga, lista vacía, sin coincidencias, error de conexión.
 * Códigos de error: 409 (conflicto), 422 (validación), 5xx (servidor).
 */
(function () {
  'use strict';

  window.Libreria = window.Libreria || {};

  // URL base del proxy Nginx: /api/ -> FastAPI
  var API_BASE = '/api/';

  // Clases CSS para estados
  var CLASE_CARGANDO = 'cargando';
  var CLASE_ERROR = 'error';

  /**
   * Normaliza la URL: asegura que termine en / y prepende API_BASE si es ruta relativa.
   */
  function normalizarUrl(ruta) {
    var r = String(ruta || '').trim();
    if (r === '') return API_BASE;
    if (r.charAt(0) !== '/') r = '/' + r;
    // Si ya empieza con /api/, no duplicar
    if (r.indexOf('/api/') === 0) return r;
    return API_BASE + r.replace(/^\//, '');
  }

  /**
   * Fetch con manejo de errores estandarizado.
   * Devuelve { ok: true, data } o { ok: false, error, status, mensaje }.
   */
  async function fetchJson(ruta, opciones) {
    var url = normalizarUrl(ruta);
    var init = Object.assign({}, opciones, {
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }, (opciones && opciones.headers) || {})
    });

    try {
      var respuesta = await fetch(url, init);

      // Leer cuerpo una sola vez
      var contenido = '';
      var tipo = respuesta.headers.get('content-type') || '';
      if (tipo.indexOf('application/json') !== -1) {
        contenido = await respuesta.json();
      } else {
        contenido = await respuesta.text();
      }

      if (!respuesta.ok) {
        var mensaje = '';
        if (typeof contenido === 'object' && contenido !== null) {
          mensaje = contenido.detail || contenido.message || JSON.stringify(contenido);
        } else if (contenido) {
          mensaje = String(contenido);
        } else {
          mensaje = 'Error ' + respuesta.status + ' ' + respuesta.statusText;
        }
        return {
          ok: false,
          error: true,
          status: respuesta.status,
          mensaje: mensaje,
          data: contenido
        };
      }

      return { ok: true, data: contenido, status: respuesta.status };

    } catch (err) {
      // Error de red / CORS / etc.
      return {
        ok: false,
        error: true,
        status: 0,
        mensaje: 'No se pudo conectar con la API: ' + (err.message || err),
        data: null
      };
    }
  }

  /**
   * Helpers HTTP
   */
  function get(ruta) {
    return fetchJson(ruta, { method: 'GET' });
  }

  function post(ruta, cuerpo) {
    return fetchJson(ruta, {
      method: 'POST',
      body: JSON.stringify(cuerpo)
    });
  }

  function patch(ruta, cuerpo) {
    return fetchJson(ruta, {
      method: 'PATCH',
      body: JSON.stringify(cuerpo)
    });
  }

  function del(ruta) {
    return fetchJson(ruta, { method: 'DELETE' });
  }

  // ==================== ENDPOINTS DEL CATÁLOGO ====================

  /**
   * GET /libros/?page=1&size=20&titulo=...
   * Respuesta: { items: [...], total, page, size, pages }
   */
  function listarLibros(params) {
    var query = [];
    if (params.page) query.push('page=' + params.page);
    if (params.size) query.push('size=' + params.size);
    if (params.titulo) query.push('titulo=' + encodeURIComponent(params.titulo));
    if (params.genero_id) query.push('genero_id=' + params.genero_id);

    var url = '/libros/';
    if (query.length) url += '?' + query.join('&');
    return get(url);
  }

  /**
   * GET /libros/{id} - Detalle con autores
   */
  function obtenerLibro(id) {
    return get('/libros/' + id);
  }

  /**
   * POST /libros/ - Alta de libro
   * Body: { isbn, titulo, precio, stock_inicial, editorial_id, genero_id, autores: [{autor_id, rol, orden}] }
   */
  function crearLibro(data) {
    return post('/libros/', data);
  }

  // ==================== EDITORIALES ====================

  function listarEditoriales() {
    return get('/editoriales/');
  }

  function obtenerEditorial(id) {
    return get('/editoriales/' + id);
  }

  // ==================== GÉNEROS ====================

  function listarGeneros() {
    return get('/generos/');
  }

  function obtenerGenero(id) {
    return get('/generos/' + id);
  }

  // ==================== AUTORES ====================

  function obtenerAutor(id) {
    return get('/autores/' + id);
  }

  function listarAutores() {
    // El backend no tiene listado de autores público, usamos obtenerAutor por ID
    // Para el selector, necesitamos un listado; si no existe endpoint, devolvemos vacío
    return get('/autores/');
  }

  // ==================== CLIENTES ====================

  /**
   * GET /clientes/?page=1&size=20
   * Respuesta: { items: [...], total, page, size, pages }
   */
  function listarClientes(params) {
    var query = [];
    if (params.page) query.push('page=' + params.page);
    if (params.size) query.push('size=' + params.size);
    var url = '/clientes/';
    if (query.length) url += '?' + query.join('&');
    return get(url);
  }

  function obtenerCliente(id) {
    return get('/clientes/' + id);
  }

  function crearCliente(data) {
    return post('/clientes/', data);
  }

  // ==================== VENTAS ====================

  /**
   * GET /ventas/?limit=20&offset=0
   * Respuesta: { items: [...], total, page, size, pages }
   */
  function listarVentas(params) {
    var query = [];
    if (params.limit) query.push('limit=' + params.limit);
    if (params.offset !== undefined) query.push('offset=' + params.offset);
    var url = '/ventas/';
    if (query.length) url += '?' + query.join('&');
    return get(url);
  }

  /**
   * GET /ventas/{id} - Detalle con renglones e importes históricos
   */
  function obtenerVenta(id) {
    return get('/ventas/' + id);
  }

  /**
   * POST /ventas/ - Registrar venta
   * Body: { cliente_id, renglones: [{libro_id, cantidad}] }
   */
  function crearVenta(data) {
    return post('/ventas/', data);
  }

  // ==================== HEALTH ====================

  function healthReady() {
    return get('/health/ready');
  }

  // ==================== EXPORTS ====================

  window.Libreria.api = {
    // Config
    API_BASE: API_BASE,

    // HTTP helpers
    get: get,
    post: post,
    patch: patch,
    delete: del,

    // Libros
    listarLibros: listarLibros,
    obtenerLibro: obtenerLibro,
    crearLibro: crearLibro,

    // Editoriales
    listarEditoriales: listarEditoriales,
    obtenerEditorial: obtenerEditorial,

    // Géneros
    listarGeneros: listarGeneros,
    obtenerGenero: obtenerGenero,

    // Autores
    obtenerAutor: obtenerAutor,

    // Clientes
    listarClientes: listarClientes,
    obtenerCliente: obtenerCliente,
    crearCliente: crearCliente,

    // Ventas
    listarVentas: listarVentas,
    obtenerVenta: obtenerVenta,
    crearVenta: crearVenta,

    // Health
    healthReady: healthReady,

    // Utilidad para UI: mostrar estado de carga en un contenedor
    mostrarCargando: function (contenedor) {
      if (!contenedor) return;
      contenedor.classList.add(CLASE_CARGANDO);
      var spinner = document.createElement('div');
      spinner.className = 'spinner';
      spinner.setAttribute('role', 'status');
      spinner.setAttribute('aria-label', 'Cargando...');
      spinner.textContent = 'Cargando...';
      contenedor.appendChild(spinner);
    },

    ocultarCargando: function (contenedor) {
      if (!contenedor) return;
      contenedor.classList.remove(CLASE_CARGANDO);
      var spinner = contenedor.querySelector('.spinner');
      if (spinner) spinner.remove();
    },

    mostrarError: function (contenedor, mensaje) {
      if (!contenedor) return;
      contenedor.classList.add(CLASE_ERROR);
      var err = document.createElement('div');
      err.className = 'api-error';
      err.setAttribute('role', 'alert');
      err.textContent = mensaje;
      contenedor.appendChild(err);
    },

    limpiarErrores: function (contenedor) {
      if (!contenedor) return;
      contenedor.classList.remove(CLASE_ERROR);
      var errores = contenedor.querySelectorAll('.api-error');
      errores.forEach(function (e) { e.remove(); });
    }
  };
}());