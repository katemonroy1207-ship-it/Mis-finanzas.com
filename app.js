/* ============================================================
   MIS FINANZAS – Lógica de la aplicación
   - Registro de movimientos y metas (persistencia en localStorage)
   - Integración con la API RESTful pública Frankfurter
     para mostrar el tipo de cambio MXN -> USD / EUR
   ============================================================ */

/* ----------- Configuración de categorías ----------- */
const CATEGORIAS = {
  comida:          { label: "Comida",          icon: "bi-egg-fried",      color: "#C1543C" },
  transporte:      { label: "Transporte",      icon: "bi-bus-front",      color: "#3D6EBC" },
  entretenimiento: { label: "Entretenimiento", icon: "bi-film",           color: "#8E6BBF" },
  escuela:         { label: "Escuela",         icon: "bi-book",           color: "#4C9A6B" },
  ropa:            { label: "Ropa",            icon: "bi-bag",            color: "#D9A441" },
  ahorro:          { label: "Ahorro",          icon: "bi-piggy-bank",     color: "#4C9A6B" },
  otro:            { label: "Otro",            icon: "bi-three-dots",     color: "#8A8074" },
};

const CONCEPTOS_APRENDE = [
  { icon: "bi-pie-chart", titulo: "Regla 50/30/20",
    texto: "Divide tu dinero: 50% en lo necesario (comida, transporte), 30% en gustos y 20% en ahorro o pago de deudas. Es un punto de partida simple para organizar cualquier ingreso." },
  { icon: "bi-graph-up", titulo: "Ahorrar vs. invertir",
    texto: "Ahorrar es guardar dinero seguro para el corto plazo. Invertir es poner tu dinero a trabajar (por ejemplo en un instrumento financiero) para que crezca a largo plazo, aceptando cierto riesgo." },
  { icon: "bi-arrow-repeat", titulo: "Interés compuesto",
    texto: "Es el interés que ganas sobre el interés anterior, no solo sobre el dinero inicial. Mientras antes empieces a ahorrar o invertir, más tiempo tiene tu dinero para crecer solo." },
  { icon: "bi-shield-check", titulo: "Fondo de emergencia",
    texto: "Es dinero apartado únicamente para imprevistos (una urgencia médica, perder tu trabajo, etc.). Lo ideal es que cubra de 3 a 6 meses de tus gastos básicos." },
  { icon: "bi-credit-card", titulo: "Deuda buena y mala",
    texto: "Una deuda 'buena' te ayuda a generar valor a futuro (como estudiar o poner un negocio). Una deuda 'mala' financia gustos que pierden valor y solo generan intereses." },
  { icon: "bi-clipboard-check", titulo: "¿Qué es un presupuesto?",
    texto: "Es un plan de cuánto vas a ganar y cuánto vas a gastar en un periodo. Te ayuda a saber a dónde se va tu dinero y a decidir a dónde quieres que vaya." },
];

/* ----------- Claves de localStorage ----------- */
const LS_MOVIMIENTOS = "mf_movimientos";
const LS_METAS = "mf_metas";
const LS_TC_CACHE = "mf_tipo_cambio_cache";
const TC_CACHE_MS = 60 * 60 * 1000; // 1 hora

/* ----------- Estado en memoria ----------- */
let movimientos = cargar(LS_MOVIMIENTOS, []);
let metas = cargar(LS_METAS, []);
let filtroActual = "todos";

/* ----------- Utilidades ----------- */
function cargar(clave, porDefecto) {
  try {
    const raw = localStorage.getItem(clave);
    return raw ? JSON.parse(raw) : porDefecto;
  } catch (e) {
    console.error("Error leyendo localStorage:", clave, e);
    return porDefecto;
  }
}

function guardar(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch (e) {
    console.error("Error guardando en localStorage:", clave, e);
  }
}

function formatoMoneda(n) {
  return "$" + Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatoFechaCorta(fechaISO) {
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const [y, m, d] = fechaISO.split("-").map(Number);
  return `${d} ${meses[m - 1]}`;
}

function idUnico() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function esMovimientoDelMes(mov, fechaRef = new Date()) {
  const [y, m] = mov.fecha.split("-").map(Number);
  return y === fechaRef.getFullYear() && m === fechaRef.getMonth() + 1;
}

/* ============================================================
   NAVEGACIÓN ENTRE VISTAS
   ============================================================ */
function cambiarVista(vista) {
  document.querySelectorAll(".view").forEach((v) => v.classList.add("d-none"));
  document.getElementById(`view-${vista}`).classList.remove("d-none");

  document.querySelectorAll(".nav-link-item, .nav-bottom-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.view === vista);
  });

  if (vista === "movimientos") renderMovimientos();
  if (vista === "metas") renderMetas();
  if (vista === "aprende") renderAprende();
  if (vista === "inicio") renderInicio();
}

document.querySelectorAll("[data-view]").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    cambiarVista(el.dataset.view);
  });
});

/* ============================================================
   RENDER: INICIO (Dashboard)
   ============================================================ */
function renderInicio() {
  const ahora = new Date();
  const ingresosMes = movimientos.filter((m) => m.tipo === "ingreso" && esMovimientoDelMes(m, ahora))
    .reduce((s, m) => s + m.monto, 0);
  const gastosMes = movimientos.filter((m) => m.tipo === "gasto" && esMovimientoDelMes(m, ahora))
    .reduce((s, m) => s + m.monto, 0);
  const saldoTotal = movimientos.reduce((s, m) => s + (m.tipo === "ingreso" ? m.monto : -m.monto), 0);
  const ahorradoMetas = metas.reduce((s, m) => s + m.montoActual, 0);

  document.getElementById("kpi-saldo").textContent = formatoMoneda(saldoTotal);
  document.getElementById("kpi-ingresos").textContent = formatoMoneda(ingresosMes);
  document.getElementById("kpi-gastos").textContent = formatoMoneda(gastosMes);
  document.getElementById("kpi-ahorro").textContent = formatoMoneda(ahorradoMetas);

  // Últimos movimientos (5 más recientes)
  const listaUltimos = document.getElementById("lista-ultimos");
  const ultimos = [...movimientos].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 5);
  listaUltimos.innerHTML = "";
  document.getElementById("ultimos-vacio").classList.toggle("d-none", ultimos.length > 0);
  ultimos.forEach((m) => listaUltimos.appendChild(crearElementoMovimiento(m)));

  // Gastos por categoría (mes actual)
  const porCategoria = {};
  movimientos.filter((m) => m.tipo === "gasto" && esMovimientoDelMes(m, ahora)).forEach((m) => {
    porCategoria[m.categoria] = (porCategoria[m.categoria] || 0) + m.monto;
  });
  const maxCat = Math.max(1, ...Object.values(porCategoria));
  const listaCat = document.getElementById("lista-categorias");
  listaCat.innerHTML = "";
  const entradas = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]);
  document.getElementById("categorias-vacio").classList.toggle("d-none", entradas.length > 0);
  entradas.forEach(([cat, monto]) => {
    const info = CATEGORIAS[cat] || CATEGORIAS.otro;
    const fila = document.createElement("div");
    fila.className = "cat-row";
    fila.innerHTML = `
      <div class="cat-head">
        <span><i class="bi ${info.icon}"></i> ${info.label}</span>
        <span>${formatoMoneda(monto)}</span>
      </div>
      <div class="cat-bar"><div class="cat-bar-fill" style="width:${(monto / maxCat) * 100}%; background:${info.color}"></div></div>
    `;
    listaCat.appendChild(fila);
  });

  actualizarConversionesEnMetas();
}

function crearElementoMovimiento(m) {
  const info = CATEGORIAS[m.categoria] || CATEGORIAS.otro;
  const div = document.createElement("div");
  div.className = "mov-item";
  div.innerHTML = `
    <div class="mov-info">
      <div class="mov-icono" style="background:${info.color}22;color:${info.color}">
        <i class="bi ${m.tipo === "ingreso" ? "bi-arrow-down-circle" : info.icon}"></i>
      </div>
      <div>
        <div class="mov-desc">${escapeHtml(m.descripcion)}</div>
        <div class="mov-meta">${info.label} · ${formatoFechaCorta(m.fecha)}</div>
      </div>
    </div>
    <div class="d-flex align-items-center">
      <span class="mov-monto ${m.tipo}">${m.tipo === "ingreso" ? "+" : "−"} ${formatoMoneda(m.monto)}</span>
      <button class="mov-borrar" data-id="${m.id}" title="Eliminar"><i class="bi bi-trash"></i></button>
    </div>
  `;
  div.querySelector(".mov-borrar").addEventListener("click", () => eliminarMovimiento(m.id));
  return div;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ============================================================
   RENDER: MOVIMIENTOS
   ============================================================ */
function renderMovimientos() {
  const lista = document.getElementById("lista-movimientos");
  lista.innerHTML = "";
  let filtrados = [...movimientos].sort((a, b) => b.fecha.localeCompare(a.fecha));
  if (filtroActual !== "todos") {
    filtrados = filtrados.filter((m) => m.tipo === filtroActual);
  }
  document.getElementById("movimientos-vacio").classList.toggle("d-none", filtrados.length > 0);
  filtrados.forEach((m) => lista.appendChild(crearElementoMovimiento(m)));
}

document.querySelectorAll(".btn-filtro").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".btn-filtro").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    filtroActual = btn.dataset.filtro;
    renderMovimientos();
  });
});

function eliminarMovimiento(id) {
  movimientos = movimientos.filter((m) => m.id !== id);
  guardar(LS_MOVIMIENTOS, movimientos);
  renderInicio();
  renderMovimientos();
}

/* ============================================================
   FORMULARIO: NUEVO MOVIMIENTO
   ============================================================ */
document.getElementById("mov-fecha").value = new Date().toISOString().slice(0, 10);

document.getElementById("form-movimiento").addEventListener("submit", (e) => {
  e.preventDefault();
  const tipo = document.querySelector('input[name="tipo"]:checked').value;
  const descripcion = document.getElementById("mov-descripcion").value.trim();
  const categoria = document.getElementById("mov-categoria").value;
  const monto = parseFloat(document.getElementById("mov-monto").value);
  const fecha = document.getElementById("mov-fecha").value;

  if (!descripcion || !monto || !fecha) return;

  movimientos.push({ id: idUnico(), tipo, descripcion, categoria, monto, fecha });
  guardar(LS_MOVIMIENTOS, movimientos);

  e.target.reset();
  document.getElementById("mov-fecha").value = new Date().toISOString().slice(0, 10);
  bootstrap.Modal.getInstance(document.getElementById("modalMovimiento")).hide();

  renderInicio();
  renderMovimientos();
});

/* ============================================================
   RENDER: METAS
   ============================================================ */
function renderMetas() {
  const lista = document.getElementById("lista-metas");
  lista.innerHTML = "";
  document.getElementById("metas-vacio").classList.toggle("d-none", metas.length > 0);

  metas.forEach((meta) => {
    const pct = Math.min(100, Math.round((meta.montoActual / meta.montoObjetivo) * 100));
    const lograda = pct >= 100;

    const col = document.createElement("div");
    col.className = "col-12 col-md-6 col-lg-4";
    col.innerHTML = `
      <div class="meta-card ${lograda ? "lograda" : ""}">
        <div class="d-flex justify-content-between align-items-start">
          <h6 class="mb-1">${escapeHtml(meta.nombre)}</h6>
          <button class="mov-borrar" data-id="${meta.id}" title="Eliminar meta"><i class="bi bi-trash"></i></button>
        </div>
        <p class="small text-muted mb-0">${formatoMoneda(meta.montoActual)} de ${formatoMoneda(meta.montoObjetivo)}</p>
        <div class="meta-progreso"><div class="meta-progreso-fill" style="width:${pct}%"></div></div>
        <p class="small mb-2">${pct}% completado ${lograda ? "🎉" : ""}</p>
        <p class="meta-divisas mb-3" data-meta-divisas="${meta.id}">Equivalente: — USD · — EUR</p>
        <button class="btn btn-dark btn-sm w-100 btn-abonar" data-id="${meta.id}" data-nombre="${escapeHtml(meta.nombre)}" ${lograda ? "disabled" : ""}>
          <i class="bi bi-plus-circle"></i> Abonar
        </button>
      </div>
    `;
    col.querySelector(".mov-borrar").addEventListener("click", () => eliminarMeta(meta.id));
    const btnAbonar = col.querySelector(".btn-abonar");
    if (btnAbonar) {
      btnAbonar.addEventListener("click", () => abrirModalAbono(meta.id, meta.nombre));
    }
    lista.appendChild(col);
  });

  actualizarConversionesEnMetas();
}

function eliminarMeta(id) {
  metas = metas.filter((m) => m.id !== id);
  guardar(LS_METAS, metas);
  renderMetas();
  renderInicio();
}

document.getElementById("form-meta").addEventListener("submit", (e) => {
  e.preventDefault();
  const nombre = document.getElementById("meta-nombre").value.trim();
  const montoObjetivo = parseFloat(document.getElementById("meta-objetivo").value);
  const montoActual = parseFloat(document.getElementById("meta-inicial").value) || 0;

  if (!nombre || !montoObjetivo) return;

  metas.push({ id: idUnico(), nombre, montoObjetivo, montoActual });
  guardar(LS_METAS, metas);

  e.target.reset();
  bootstrap.Modal.getInstance(document.getElementById("modalMeta")).hide();

  renderMetas();
  renderInicio();
});

function abrirModalAbono(id, nombre) {
  document.getElementById("abono-meta-id").value = id;
  document.getElementById("abono-meta-nombre").textContent = nombre;
  document.getElementById("abono-monto").value = "";
  new bootstrap.Modal(document.getElementById("modalAbono")).show();
}

document.getElementById("form-abono").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("abono-meta-id").value;
  const monto = parseFloat(document.getElementById("abono-monto").value);
  if (!monto) return;

  const meta = metas.find((m) => m.id === id);
  if (meta) {
    meta.montoActual = Math.min(meta.montoObjetivo, meta.montoActual + monto);
    guardar(LS_METAS, metas);
  }

  bootstrap.Modal.getInstance(document.getElementById("modalAbono")).hide();
  renderMetas();
  renderInicio();
});

/* ============================================================
   RENDER: APRENDE
   ============================================================ */
function renderAprende() {
  const lista = document.getElementById("lista-aprende");
  lista.innerHTML = "";
  CONCEPTOS_APRENDE.forEach((c) => {
    const col = document.createElement("div");
    col.className = "col-12 col-md-6 col-lg-4";
    col.innerHTML = `
      <div class="aprende-card">
        <i class="bi ${c.icon}"></i>
        <h6>${c.titulo}</h6>
        <p class="small text-muted mb-0">${c.texto}</p>
      </div>
    `;
    lista.appendChild(col);
  });
}

/* ============================================================
   API RESTFUL — Frankfurter (tipo de cambio MXN -> USD / EUR)
   Documentación: https://frankfurter.dev
   Endpoint: GET https://api.frankfurter.dev/v1/latest?base=MXN&symbols=USD,EUR
   ============================================================ */
async function obtenerTipoCambio(forzar = false) {
  const cache = cargar(LS_TC_CACHE, null);
  const ahora = Date.now();

  if (!forzar && cache && ahora - cache.timestamp < TC_CACHE_MS) {
    mostrarTipoCambio(cache);
    return;
  }

  mostrarCargandoTC();

  try {
    const resp = await fetch("https://api.frankfurter.dev/v1/latest?base=MXN&symbols=USD,EUR");
    if (!resp.ok) throw new Error("Respuesta no válida del servicio");
    const data = await resp.json();

    const resultado = {
      usdPorMxn: data.rates.USD,
      eurPorMxn: data.rates.EUR,
      mxnPorUsd: 1 / data.rates.USD,
      mxnPorEur: 1 / data.rates.EUR,
      fecha: data.date,
      timestamp: ahora,
    };

    guardar(LS_TC_CACHE, resultado);
    mostrarTipoCambio(resultado);
  } catch (err) {
    console.error("Error al consultar la API de tipo de cambio:", err);
    mostrarErrorTC(cache);
  }
}

function mostrarCargandoTC() {
  document.getElementById("tc-cargando").classList.remove("d-none");
  document.getElementById("tc-error").classList.add("d-none");
  document.getElementById("tc-valores").classList.add("d-none");
  document.getElementById("tc-actualizado").textContent = "Consultando servicio…";
}

function mostrarTipoCambio(datos) {
  document.getElementById("tc-cargando").classList.add("d-none");
  document.getElementById("tc-error").classList.add("d-none");
  document.getElementById("tc-valores").classList.remove("d-none");

  document.getElementById("tc-usd").textContent = formatoMoneda(datos.mxnPorUsd) + " MXN";
  document.getElementById("tc-eur").textContent = formatoMoneda(datos.mxnPorEur) + " MXN";

  const hora = new Date(datos.timestamp).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  document.getElementById("tc-actualizado").textContent =
    `Fecha del servicio: ${datos.fecha} · Actualizado a las ${hora} (fuente: api.frankfurter.dev)`;

  actualizarConversionesEnMetas(datos);
}

function mostrarErrorTC(cache) {
  document.getElementById("tc-cargando").classList.add("d-none");
  document.getElementById("tc-error").classList.remove("d-none");

  if (cache) {
    mostrarTipoCambio(cache);
    document.getElementById("tc-actualizado").textContent += " — mostrando último valor guardado.";
  } else {
    document.getElementById("tc-valores").classList.add("d-none");
  }
}

function actualizarConversionesEnMetas(datosParam) {
  const datos = datosParam || cargar(LS_TC_CACHE, null);
  if (!datos) return;
  document.querySelectorAll("[data-meta-divisas]").forEach((el) => {
    const id = el.dataset.metaDivisas;
    const meta = metas.find((m) => m.id === id);
    if (!meta) return;
    const usd = meta.montoActual * datos.usdPorMxn;
    const eur = meta.montoActual * datos.eurPorMxn;
    el.textContent = `Equivalente: ${usd.toFixed(2)} USD · ${eur.toFixed(2)} EUR`;
  });
}

document.getElementById("btn-refrescar-tc").addEventListener("click", () => obtenerTipoCambio(true));

/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
renderInicio();
obtenerTipoCambio();
