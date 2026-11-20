const $ = (id) => document.getElementById(id);

const INTERVALO_ESTADO_MS = 3000;

let dbAnterior = null;

function mostrarEstado(dbOk, texto, cacheEstado) {
  $("estado-db").className = "punto " + (dbOk ? "ok" : "caido");
  $("estado-texto").textContent = texto;
  const clase = cacheEstado === "ok" ? "ok" : cacheEstado === "caida" ? "caido" : "desconocido";
  const etiqueta = cacheEstado === "ok" ? "conectada" : cacheEstado === "caida" ? "caída" : "no aplica";
  $("estado-cache").className = "punto " + clase;
  $("estado-cache-texto").textContent = "Caché: " + etiqueta;
}

async function actualizarEstado() {
  try {
    const respuesta = await fetch("/status", { cache: "no-store" });
    const datos = await respuesta.json();
    const dbOk = datos.db === "ok";
    mostrarEstado(dbOk, dbOk ? "BD conectada" : "BD caída", datos.cache);
    $("estado-instancia").textContent = "Instancia: " + (datos.instancia ?? "?");
    if (dbOk && dbAnterior === false) recuperar();
    dbAnterior = dbOk;
  } catch {
    mostrarEstado(false, "Sin conexión con la web", "desconocido");
    dbAnterior = false;
  }
}

actualizarEstado();
setInterval(actualizarEstado, INTERVALO_ESTADO_MS);

let runActual = null;
let reglasPartida = {}; // runs.rules de la partida abierta: la ficha las consulta (no el modo)
let nombrePartida = "";

function mostrarMensaje(texto) {
  $("mensaje").textContent = texto;
}

async function pedirConCabeceras(url, opciones) {
  const respuesta = await fetch(url, opciones);
  if (respuesta.status >= 500) {
    throw new Error("El servidor no puede acceder a la base de datos ahora mismo. Inténtalo de nuevo.");
  }
  const cuerpo = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const detalle = cuerpo && cuerpo.detail;
    throw new Error(
      typeof detalle === "string" ? detalle : Array.isArray(detalle) ? detalle[0].msg : "Solicitud no válida"
    );
  }
  return { cuerpo, cabeceras: respuesta.headers };
}

async function pedir(url, opciones) {
  return (await pedirConCabeceras(url, opciones)).cuerpo;
}

function enviarJSON(datos) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  };
}

function elemento(etiqueta, texto, clase) {
  const nodo = document.createElement(etiqueta);
  if (texto !== undefined) nodo.textContent = texto;
  if (clase) nodo.className = clase;
  return nodo;
}

// Ventana propia para confirmar: devuelve una promesa con true o false. Cerrarla con Esc cuenta como cancelar.
function confirmar(titulo, texto, etiqueta) {
  const ventana = $("dialogo-confirmar");
  $("confirmar-titulo").textContent = titulo;
  $("confirmar-texto").textContent = texto;
  $("confirmar-si").textContent = etiqueta;
  ventana.returnValue = "";
  ventana.showModal();
  return new Promise((resolver) => {
    ventana.addEventListener("close", () => resolver(ventana.returnValue === "si"), { once: true });
  });
}

// ---------- Figuras de Pokémon (pixel art) ----------
// Los dibujos llegan ya recortados (make sprites-*). Para que el pixel art se vea nítido se amplía por un
// número ENTERO de píxeles reales de pantalla (teniendo en cuenta el zoom de Windows) y sin suavizado.
// Dos modos:
//  - suelta (equipo): todas con la misma escala, como en los juegos; la que no cabe se reduce justo hasta caber.
//    Así nunca se sale de su caja y un dibujo con más píxeles nunca sale más pequeño que uno con menos;
//  - encajada (listas, dentro de un cuadro blanco): cada una al mayor factor entero que quepa en su cuadro.
// Variocolor: el dibujo real y, si está vivo, destellos. Si falta el dibujo variocolor, se usa el normal.
function pedirDibujo(img, caja, speciesId, shiny) {
  if (shiny && !caja.classList.contains("gris")) caja.classList.add("brillo");
  img.onerror = () => {
    if (img.src.includes("/shiny/")) img.src = `/sprites/${speciesId}.png`;
    else caja.replaceChildren(elemento("span", "?", "falta"));
  };
  img.src = shiny ? `/sprites/shiny/${speciesId}.png` : `/sprites/${speciesId}.png`;
}

function figura(speciesId, gris, tam, reduccion = 1, encajada = false, shiny = false) {
  const caja = elemento("div", undefined, "figura" + (encajada ? " cuadro" : "") + (gris ? " gris" : ""));
  caja.style.width = caja.style.height = tam * reduccion + "px";
  if (!speciesId) {
    caja.append(elemento("span", "?", "falta"));
    return caja;
  }
  const img = new Image();
  img.onload = () => {
    const dpr = window.devicePixelRatio || 1;
    const lado = Math.max(img.naturalWidth, img.naturalHeight);
    if (encajada) tam -= 4; // el cuadro tiene 2 px de borde por cada lado
    let k;
    if (encajada) {
      k = Math.floor((tam * 0.9 * dpr) / lado);
    } else {
      k = Math.min(Math.max(1, Math.round((tam * dpr) / 56)), (tam * dpr) / lado);
    }
    const suavizar = k < 1; // un dibujo grande que no cabe ni a tamaño real se reduce (aquí sí con suavizado)
    if (suavizar) k = (tam * 0.9 * dpr) / lado;
    const lienzo = Math.round(tam * dpr);
    const cv = document.createElement("canvas");
    cv.width = cv.height = lienzo;
    const css = (lienzo / dpr) * reduccion;
    cv.style.width = cv.style.height = css + "px";
    if (reduccion !== 1) cv.style.imageRendering = "pixelated";
    const cx = cv.getContext("2d");
    cx.imageSmoothingEnabled = suavizar;
    const dw = Math.round(img.naturalWidth * k), dh = Math.round(img.naturalHeight * k);
    cx.drawImage(img, Math.floor((lienzo - dw) / 2), Math.floor((lienzo - dh) / 2), dw, dh);
    caja.replaceChildren(cv);
  };
  pedirDibujo(img, caja, speciesId, shiny);
  return caja;
}

// Miniatura de tamaño fijo (portada): el lado más largo de TODOS los dibujos mide lo mismo, así se ven
// todos por igual (un Pichu igual de visible que un Onix). Como el factor casi nunca es entero, se escala con
// «vecino más próximo» (pixelated): el pixel art sigue nítido, aunque algún píxel pueda salir algo más fino.
function miniatura(speciesId, gris, lado, shiny = false) {
  const caja = elemento("div", undefined, "figura" + (gris ? " gris" : ""));
  caja.style.width = caja.style.height = lado + "px";
  if (!speciesId) {
    caja.append(elemento("span", "?", "falta"));
    return caja;
  }
  const img = new Image();
  img.onload = () => {
    const f = lado / Math.max(img.naturalWidth, img.naturalHeight);
    img.width = Math.round(img.naturalWidth * f);
    img.height = Math.round(img.naturalHeight * f);
    img.style.imageRendering = "pixelated";
    caja.replaceChildren(img);
  };
  pedirDibujo(img, caja, speciesId, shiny);
  return caja;
}

// ---------- Navegación por la dirección: #/ (portada) y #/partida/<id> ----------
function rutaActual() {
  const partida = location.hash.match(/^#\/partida\/(\d+)$/);
  return partida ? { vista: "partida", id: Number(partida[1]) } : { vista: "inicio" };
}

function mostrarVista(nombre) {
  $("vista-inicio").hidden = nombre !== "inicio";
  $("vista-partida").hidden = nombre !== "partida";
  $("volver-partidas").hidden = nombre !== "partida";
}

// Aviso que debe sobrevivir a un cambio de vista (por ejemplo, al volver a la portada desde una partida inexistente)
let avisoPendiente = "";

async function navegar() {
  mostrarMensaje(avisoPendiente);
  avisoPendiente = "";
  const ruta = rutaActual();
  try {
    if (ruta.vista === "partida") await abrirPartida(ruta.id);
    else await mostrarInicio();
  } catch (error) {
    mostrarMensaje(error.message);
  }
}

window.addEventListener("hashchange", navegar);

// ---------- Portada ----------
const TAMANO_MINIATURA = 44; // px: lado más largo de cada Pokémon en las tarjetas
async function mostrarInicio() {
  runActual = null;
  const runs = await pedir("/runs");
  const tarjetas = runs.map((run) => {
    const tarjeta = elemento("button", undefined, "partida");
    tarjeta.type = "button";
    tarjeta.append(
      elemento("span", NOMBRE_MODO[run.mode], "modo"),
      elemento("h3", run.name),
      elemento("div", `${run.alive} vivos · ${run.dead} ${muerteDefinitiva(run.rules) ? "muertos" : "debilitados"}${derrotaTotal(run.rules, run.party) ? " · Derrota total" : ""}`, "meta")
    );
    const minis = elemento("div", undefined, "minis");
    if (run.party.length) {
      for (const p of run.party) minis.append(miniatura(p.species_id, !p.alive, TAMANO_MINIATURA, p.shiny));
    } else {
      minis.append(elemento("span", "Aún sin equipo", "vacio"));
    }
    tarjeta.append(minis);
    tarjeta.addEventListener("click", () => { location.hash = `#/partida/${run.id}`; });
    // El lápiz va al lado de la tarjeta y no dentro, porque un botón no puede contener otro
    const lapiz = elemento("button", "✎", "editar-tarjeta");
    lapiz.type = "button";
    lapiz.title = "Editar partida";
    lapiz.setAttribute("aria-label", `Editar la partida ${run.name}`);
    lapiz.addEventListener("click", () => abrirEditarPartida(run.id, run.name));
    const envoltura = elemento("div", undefined, "tarjeta-partida");
    envoltura.append(tarjeta, lapiz);
    return envoltura;
  });

  const nueva = elemento("button", undefined, "partida nueva");
  nueva.type = "button";
  const contenido = elemento("span");
  contenido.append(elemento("span", "+", "mas"), elemento("span", "Nueva partida"));
  nueva.append(contenido);
  nueva.addEventListener("click", abrirNuevaPartida);

  $("rejilla").replaceChildren(...tarjetas, nueva);
  mostrarVista("inicio");
}

// ---------- Partida ----------
async function abrirPartida(id) {
  const runs = await pedir("/runs");
  const run = runs.find((r) => r.id === id);
  if (!run) {
    avisoPendiente = "Esa partida no existe.";
    location.hash = "#/";
    return;
  }
  runActual = id;
  reglasPartida = run.rules;
  nombrePartida = run.name;
  mapasPartida = run.maps || 0;
  $("titulo-partida").textContent = run.name;
  $("titulo-cementerio").textContent = muerteDefinitiva() ? "Cementerio" : "Debilitados";
  $("modo-partida").replaceChildren(NOMBRE_MODO[run.mode], elemento("span", "ⓘ", "info-modo"));
  $("modo-partida").setAttribute("aria-label", `${NOMBRE_MODO[run.mode]}: ver las reglas de la partida`);
  $("reglas-partida").dataset.modo = run.mode;
  mostrarVista("partida");
  await cargarRun();
}

function recuperar() {
  navegar();
}

function mostrarInfoCache(cabeceras) {
  const estado = cabeceras.get("X-Cache");
  const ttl = cabeceras.get("X-Cache-TTL");
  const ms = cabeceras.get("X-Latency-Ms");
  const origen = estado === "HIT" ? "caché" : "base de datos";
  let texto = `Origen: ${origen} · ${ms} ms`;
  if (ttl !== null) texto += ` · caduca en ${ttl} s`;
  if (estado === "DEGRADED") texto += " · caché caída";
  $("info-cache").textContent = texto;
}

// La web no sabe si se ha perdido un combate: lo más fiel que puede hacer es señalar que todo el equipo ha caído.
// Solo avisa y no bloquea nada, porque un error al marcar una muerte se puede corregir.
function derrotaTotal(reglas, equipo) {
  return "derrota_total_fin" in reglas && equipo.length > 0 && equipo.every((p) => !p.alive);
}

function chipDerrota() {
  const chip = elemento("span", "Derrota total", "chip derrota");
  chip.title = "Todo el equipo ha caído: según las reglas de esta partida, ha terminado";
  return chip;
}

function contador(nombre, valor, clase) {
  const chip = elemento("span", nombre + " ", "chip" + (clase ? " " + clase : ""));
  chip.append(elemento("b", String(valor)));
  return chip;
}

// Fila de vivos o cementerio: mote (o «Sin mote»), especie y ruta; a la derecha, el dibujo en su cuadro blanco.
// Todo el texto va con textContent (vía elemento()), nunca como HTML: protege frente a XSS con motes como «<img onerror=...>».
function pintarLista(lista, pokemons, muertos, textoVacio) {
  const filas = pokemons.map((p) => {
    const fila = elemento("button", undefined, "fila");
    fila.type = "button";
    fila.addEventListener("click", () => abrirFicha(p, !muertos, pokemons));
    const texto = elemento("div", undefined, "texto");
    texto.append(
      elemento("div", p.nickname || "Sin mote", "mote"),
      elemento("div", p.species, "esp"),
      elemento("div", p.route, "ruta")
    );
    fila.append(texto, figura(p.species_id, muertos, 64, 1, true, p.shiny));
    const li = elemento("li");
    li.append(fila);
    return li;
  });
  if (!filas.length) filas.push(elemento("li", textoVacio, "vacio"));
  lista.replaceChildren(...filas);
}

function pintarFallos(fallos) {
  const filas = fallos.map((e) => {
    const fila = elemento("li", undefined, "fila fallo");
    const texto = elemento("div", undefined, "texto");
    texto.append(elemento("div", e.species, "esp"), elemento("div", e.route, "ruta"));
    const borrar = elemento("button", "✕", "borrar");
    borrar.type = "button";
    borrar.title = "Eliminar este fallo";
    borrar.setAttribute("aria-label", `Eliminar el fallo de ${e.route}`);
    borrar.addEventListener("click", () => eliminarEncuentro(e.id, `el fallo de ${e.route} (${e.species})`));
    fila.append(texto, figura(e.species_id, false, 48, 1, true), borrar);
    return fila;
  });
  if (!filas.length) filas.push(elemento("li", "Ningún fallo.", "vacio"));
  $("fallos").replaceChildren(...filas);
}

// ---------- Equipo (Pokédex) ----------
const TAMANO_EQUIPO = 6;
let equipoActual = [];  // lo que devuelve GET /party: posición, ruta, especie, mote, alive, species_id
let vivosActual = [];   // lo que devuelve GET /team: todos los vivos (equipo y PC)
let muertosActual = []; // lo que devuelve GET /graveyard

// Con esta regla, debilitado es muerto (Nuzlocke y Randomlocke); sin ella (Normal), solo está debilitado
function muerteDefinitiva(reglas = reglasPartida) {
  return "muerte_definitiva" in reglas;
}

// El equipo se guarda entero con PUT /party (una lista de capturas, máximo 6); la API valida
// y la base de datos garantiza que no haya más de 6 ni repetidos.
async function guardarEquipo(capturas) {
  mostrarMensaje("");
  let guardado = true;
  try {
    await pedir(`/runs/${runActual}/party`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ captures: capturas }),
    });
  } catch (error) {
    mostrarMensaje(error.message);
    guardado = false;
  }
  await cargarRun();
  return guardado;
}

function pintarEquipo() {
  const casillas = equipoActual.map((p) => {
    // La casilla no es un <button> porque dentro lleva otro botón (el «−»); se hace accesible con role y tabindex.
    const casilla = elemento("div", undefined, "slot" + (p.alive ? "" : " muerto"));
    casilla.tabIndex = 0;
    casilla.setAttribute("role", "button");
    casilla.setAttribute("aria-label", `${p.nickname || p.species}, ${p.route}`);

    const quitar = elemento("button", "−", "quitar");
    quitar.type = "button";
    quitar.title = "Sacar del equipo";
    quitar.setAttribute("aria-label", `Sacar a ${p.nickname || p.species} del equipo`);
    quitar.addEventListener("click", (evento) => {
      evento.stopPropagation(); // que no cuente como pulsar la casilla (en B3 abrirá la ficha)
      guardarEquipo(equipoActual.filter((q) => q.capture_id !== p.capture_id).map((q) => q.capture_id));
    });

    casilla.addEventListener("click", () => abrirFicha(p, p.alive, equipoActual));
    casilla.addEventListener("keydown", (evento) => {
      if (evento.key === "Enter" || evento.key === " ") {
        evento.preventDefault();
        abrirFicha(p, p.alive, equipoActual);
      }
    });

    // Sin mote, la especie hace de nombre; debajo, siempre la ruta.
    casilla.append(
      quitar,
      figura(p.species_id, !p.alive, 80, 1, false, p.shiny),
      elemento("div", p.nickname || p.species, "mote"),
      elemento("div", p.route, "ruta")
    );
    return casilla;
  });

  // Solo el primer hueco libre lleva el «+»: al añadir un Pokémon, pasa al siguiente
  for (let i = casillas.length; i < TAMANO_EQUIPO; i++) {
    if (i === equipoActual.length) {
      const hueco = elemento("button", "+", "hueco");
      hueco.type = "button";
      hueco.setAttribute("aria-label", "Hueco libre: añadir un Pokémon al equipo");
      hueco.append(elemento("small", "Añadir"));
      hueco.addEventListener("click", abrirSelector);
      casillas.push(hueco);
    } else {
      casillas.push(elemento("div", undefined, "hueco vacio"));
    }
  }
  $("equipo").replaceChildren(...casillas);
}

// La ventana sigue abierta para añadir varios seguidos; se cierra con Esc, la ✕, pulsando fuera o al completar el equipo
let guardandoSelector = false; // mientras se guarda uno se ignoran las pulsaciones: el siguiente necesita el equipo ya actualizado

async function elegirDelSelector(p) {
  if (guardandoSelector) return;
  guardandoSelector = true;
  const guardado = await guardarEquipo([...equipoActual.map((q) => q.capture_id), p.capture_id]);
  guardandoSelector = false;
  // Si falla, se cierra para que se vea el aviso, que está detrás de la ventana
  if (!guardado || equipoActual.length >= TAMANO_EQUIPO) $("selector").close();
  else pintarSelector();
}

function abrirSelector() {
  pintarSelector();
  $("selector").showModal();
}

function pintarSelector() {
  const enEquipo = new Set(equipoActual.map((p) => p.capture_id));
  const libres = vivosActual.filter((p) => !enEquipo.has(p.capture_id));
  const opciones = libres.map((p) => {
    const opcion = elemento("button", undefined, "fila opcion");
    opcion.type = "button";
    const texto = elemento("div", undefined, "texto");
    texto.append(
      elemento("div", p.nickname || p.species, "mote"),
      elemento("div", p.nickname ? p.species : "", "esp"),
      elemento("div", p.route, "ruta")
    );
    opcion.append(texto, figura(p.species_id, false, 64, 1, true, p.shiny));
    opcion.addEventListener("click", () => elegirDelSelector(p));
    const li = elemento("li");
    li.append(opcion);
    return li;
  });
  if (!opciones.length) opciones.push(elemento("li", "No hay Pokémon vivos fuera del equipo.", "vacio"));
  $("selector-lista").replaceChildren(...opciones);
}

$("cerrar-selector").addEventListener("click", () => $("selector").close());

async function cargarRun() {
  if (!runActual) return;

  const [equipo, eventos, muertos, party] = await Promise.all([
    pedirConCabeceras(`/runs/${runActual}/team`),
    pedir(`/runs/${runActual}/encounters`),
    pedir(`/runs/${runActual}/graveyard`),
    pedir(`/runs/${runActual}/party`),
  ]);

  const vivos = equipo.cuerpo;
  mostrarInfoCache(equipo.cabeceras);
  vivosActual = vivos;
  equipoActual = party;
  pintarEquipo();

  capturasActual = eventos.filter((e) => e.event_type === "captura");
  encuentrosActual = eventos.filter((e) => e.event_type !== "muerte");
  // Sugerencias del buscador y de «Nuevo encuentro»: ayudan a escribir igual cada ruta
  $("lista-rutas").replaceChildren(...encuentrosPorRuta().map((r) => new Option("", r.nombre)));
  $("contadores").replaceChildren(
    ...(derrotaTotal(reglasPartida, party) ? [chipDerrota()] : []),
    contador("Vivos", vivos.length),
    contador(muerteDefinitiva() ? "Muertos" : "Debilitados", muertos.length, "rojo"),
    contador("Capturas", capturasActual.length)
  );
  pintarLista($("vivos"), vivos, false, "Nadie vivo todavía.");
  muertosActual = muertos;
  pintarLista($("cementerio"), muertos, true, muerteDefinitiva() ? "Nadie ha muerto. ¡De momento!" : "Nadie está debilitado.");

  pintarFallos(eventos.filter((e) => e.event_type === "fallo"));
}

// ---------- Nueva partida: modo y reglas (ideas 2 + 6) ----------
// El catálogo de reglas y las plantillas vienen del servidor (GET /rules): aquí solo se pintan.
const NOMBRE_MODO = { normal: "Normal", nuzlocke: "Nuzlocke", randomlocke: "Randomlocke" };
const DESCRIPCION_MODO = {
  normal: "Sin reglas: solo llevar el registro de la partida.",
  nuzlocke: "Las reglas clásicas del Nuzlocke.",
  randomlocke: "Nuzlocke con el juego aleatorizado.",
};
const MODO_INICIAL = "randomlocke";
let catalogo = null; // se pide una sola vez

async function cargarCatalogo() {
  if (catalogo) return;
  catalogo = await pedir("/rules");
  pintarModos();
}

function modoElegido() {
  return document.querySelector('input[name="modo"]:checked').value;
}

function pintarModos() {
  $("modos").replaceChildren(...catalogo.modes.map((modo) => {
    const opcion = elemento("label", undefined, "modo-opcion");
    const radio = elemento("input");
    radio.type = "radio";
    radio.name = "modo";
    radio.value = modo;
    radio.addEventListener("change", mostrarReglasDelModo);
    opcion.append(radio, elemento("strong", NOMBRE_MODO[modo]), elemento("small", DESCRIPCION_MODO[modo]));
    return opcion;
  }));
}

// La lista de lo que trae la plantilla del modo elegido (solo lectura)
function mostrarReglasDelModo() {
  $("reglas-modo").replaceChildren(...nodosReglas(catalogo.templates[modoElegido()]));
}

// Las reglas activas como listas («Reglas» y «Aleatorizado»), con su valor si lo tienen (por ejemplo, las vidas)
function nodosReglas(reglas) {
  const activas = catalogo.rules.filter((r) => r.clave in reglas);
  const texto = (r) => (reglas[r.clave] === true ? r.nombre : `${r.nombre}: ${reglas[r.clave]}`);
  const lista = (titulo, grupo) => {
    if (!grupo.length) return [];
    const ul = elemento("ul", undefined, "lista-reglas");
    ul.append(...grupo.map((r) => elemento("li", texto(r))));
    return [elemento("h4", titulo), ul];
  };
  return [
    ...(activas.length ? [] : [elemento("p", "Ninguna regla activa.", "vacio")]),
    ...lista("Reglas", activas.filter((r) => r.grupo !== "aleatorizado")),
    ...lista("Aleatorizado", activas.filter((r) => r.grupo === "aleatorizado")),
  ];
}

// ---------- Reglas de la partida abierta (recuadro flotante junto al modo) ----------
// Es un «popover» de HTML: el navegador lo abre con el botón y lo cierra al pulsar fuera o con Esc.
// Aquí solo se coloca debajo del botón y se rellena.
$("reglas-partida").addEventListener("beforetoggle", async (evento) => {
  if (evento.newState !== "open") return;
  const recuadro = $("reglas-partida");
  const boton = $("modo-partida").getBoundingClientRect();
  const ancho = Math.min(320, innerWidth - 32);
  recuadro.style.top = `${boton.bottom + 8}px`;
  recuadro.style.left = `${Math.max(16, Math.min(boton.left, innerWidth - ancho - 16))}px`;
  recuadro.replaceChildren(elemento("p", "Cargando…", "vacio"));
  try {
    await cargarCatalogo();
  } catch (error) {
    recuadro.replaceChildren(elemento("p", error.message, "error"));
    return;
  }
  const modo = recuadro.dataset.modo;
  const avisos = [];
  if (reglasPartida.aleatorio_ataques || reglasPartida.aleatorio_mt) {
    avisos.push("Como los ataques están aleatorizados, la ficha no sugiere los oficiales.");
  }
  if (reglasPartida.aleatorio_habilidades) avisos.push("Tampoco sugiere habilidades.");
  recuadro.replaceChildren(
    elemento("h3", NOMBRE_MODO[modo]),
    elemento("p", DESCRIPCION_MODO[modo], "descripcion-modo"),
    ...nodosReglas(reglasPartida),
    ...(avisos.length ? [elemento("p", avisos.join(" "), "pista")] : []),
  );
});
// Un recuadro fijo no sigue a la página: al desplazarla, se cierra
window.addEventListener("scroll", () => {
  if ($("reglas-partida").matches(":popover-open")) $("reglas-partida").hidePopover();
}, { passive: true });

// Con el ratón: se abre si se mantiene encima del botón RETARDO_ABRIR_REGLAS_MS y se cierra al salir del botón
// y del recuadro. El pequeño margen al cerrar deja pasar del botón al recuadro (por ejemplo, para desplazarlo).
// Solo para el ratón: en una pantalla táctil, «pasar por encima» no existe y se usa el clic.
const RETARDO_ABRIR_REGLAS_MS = 700;
const RETARDO_CERRAR_REGLAS_MS = 200;
let temporizadorReglas = null;

function programarReglas(abrir) {
  clearTimeout(temporizadorReglas);
  const recuadro = $("reglas-partida");
  const abierto = recuadro.matches(":popover-open");
  if (abrir === abierto) return; // ya está como se quiere: basta con anular lo pendiente
  temporizadorReglas = setTimeout(() => {
    // Se vuelve a mirar: entretanto se ha podido abrir o cerrar con un clic (y abrir dos veces da error)
    if (recuadro.matches(":popover-open") !== abrir) recuadro.togglePopover(abrir);
  }, abrir ? RETARDO_ABRIR_REGLAS_MS : RETARDO_CERRAR_REGLAS_MS);
}

for (const zona of [$("modo-partida"), $("reglas-partida")]) {
  zona.addEventListener("pointerenter", (evento) => {
    if (evento.pointerType !== "mouse") return;
    if (zona === $("modo-partida")) programarReglas(true);
    else clearTimeout(temporizadorReglas); // ha entrado en el recuadro: no se cierra
  });
  zona.addEventListener("pointerleave", (evento) => {
    if (evento.pointerType === "mouse") programarReglas(false);
  });
}

async function abrirNuevaPartida() {
  mostrarMensaje("");
  try {
    await cargarCatalogo();
  } catch (error) {
    mostrarMensaje(error.message);
    return;
  }
  $("form-run").reset();
  $("error-run").textContent = "";
  document.querySelector(`input[name="modo"][value="${MODO_INICIAL}"]`).checked = true;
  mostrarReglasDelModo();
  $("dialogo-nueva").showModal();
}

$("form-run").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const nombre = $("nombre-run").value.trim();
  $("error-run").textContent = nombre ? "" : "Escribe un nombre.";
  if (!nombre) return;
  try {
    const run = await pedir("/runs", enviarJSON({ name: nombre, mode: modoElegido() }));
    $("dialogo-nueva").close();
    location.hash = `#/partida/${run.id}`;
  } catch (error) {
    $("error-run").textContent = error.message; // la ventana sigue abierta: no se pierde lo elegido
  }
});

$("cancelar-nueva").addEventListener("click", () => $("dialogo-nueva").close());

const RETARDO_SUGERENCIAS_MS = 200;

let temporizadorSugerencias = null;
let peticionSugerencias = 0;

async function cargarSugerencias() {
  const texto = $("especie").value.trim();
  const numero = ++peticionSugerencias;
  if (!texto) {
    $("lista-especies").replaceChildren();
    return;
  }
  try {
    const nombres = await pedir(`/species?q=${encodeURIComponent(texto)}`);
    if (numero !== peticionSugerencias) return;
    $("lista-especies").replaceChildren(...nombres.map((nombre) => new Option(nombre)));
  } catch {
    // las sugerencias son opcionales: si fallan, no se molesta al usuario
  }
}

$("especie").addEventListener("input", () => {
  clearTimeout(temporizadorSugerencias);
  temporizadorSugerencias = setTimeout(cargarSugerencias, RETARDO_SUGERENCIAS_MS);
});

// ---------- Ficha del Pokémon ----------
const COLOR_TIPO = {
  normal: "#9a9a8e", fire: "#f08030", water: "#6890f0", grass: "#78c850", electric: "#e8b800", ice: "#78c8d0",
  fighting: "#c03028", poison: "#a040a0", ground: "#d8b858", flying: "#8f87e8", psychic: "#f85888", bug: "#a8b820",
  rock: "#b8a038", ghost: "#705898", dragon: "#7038f8", dark: "#705848", steel: "#a0a0c0", fairy: "#e87fa0",
};

async function accionFicha(promesa) {
  $("error-ficha").textContent = "";
  try {
    await promesa;
    $("ficha").close();
    await cargarRun();
  } catch (error) {
    $("error-ficha").textContent = error.message;
  }
}

function boton(texto, clase, alPulsar) {
  const b = elemento("button", texto, "btn" + (clase ? " " + clase : ""));
  b.type = "button";
  b.addEventListener("click", alPulsar);
  return b;
}

// ---------- Ficha editable (C1) ----------
const ESTADISTICAS = ["hp", "attack", "defense", "sp_attack", "sp_defense", "speed"];
// La naturaleza dice qué estadística sube y cuál baja (nombres de PokéAPI → campos de la ficha)
const CAMPO_ESTADISTICA = {
  attack: "attack", defense: "defense", "special-attack": "sp_attack", "special-defense": "sp_defense", speed: "speed",
};
let naturalezas = null; // se piden una sola vez
let capturaFicha = null; // captura del Pokémon cuya ficha está abierta

async function cargarNaturalezas() {
  if (naturalezas) return;
  naturalezas = await pedir("/natures");
  $("f-naturaleza").append(...naturalezas.map((n) => new Option(n.name, n.name)));
}

function marcarNaturaleza() {
  const n = (naturalezas || []).find((x) => x.name === $("f-naturaleza").value);
  for (const fila of document.querySelectorAll(".stat")) {
    const campo = fila.dataset.stat;
    fila.classList.toggle("sube", !!n && CAMPO_ESTADISTICA[n.increased] === campo);
    fila.classList.toggle("baja", !!n && CAMPO_ESTADISTICA[n.decreased] === campo);
  }
}

// ---------- Estimar las estadísticas al subir de nivel ----------
// Sin bases, IV ni EV, para que sirva en cualquier juego. Todo eso se resume en q = 2·base + IV + EV/4: cada lectura real
// da un rango de q posible, se cruzan y se aplica la fórmula del juego con el centro. Nunca se parte de una estimación.
// Si el Pokémon se importó del guardado, sus IV y EV dan el q exacto (ver qDeGenes).
const Q_MAXIMO = 1023;
// Los EV hacen crecer q, así que el techo de una lectura antigua se afloja por cada nivel transcurrido (medido en simulación)
const HOLGURA_Q_POR_NIVEL = 1;
let lecturasFicha = {}; // por estadística, lista de { level, value }
let genesFicha = null;  // IV y EV del guardado del juego: { level, iv: {hp…}, ev: {hp…} } o null

function nivelFichaValido() {
  const nivel = Number($("f-nivel").value);
  return Number.isInteger(nivel) && nivel >= 1 && nivel <= 100 ? nivel : null;
}

function porcentajeNaturaleza(campo) {
  const n = (naturalezas || []).find((x) => x.name === $("f-naturaleza").value);
  if (!n || n.increased === n.decreased) return 100;
  if (CAMPO_ESTADISTICA[n.increased] === campo) return 110;
  if (CAMPO_ESTADISTICA[n.decreased] === campo) return 90;
  return 100;
}

function estadisticaDesdeQ(campo, q, nivel) {
  const interior = Math.floor(q * nivel / 100);
  if (campo === "hp") return interior + nivel + 10;
  return Math.floor((interior + 5) * porcentajeNaturaleza(campo) / 100);
}

// Los q que producen esa lectura; null si no puede salir con su nivel y la naturaleza elegida
function rangoDeLectura(campo, lectura) {
  let desde = null, hasta = null;
  for (let q = 0; q <= Q_MAXIMO; q++) {
    if (estadisticaDesdeQ(campo, q, lectura.level) === lectura.value) {
      if (desde === null) desde = q;
      hasta = q;
    }
  }
  // La lectura se hizo con otra especie: q se corrige con la diferencia de bases
  const desplazamiento = desplazamientoLectura(campo, lectura);
  return desde === null ? null : [desde + desplazamiento, hasta + desplazamiento];
}

function esShedinja(campo, lectura) {
  return campo === "hp" && lectura.value === 1 && !desplazamientoLectura(campo, lectura); // siempre tiene 1 PS
}

// Lo guardado en la lectura (evoluciones ya hechas) más la evolución que se está viendo sin guardar
function desplazamientoLectura(campo, lectura) {
  return (lectura.shift || 0) + desplazamientoEvolucion(campo);
}

// q exacto con los IV y EV del guardado y la base de la especie que se ve: q = 2·base + IV + EV/4.
// Los EV solo suben al jugar, así que es el mínimo posible de q desde que se importó.
function qDeGenes(campo) {
  const especie = datosEvolucion?.[especieVista ?? fichaActual?.species_id];
  if (!genesFicha || !especie) return null;
  return 2 * especie.bases[campo] + genesFicha.iv[campo] + Math.floor(genesFicha.ev[campo] / 4);
}

function pintarGenes() {
  for (const campo of ESTADISTICAS) {
    const zona = $("g-" + campo);
    zona.hidden = !genesFicha;
    zona.textContent = genesFicha ? `IV ${genesFicha.iv[campo]} · EV ${genesFicha.ev[campo]}` : "";
  }
  $("genes-aviso").hidden = !genesFicha;
  if (genesFicha) $("genes-aviso").textContent = `IV y EV del guardado del juego (nivel ${genesFicha.level}): las estimaciones parten de ellos.`;
}

function estimarEstadistica(campo, lecturas, nivel) {
  const ordenadas = [...lecturas].sort((a, b) => a.level - b.level);
  const ultima = ordenadas.at(-1);
  if (esShedinja(campo, ultima)) return 1;
  const rango = rangoDeLectura(campo, ultima);
  if (!rango) return null;
  let [desde, hasta] = rango;
  // De la más nueva a la más vieja: una lectura que ya no encaja (errata o muchos EV) no se tiene en cuenta
  for (const lectura of ordenadas.slice(0, -1).reverse()) {
    const otro = rangoDeLectura(campo, lectura);
    if (!otro) continue;
    const techo = otro[1] + (ultima.level - lectura.level) * HOLGURA_Q_POR_NIVEL;
    if (Math.max(desde, otro[0]) <= Math.min(hasta, techo)) {
      desde = Math.max(desde, otro[0]);
      hasta = Math.min(hasta, techo);
    }
  }
  // Con IV y EV del juego, el valor exacto si cuadra con las lecturas. Si queda por debajo, ha ganado EV desde
  // entonces: el mínimo que permiten las lecturas. Si queda por encima, el juego usa otras bases: se ignora.
  const exacto = qDeGenes(campo);
  if (exacto !== null && exacto <= hasta) return estadisticaDesdeQ(campo, Math.max(exacto, desde), nivel);
  return estadisticaDesdeQ(campo, Math.max(0, Math.floor((desde + hasta) / 2)), nivel);
}

function lecturaDelNivel(campo, nivel) {
  return (lecturasFicha[campo] || []).find((x) => x.level === nivel && !desplazamientoLectura(campo, x));
}

// Una lectura escrita mientras se ve la evolución es de la especie nueva: se guarda referida a la que hay guardada
function lecturaNueva(campo, nivel, valor) {
  return { level: nivel, value: valor, shift: -desplazamientoEvolucion(campo) };
}

function esEstimada(campo) {
  const nivel = nivelFichaValido();
  return !!nivel && !!lecturasFicha[campo]?.length && !lecturaDelNivel(campo, nivel);
}

function pintarEstimaciones() {
  const nivel = nivelFichaValido();
  pintarEvolucionNivel();
  let hayEstimadas = false, hayImposibles = false;
  for (const campo of ESTADISTICAS) {
    const lecturas = lecturasFicha[campo] || [];
    const propia = nivel ? lecturaDelNivel(campo, nivel) : undefined;
    const estimada = esEstimada(campo);
    // null: el valor no puede salir con ese nivel y naturaleza
    let calculado;
    if (propia) calculado = esShedinja(campo, propia) || rangoDeLectura(campo, propia) ? propia.value : null;
    else if (estimada) calculado = estimarEstadistica(campo, lecturas, nivel);
    const entrada = $("f-" + campo);
    if (calculado != null && document.activeElement !== entrada) entrada.value = calculado;
    const caja = document.querySelector(`.stat[data-stat="${campo}"]`);
    caja.classList.toggle("estimada", estimada);
    caja.classList.toggle("no-cuadra", calculado === null);
    hayEstimadas ||= estimada;
    hayImposibles ||= calculado === null;
  }
  $("aviso-estimadas").hidden = !hayEstimadas;
  $("aviso-no-cuadra").hidden = !hayImposibles;
  pintarHexagono();
}

// ---------- Evolucionar al subir de nivel ----------
// Nada cambia de verdad hasta guardar: la especie que se ve sale del nivel escrito y de lo marcado en la ficha.
let datosEvolucion = null;     // se piden una sola vez; sin ellos, la ficha funciona igual pero no evoluciona sola
let nivelGuardadoFicha = null; // solo evoluciona al subir: un Pokémon recién capturado puede estar por encima del nivel
let noHaEvolucionado = false;
let evolucionElegida = null;   // la elegida cuando hay condiciones que la web no puede saber
let especieVista = null;

async function cargarDatosEvolucion() {
  if (datosEvolucion) return;
  try {
    datosEvolucion = await pedir("/species/evolution-data");
  } catch { /* se puede seguir usando la ficha y evolucionar a mano */ }
}

function desplazamientoEvolucion(campo) {
  const guardada = datosEvolucion?.[fichaActual?.species_id];
  const vista = datosEvolucion?.[especieVista];
  return guardada && vista ? 2 * (vista.bases[campo] - guardada.bases[campo]) : 0;
}

// Sigue la cadena mientras baste con el nivel; se para y pregunta si hay condiciones
function avanzarEvolucion(especie, nivel) {
  let actual = especie;
  for (;;) {
    const posibles = (datosEvolucion?.[actual]?.evolutions ?? []).filter((e) => e.level && e.level <= nivel);
    const automaticas = posibles.filter((e) => e.auto);
    if (automaticas.length !== 1) return { especie: actual, preguntar: posibles.map((e) => e.to) };
    actual = automaticas[0].to;
  }
}

function resolverEvolucion() {
  const base = fichaActual?.species_id;
  const nivel = nivelFichaValido();
  const vivo = fichaActual?.alive ?? fichaVivoLista;
  const puede = vivo && !!datosEvolucion && !!nivel && nivelGuardadoFicha !== null && nivel > nivelGuardadoFicha;
  if (!puede) return { especie: base, preguntar: [], casilla: false };
  const avance = avanzarEvolucion(evolucionElegida ?? base, nivel);
  if (noHaEvolucionado) return { especie: base, preguntar: [], casilla: avance.especie !== base };
  return { ...avance, casilla: avance.especie !== base };
}

function pintarCabeceraFicha(p, vivo) {
  $("ficha-dibujo").replaceChildren(figura(p.species_id, !vivo, 112, 1, true, p.shiny));
  $("ficha-nombre").textContent = p.nickname || p.species;
  $("ficha-sub").textContent = (p.nickname ? p.species + " · " : "") + p.route;
  $("ficha-tipos").replaceChildren(
    ...(p.types || []).map((t) => {
      const etiqueta = elemento("span", t.name, "tipo");
      etiqueta.style.background = COLOR_TIPO[t.identifier] || "#777";
      return etiqueta;
    })
  );
}

function pintarEvolucionNivel() {
  if (!fichaActual) return;
  // El icono solo sale si puede evolucionar: vivo y con alguna evolución
  $("abrir-evolucion").hidden = !(fichaActual.alive ?? fichaVivoLista) || !opcionesDeEvolucion().length;
  const { especie, preguntar, casilla } = resolverEvolucion();
  if (especie !== especieVista) {
    especieVista = especie;
    const datos = datosEvolucion?.[especie];
    const cambiada = especie !== fichaActual.species_id && datos;
    pintarCabeceraFicha(cambiada ? { ...fichaActual, species_id: especie, species: datos.name, types: datos.types } : fichaActual,
      fichaActual.alive ?? fichaVivoLista);
    actualizarAprendizajeVisto(especie);
  }
  const hijos = [];
  if (casilla) {
    const marca = elemento("label", undefined, "casilla-evolucion");
    const check = elemento("input");
    check.type = "checkbox";
    check.checked = noHaEvolucionado;
    check.addEventListener("change", () => {
      noHaEvolucionado = check.checked;
      if (noHaEvolucionado) evolucionElegida = null;
      fichaSinGuardar = true;
      pintarEstimaciones();
    });
    marca.append(check, "No ha evolucionado");
    hijos.push(marca);
  }
  if (preguntar.length) {
    hijos.push(elemento("span", "Puede evolucionar a:", "pista"));
    for (const id of preguntar) {
      const chip = elemento("button", datosEvolucion[id].name, "chip-habilidad");
      chip.type = "button";
      chip.addEventListener("click", () => {
        evolucionElegida = id;
        noHaEvolucionado = false;
        fichaSinGuardar = true;
        pintarEstimaciones();
      });
      hijos.push(chip);
    }
  }
  $("evolucion-nivel").replaceChildren(...hijos);
  $("evolucion-nivel").hidden = !hijos.length;
}

// «Puede aprender» y las habilidades sugeridas también siguen a la especie que se ve
async function actualizarAprendizajeVisto(especie) {
  if (!especie) return;
  try {
    const datos = await cargarAprendizaje(especie);
    if (especie !== especieVista) return;
    aprendizaje = segunReglas(datos);
    pintarHabilidad();
    pintarAprender();
  } catch { /* se queda lo que había */ }
}

// ---------- Hexágono de estadísticas ----------
// «Por nivel»: el borde es lo que tendría un Pokémon muy fuerte (base 150, IV 31, sin EV) a ese nivel, con la fórmula
// del juego; así a nivel bajo no se queda en un punto. «Sobre 255»: es absoluta y la forma crece al subir de nivel.
const HEXA_ORDEN = ["hp", "sp_attack", "sp_defense", "speed", "defense", "attack"]; // PS arriba y en sentido horario
const HEXA_X = 200, HEXA_Y = 190, HEXA_RADIO = 100;
const HEXA_SVG = "http://www.w3.org/2000/svg";
const HEXA_FUERTE = 2 * 150 + 31;
let escalaHexa = "nivel";
try {
  if (localStorage.getItem("escalaHexagono") === "fija") escalaHexa = "fija";
} catch { /* sin almacenamiento: se usa la escala inicial */ }

function trazoHexa(radios) {
  return radios.map((r, i) => {
    const angulo = (-90 + i * 60) * Math.PI / 180;
    return `${(HEXA_X + r * Math.cos(angulo)).toFixed(1)},${(HEXA_Y + r * Math.sin(angulo)).toFixed(1)}`;
  }).join(" ");
}

function nodoHexa(nombre, atributos) {
  const nodo = document.createElementNS(HEXA_SVG, nombre);
  for (const [clave, valor] of Object.entries(atributos)) nodo.setAttribute(clave, valor);
  return nodo;
}

const formaHexa = nodoHexa("polygon", { class: "hexa-forma" });
$("hexa-svg").append(
  nodoHexa("polygon", { class: "hexa-borde", points: trazoHexa(HEXA_ORDEN.map(() => HEXA_RADIO)) }),
  ...[1 / 3, 2 / 3].map((parte) => nodoHexa("polygon", { class: "hexa-linea", points: trazoHexa(HEXA_ORDEN.map(() => HEXA_RADIO * parte)) })),
  ...HEXA_ORDEN.map((_, i) => {
    const [x, y] = trazoHexa(HEXA_ORDEN.map((__, j) => (j === i ? HEXA_RADIO : 0))).split(" ")[i].split(",");
    return nodoHexa("line", { class: "hexa-linea", x1: HEXA_X, y1: HEXA_Y, x2: x, y2: y });
  }),
  formaHexa
);

function topeHexa(campo, nivel) {
  if (!nivel) return 255;
  return HEXA_FUERTE * nivel / 100 + (campo === "hp" ? nivel + 10 : 5);
}

function pintarHexagono() {
  const nivel = Number($("f-nivel").value);
  const porNivel = escalaHexa === "nivel" && nivel >= 1 && nivel <= 100 ? nivel : 0;
  const valores = HEXA_ORDEN.map((campo) => Number($("f-" + campo).value) || 0);
  const hayDatos = valores.some((v) => v > 0);
  formaHexa.setAttribute("points", hayDatos
    ? trazoHexa(valores.map((v, i) => Math.min(1, v / topeHexa(HEXA_ORDEN[i], porNivel)) * HEXA_RADIO))
    : "");
  document.querySelectorAll(".boton-escala").forEach((b) => b.classList.toggle("activa", b.dataset.escala === escalaHexa));
  $("hexa-aviso").textContent = "Sin nivel: se dibuja sobre 255.";
  $("hexa-aviso").hidden = !(escalaHexa === "nivel" && !porNivel && hayDatos);
}

document.querySelectorAll(".boton-escala").forEach((b) => b.addEventListener("click", () => {
  escalaHexa = b.dataset.escala;
  try {
    localStorage.setItem("escalaHexagono", escalaHexa);
  } catch { /* la elección dura hasta recargar */ }
  pintarHexagono();
}));

function rellenarFicha(f) {
  $("f-nivel").value = f.level ?? "";
  $("f-naturaleza").value = f.nature ?? "";
  $("f-habilidad").value = f.ability ?? "";
  $("f-objeto").value = f.item ?? "";
  for (let i = 0; i < 4; i++) $("f-ataque-" + i).value = f.moves[i] ?? "";
  // Lo ya guardado que no está en el catálogo se añadió a mano: no es un error
  for (const ataque of f.moves) if (!datosDeAtaque(ataque)) ataquesManuales.add(ataque.toLowerCase());
  if (f.ability && !catalogoHabilidades.has(f.ability.toLowerCase())) habilidadesManuales.add(f.ability.toLowerCase());
  for (const campo of ESTADISTICAS) $("f-" + campo).value = f[campo] ?? "";
  lecturasFicha = f.readings;
  genesFicha = f.iv_ev;
  pintarGenes();
  nivelGuardadoFicha = f.level;
  pintarEstimaciones();
  marcarNaturaleza();
  olvidados = f.forgotten;
  pintarHuecos();
  pintarHabilidad();
  pintarAprender();
  fichaSinGuardar = false;
}

// ---------- Puede aprender (C2) ----------
const ETIQUETA_METODO = { machine: "MT", tutor: "Tutor", egg: "Huevo" };
const aprendizajes = {}; // por especie: no cambian, se piden una sola vez
let aprendizaje = null;  // lo que puede aprender la especie de la ficha abierta
let olvidados = [];      // ataques que tuvo y ya no tiene: se muestran en «Puede aprender»

async function cargarAprendizaje(speciesId) {
  if (!speciesId) return { abilities: [], moves: [] }; // especie desconocida: sin sugerencias
  aprendizajes[speciesId] ??= await pedir(`/species/${speciesId}/learnset`);
  return aprendizajes[speciesId];
}

// En una partida aleatorizada, los datos oficiales no son fiables y no se sugieren (subpaso 4 de las ideas 2 + 6).
// «Ataques» afecta a los que se aprenden por nivel y huevo; «MT y tutores», a los de MT y tutor.
// Devuelve una copia: lo guardado en `aprendizajes` (por especie) no cambia.
function segunReglas(datos) {
  const porNivel = !reglasPartida.aleatorio_ataques;
  const porMt = !reglasPartida.aleatorio_mt;
  return {
    abilities: reglasPartida.aleatorio_habilidades ? [] : datos.abilities,
    moves: datos.moves.filter((m) => (m.method === "machine" || m.method === "tutor" ? porMt : porNivel)),
    aleatorizados: !porNivel || !porMt,
  };
}

function sinSugerencias() {
  if (aprendizaje.moves.length || olvidados.length) {
    return $("filtro-ataques").value.trim() ? "Ninguno coincide." : "Ya tiene asignados todos los de esta lista.";
  }
  if (aprendizaje.aleatorizados) return "Los ataques están aleatorizados en esta partida: aquí aparecerán los que le quites.";
  return "Sin datos para esta especie.";
}

function huecosAtaque() {
  return [0, 1, 2, 3].map((i) => $("f-ataque-" + i));
}

// ---------- Catálogos: hay que elegir de la lista, salvo que se añada a mano ----------
// A mano sirve para lo que no está en los datos oficiales, como los ataques propios de un juego de fans.
const NOMBRE_CATEGORIA = { physical: "Físico", special: "Especial", status: "Estado" };
let catalogoAtaques = null;     // nombre en minúsculas -> datos; se piden una sola vez
let catalogoHabilidades = null;
let ataquesPartida = new Map(); // los añadidos a mano con datos: valen para toda la partida
let ataquesManuales = new Set();
let habilidadesManuales = new Set();
const huecosConError = new Set();
const huecosEscribiendo = new Set();  // sin confirmar: mientras tanto se ve la caja de texto
let habilidadConError = false;
let filaAbierta = null;         // el ataque de «Puede aprender» con la descripción abierta
let huecoEditando = null;       // el hueco con el formulario de datos abierto

async function cargarCatalogos() {
  if (catalogoAtaques) return;
  const [ataques, habilidades] = await Promise.all([pedir("/moves"), pedir("/abilities")]);
  catalogoAtaques = new Map(ataques.map((a) => [a.name.toLowerCase(), a]));
  catalogoHabilidades = new Map(habilidades.map((h) => [h.name.toLowerCase(), h]));
  $("lista-habilidades").replaceChildren(...habilidades.map((h) => new Option("", h.name)));
}

function datosDeAtaque(nombre) {
  const clave = nombre.toLowerCase();
  return catalogoAtaques?.get(clave) ?? ataquesPartida.get(clave);
}

function pintarOpcionesAtaques() {
  $("lista-ataques").replaceChildren(...[...catalogoAtaques.values(), ...ataquesPartida.values()].map((a) => new Option("", a.name)));
}

async function cargarAtaquesPartida() {
  const lista = await pedir(`/runs/${runActual}/moves`);
  ataquesPartida = new Map(lista.map((a) => [a.name.toLowerCase(), a]));
  pintarOpcionesAtaques();
}

function campoManual(texto, control) {
  const campo = elemento("label", texto, "campo-manual");
  campo.append(control);
  return campo;
}

function selectorManual(opciones, valor) {
  const selector = elemento("select");
  selector.append(...opciones.map(([clave, texto]) => new Option(texto, clave)));
  selector.value = valor ?? "";
  return selector;
}

function numeroManual(valor, maximo) {
  const entrada = elemento("input");
  entrada.type = "number";
  entrada.min = 1;
  entrada.max = maximo;
  entrada.value = valor ?? "";
  return entrada;
}

// Se guarda al momento y para toda la partida, aparte de la ficha
function formularioDatosAtaque(i, nombre) {
  const a = ataquesPartida.get(nombre.toLowerCase()) ?? {};
  const caja = elemento("div", undefined, "datos-manuales");
  const tipo = selectorManual([["", "—"], ...tablaTipos.types.map((t) => [t.identifier, t.name])], a.type);
  const categoria = selectorManual([["", "—"], ...Object.entries(NOMBRE_CATEGORIA)], a.category);
  const potencia = numeroManual(a.power, 999);
  const precision = numeroManual(a.accuracy, 100);
  const pp = numeroManual(a.pp, 99);
  const descripcion = elemento("textarea");
  descripcion.rows = 2;
  descripcion.maxLength = 500;
  descripcion.value = a.description ?? "";
  const cerrar = () => {
    huecoEditando = null;
    pintarHuecos();
    pintarAprender();
  };
  const guardar = boton("Guardar datos", "mini primario", async () => {
    const numeros = [potencia, precision, pp];
    const malo = numeros.find((n) => !n.checkValidity());
    if (malo) {
      malo.reportValidity();
      return;
    }
    const numero = (entrada) => (entrada.value === "" ? null : Number(entrada.value));
    try {
      const guardado = await pedir(`/runs/${runActual}/moves`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nombre, type: tipo.value || null, category: categoria.value || null, power: numero(potencia),
          accuracy: numero(precision), pp: numero(pp), description: descripcion.value.trim() || null,
        }),
      });
      $("error-ficha").textContent = "";
      ataquesPartida.set(guardado.name.toLowerCase(), guardado);
      pintarOpcionesAtaques();
      cerrar();
    } catch (error) {
      $("error-ficha").textContent = error.message;
    }
  });
  const descripcionCampo = campoManual("Descripción", descripcion);
  descripcionCampo.classList.add("ancho");
  const acciones = elemento("div", undefined, "acciones-manuales");
  acciones.append(guardar, boton("Cancelar", "mini", cerrar));
  caja.append(campoManual("Tipo", tipo), campoManual("Categoría", categoria), campoManual("Potencia", potencia),
    campoManual("Precisión", precision), campoManual("PP", pp), descripcionCampo, acciones);
  // Enter no debe guardar la ficha
  caja.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter" && evento.target.tagName !== "TEXTAREA") evento.preventDefault();
  });
  return caja;
}

function abrirDatosAtaque(i) {
  huecoEditando = i;
  pintarHuecos();
}

function avisoFueraDeLista(alAnadir) {
  const aviso = elemento("div", "No está en la lista. ", "fuera-de-lista");
  aviso.append(boton("Añadir igualmente", "mini", () => {
    $("error-ficha").textContent = "";
    alAnadir();
  }));
  return aviso;
}

function datosAtaque(a) {
  const fila = elemento("div", undefined, "datos-ataque");
  if (a.type) fila.append(etiquetaTipo({ identifier: a.type, name: a.type_name }));
  fila.append(elemento("span", NOMBRE_CATEGORIA[a.category] ?? "—"));
  for (const [nombre, valor] of [["Pot.", a.power ?? "—"], ["Prec.", a.accuracy ? a.accuracy + "%" : "—"], ["PP", a.pp ?? "—"]]) {
    const dato = elemento("span", nombre + " ");
    dato.append(elemento("b", valor));
    fila.append(dato);
  }
  return fila;
}

function pintarHueco(i) {
  const caja = $("hueco-ataque-" + i);
  const input = $("f-ataque-" + i);
  const valor = input.value.trim().toLowerCase();
  const ataque = datosDeAtaque(valor);
  caja.style.borderLeftColor = ataque?.type ? COLOR_TIPO[ataque.type] : "";
  caja.classList.toggle("lleno", !!ataque?.type);
  caja.querySelector(".vaciar-ataque").hidden = !valor;
  input.classList.toggle("no-valido", huecosConError.has(i));
  // Confirmado: solo el nombre. Para cambiarlo, la ✕ vuelve a mostrar la caja
  const confirmado = !!valor && !huecosEscribiendo.has(i) && !huecosConError.has(i);
  input.hidden = confirmado;
  const nombre = caja.querySelector(".nombre-hueco");
  nombre.hidden = !confirmado;
  nombre.textContent = input.value.trim();
  const info = caja.querySelector(".info-ataque");
  if (huecoEditando === i) {
    // Repintar no debe borrar lo que se está escribiendo en el formulario
    if (!info.querySelector(".datos-manuales")) info.replaceChildren(formularioDatosAtaque(i, input.value.trim()));
  } else if (ataque) {
    info.replaceChildren(datosAtaque(ataque), ...(ataque.description ? [elemento("p", ataque.description, "texto-ataque")] : []),
      ...(ataquesPartida.has(valor) ? [boton("Editar datos", "mini editar-datos", () => abrirDatosAtaque(i))] : []));
  } else if (huecosConError.has(i)) {
    info.replaceChildren(avisoFueraDeLista(() => {
      ataquesManuales.add(valor);
      huecosConError.delete(i);
      abrirDatosAtaque(i);
    }));
  } else if (valor && ataquesManuales.has(valor)) {
    info.replaceChildren(elemento("p", "Añadido a mano: sin datos.", "texto-ataque suave"),
      boton("Añadir datos", "mini editar-datos", () => abrirDatosAtaque(i)));
  } else {
    info.replaceChildren();
  }
}

function pintarHuecos() {
  for (let i = 0; i < 4; i++) pintarHueco(i);
}

function pintarHabilidad() {
  const input = $("f-habilidad");
  const valor = input.value.trim().toLowerCase();
  const habilidad = catalogoHabilidades?.get(valor);
  input.classList.toggle("no-valido", habilidadConError);
  if (habilidad) {
    $("info-habilidad").replaceChildren(elemento("p", habilidad.description ?? "", "texto-ataque"));
  } else if (habilidadConError) {
    $("info-habilidad").replaceChildren(avisoFueraDeLista(() => {
      habilidadesManuales.add(valor);
      habilidadConError = false;
      pintarHabilidad();
    }));
  } else if (valor && habilidadesManuales.has(valor)) {
    $("info-habilidad").replaceChildren(elemento("p", "Añadida a mano: sin datos.", "texto-ataque suave"));
  } else {
    $("info-habilidad").replaceChildren();
  }
  // Las de la especie, si no están aleatorizadas
  $("chips-habilidad").replaceChildren(...(aprendizaje?.abilities ?? []).map((h) => {
    const chip = elemento("button", h.name, "chip-habilidad" + (h.name.toLowerCase() === valor ? " activa" : ""));
    chip.type = "button";
    if (h.hidden) chip.append(" ", elemento("small", "oculta"));
    chip.addEventListener("click", () => {
      input.value = h.name;
      habilidadConError = false;
      fichaSinGuardar = true;
      pintarHabilidad();
    });
    return chip;
  }));
}

// Al salir del campo: se pone el nombre oficial o se avisa de que no está en la lista
function comprobarHueco(i) {
  const input = $("f-ataque-" + i);
  const valor = input.value.trim().toLowerCase();
  const ataque = datosDeAtaque(valor);
  if (ataque) input.value = ataque.name;
  huecosEscribiendo.delete(i);
  if (valor && !ataque && !ataquesManuales.has(valor)) huecosConError.add(i);
  else huecosConError.delete(i);
  pintarHueco(i);
}

function comprobarHabilidad() {
  const input = $("f-habilidad");
  const valor = input.value.trim().toLowerCase();
  const habilidad = catalogoHabilidades?.get(valor);
  if (habilidad) input.value = habilidad.name;
  habilidadConError = !!valor && !habilidad && !habilidadesManuales.has(valor);
  pintarHabilidad();
}

function datosFichaValidos() {
  for (let i = 0; i < 4; i++) comprobarHueco(i);
  comprobarHabilidad();
  return !huecosConError.size && !habilidadConError;
}

$("huecos-ataque").append(...[0, 1, 2, 3].map((i) => {
  const caja = elemento("div", undefined, "hueco-ataque");
  caja.id = "hueco-ataque-" + i;
  const fila = elemento("div", undefined, "fila-hueco");
  const input = elemento("input");
  input.id = "f-ataque-" + i;
  input.maxLength = 50;
  input.placeholder = `Ataque ${i + 1}`;
  input.setAttribute("aria-label", `Ataque ${i + 1}`);
  input.setAttribute("list", "lista-ataques");
  input.autocomplete = "off";
  input.addEventListener("input", (evento) => {
    huecosConError.delete(i);
    huecosEscribiendo.add(i);
    pintarHueco(i);
    pintarAprender();
    // Elegir del desplegable no siempre lanza «change» y no es teclear: se confirma ya
    if (evento.inputType === undefined || evento.inputType === "insertReplacementText") comprobarHueco(i);
  });
  input.addEventListener("change", () => comprobarHueco(i));
  input.addEventListener("keydown", (evento) => {
    if (evento.key !== "Enter") return;
    evento.preventDefault();  // Enter confirma el ataque; no guarda la ficha
    comprobarHueco(i);
  });
  const vaciar = elemento("button", "✕", "vaciar-ataque");
  vaciar.type = "button";
  vaciar.title = "Quitar: pasa a «Puede aprender»";
  vaciar.setAttribute("aria-label", `Quitar el ataque ${i + 1}`);
  vaciar.hidden = true;
  vaciar.addEventListener("click", () => {
    const quitado = input.value.trim();
    if (quitado && !huecosConError.has(i) && !olvidados.some((m) => m.toLowerCase() === quitado.toLowerCase())) olvidados.push(quitado);
    input.value = "";
    huecosConError.delete(i);
    huecosEscribiendo.delete(i);
    if (huecoEditando === i) huecoEditando = null;
    fichaSinGuardar = true;
    pintarHueco(i);
    pintarAprender();
    input.focus();
  });
  const nombre = elemento("span", undefined, "nombre-hueco");
  nombre.hidden = true;
  fila.append(input, nombre, vaciar);
  caja.append(fila, elemento("div", undefined, "info-ataque"));
  return caja;
}));
$("f-habilidad").addEventListener("input", () => {
  habilidadConError = false;
  pintarHabilidad();
});
$("f-habilidad").addEventListener("change", comprobarHabilidad);

// Pone el ataque en el primer hueco vacío. Si están los 4 llenos no sustituye ninguno: como en los juegos,
// el jugador decide cuál quita con la ✕, y el quitado pasa a esta misma lista.
function ponerAtaque(nombre) {
  const libre = huecosAtaque().find((hueco) => !hueco.value.trim());
  if (!libre) {
    $("estado-ficha").textContent = "";
    $("error-ficha").textContent = "Los 4 huecos están ocupados: borra uno primero.";
    return;
  }
  $("error-ficha").textContent = "";
  $("estado-ficha").textContent = "";
  libre.value = nombre;
  // Uno que ya tuvo puede haberse añadido a mano
  if (!datosDeAtaque(nombre)) ataquesManuales.add(nombre.toLowerCase());
  fichaSinGuardar = true;
  pintarHuecos();
  pintarAprender();
}

// «Puede aprender»: pulsar la fila asigna el ataque; ⓘ abre su descripción
function filasAprender(lista) {
  const cabecera = elemento("tr");
  for (const [texto, clase] of [["Ataque", ""], ["Tipo", ""], ["Cat.", ""], ["Pot.", "num"], ["Prec.", "num"], ["PP", "num"], ["Cómo", ""], ["", ""]]) {
    cabecera.append(elemento("th", texto, clase));
  }
  const filas = [cabecera];
  for (const m of lista) {
    const a = datosDeAtaque(m.name) ?? {};
    const fila = elemento("tr", undefined, "fila-ataque");
    // Un botón para poder asignarlo con el teclado: su clic llega a la fila
    const nombre = elemento("td", undefined, "nombre-ataque");
    const asignar = elemento("button", m.name, "asignar-ataque");
    asignar.type = "button";
    asignar.setAttribute("aria-label", `Asignar ${m.name}`);
    nombre.append(asignar);
    const tipo = elemento("td");
    if (a.type) tipo.append(etiquetaTipo({ identifier: a.type, name: a.type_name }));
    const info = elemento("td");
    if (a.description) {
      const abrir = elemento("button", "ⓘ", "info-fila");
      abrir.type = "button";
      abrir.setAttribute("aria-label", `Descripción de ${m.name}`);
      abrir.setAttribute("aria-expanded", filaAbierta === m.name);
      abrir.addEventListener("click", (evento) => {
        evento.stopPropagation();
        filaAbierta = filaAbierta === m.name ? null : m.name;
        pintarAprender();
      });
      info.append(abrir);
    }
    fila.append(nombre, tipo, elemento("td", NOMBRE_CATEGORIA[a.category] ?? "—"),
      elemento("td", a.power ?? "—", "num"), elemento("td", a.accuracy ?? "—", "num"), elemento("td", a.pp ?? "—", "num"),
      elemento("td", detalleMetodo(m)), info);
    fila.addEventListener("click", () => ponerAtaque(m.name));
    filas.push(fila);
    if (filaAbierta === m.name && a.description) {
      const detalle = elemento("tr", undefined, "detalle-ataque");
      const celda = elemento("td", a.description);
      celda.colSpan = 8;
      detalle.append(celda);
      filas.push(detalle);
    }
  }
  return filas;
}

function detalleMetodo(ataque) {
  if (ataque.method === "olvidado") return "Ya lo tuvo";
  if (ataque.method !== "level-up") return ETIQUETA_METODO[ataque.method];
  return ataque.level ? `Nv. ${ataque.level}` : "Evo.";
}

// No se sugiere lo que ya está en un hueco
function pintarAprender() {
  const puestos = new Set(huecosAtaque().map((h) => h.value.trim().toLowerCase()).filter(Boolean));
  const filtro = $("filtro-ataques").value.trim().toLowerCase();
  const libres = (nombre) => !puestos.has(nombre.toLowerCase());
  const delJuego = new Set((aprendizaje?.moves ?? []).map((m) => m.name.toLowerCase()));

  if (!aprendizaje) {
    $("puede-aprender").replaceChildren(elemento("span", "Cargando…", "vacio"));
  } else {
    // Primero lo que ya tuvo, lo último quitado arriba; lo que también sale en la lista del juego no se repite
    const yaTuvo = olvidados.filter((m) => !delJuego.has(m.toLowerCase())).reverse().map((name) => ({ name, method: "olvidado" }));
    const todos = [...yaTuvo, ...aprendizaje.moves];
    const lista = todos.filter((m) => libres(m.name) && m.name.toLowerCase().includes(filtro));
    if (lista.length) {
      const tabla = elemento("table", undefined, "tabla-ataques");
      tabla.append(...filasAprender(lista));
      const caja = elemento("div", undefined, "caja-aprender");
      caja.append(tabla);
      // Al repintar se conserva el desplazamiento de la tabla
      const antes = $("puede-aprender").querySelector(".caja-aprender")?.scrollTop ?? 0;
      $("puede-aprender").replaceChildren(caja);
      caja.scrollTop = antes;
    } else {
      $("puede-aprender").replaceChildren(elemento("span", sinSugerencias(), "vacio"));
    }
    $("filtro-ataques").hidden = !todos.length; // sin lista, el buscador no sirve
  }
}

$("filtro-ataques").addEventListener("input", pintarAprender);
// Enter en el buscador no debe guardar la ficha
$("filtro-ataques").addEventListener("keydown", (evento) => {
  if (evento.key === "Enter") evento.preventDefault();
});

async function cargarFicha(captureId, speciesId) {
  capturaFicha = captureId;
  fichaSinGuardar = false;
  aprendizaje = null;
  olvidados = [];
  $("form-ficha").reset();
  $("estado-ficha").textContent = "";
  ataquesManuales = new Set();
  habilidadesManuales = new Set();
  huecosConError.clear();
  huecosEscribiendo.clear();
  habilidadConError = false;
  filaAbierta = null;
  huecoEditando = null;
  ataquesPartida = new Map();
  lecturasFicha = {};
  genesFicha = null;
  pintarGenes();
  nivelGuardadoFicha = null;
  noHaEvolucionado = false;
  evolucionElegida = null;
  especieVista = speciesId;
  pintarEstimaciones();
  pintarHuecos();
  pintarHabilidad();
  pintarAprender();
  try {
    await cargarNaturalezas();
    await cargarCatalogos();
    await Promise.all([cargarAtaquesPartida(), cargarTablaTipos(), cargarDatosEvolucion()]);
    const [ficha, datos] = await Promise.all([
      pedir(`/runs/${runActual}/captures/${captureId}/sheet`),
      cargarAprendizaje(speciesId),
    ]);
    if (capturaFicha !== captureId) return; // por si se abrió otra ficha mientras tanto
    aprendizaje = segunReglas(datos);
    rellenarFicha(ficha);
  } catch (error) {
    $("error-ficha").textContent = error.message;
  }
}

function numeroONulo(id) {
  const texto = $(id).value.trim();
  return texto === "" ? null : Number(texto);
}

$("form-ficha").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  $("error-ficha").textContent = "";
  $("estado-ficha").textContent = "";
  if (!datosFichaValidos()) {
    $("error-ficha").textContent = "Hay un ataque o una habilidad que no está en la lista.";
    return;
  }
  if (huecoEditando !== null) {
    $("error-ficha").textContent = "Guarda o cancela los datos del ataque antes de guardar la ficha.";
    return;
  }
  try {
    // Primero la evolución: lo escrito en la ficha ya es de la especie nueva
    const nueva = resolverEvolucion().especie;
    const captura = capturaFicha;
    if (nueva === fichaActual.species_id) {
      await guardarDatosFicha();
      $("ficha").close();
      return;
    }
    await pedirEvolucion(captura, datosEvolucion[nueva].name);
    try {
      await guardarDatosFicha();
    } catch (error) {
      // Ya ha evolucionado: se abre la ficha de la especie nueva para no intentarlo dos veces
      await cargarRun();
      abrirFicha(vivosActual.find((q) => q.capture_id === captura), true);
      $("error-ficha").textContent = error.message;
      return;
    }
    $("ficha").close();
    await cargarRun();
  } catch (error) {
    $("error-ficha").textContent = error.message;
  }
});

function pedirEvolucion(captura, especie) {
  return pedir(`/runs/${runActual}/captures/${captura}/evolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ species: especie }),
  });
}

async function guardarDatosFicha() {
  const datos = {
    level: numeroONulo("f-nivel"),
    nature: $("f-naturaleza").value || null,
    ability: $("f-habilidad").value.trim() || null,
    item: $("f-objeto").value.trim() || null,
    moves: [0, 1, 2, 3].map((i) => $("f-ataque-" + i).value.trim()).filter(Boolean),
  };
  for (const campo of ESTADISTICAS) datos[campo] = numeroONulo("f-" + campo);
  datos.estimated = ESTADISTICAS.filter(esEstimada);
  await pedir(`/runs/${runActual}/captures/${capturaFicha}/sheet`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  fichaSinGuardar = false;
}

// ---------- Evolucionar ----------
// Para lo que no depende del nivel (piedra, intercambio, amistad...): solo sus evoluciones oficiales.
// La ventana se abre sobre la ficha, para poder subir el nivel y evolucionar a la vez.
let evolucionManual = null;

function opcionesDeEvolucion() {
  return (datosEvolucion?.[fichaActual?.species_id]?.evolutions ?? []).map((e) => datosEvolucion[e.to].name);
}

function pintarOpcionesEvolucion() {
  $("evolucion-opciones").replaceChildren(...opcionesDeEvolucion().map((nombre) => {
    const chip = elemento("button", nombre, "chip-habilidad" + (nombre === evolucionManual ? " activa" : ""));
    chip.type = "button";
    chip.addEventListener("click", () => {
      evolucionManual = nombre;
      $("error-evolucion").textContent = "";
      pintarOpcionesEvolucion();
    });
    return chip;
  }));
}

function abrirEvolucion() {
  const opciones = opcionesDeEvolucion();
  evolucionManual = opciones.length === 1 ? opciones[0] : null;
  $("error-evolucion").textContent = "";
  pintarOpcionesEvolucion();
  $("dialogo-evolucion").showModal();
}

$("abrir-evolucion").addEventListener("click", abrirEvolucion);

$("cancelar-evolucion").addEventListener("click", () => $("dialogo-evolucion").close());

$("form-evolucion").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  $("error-evolucion").textContent = "";
  if (!evolucionManual) {
    $("error-evolucion").textContent = "Elige a qué especie evoluciona.";
    return;
  }
  if (!datosFichaValidos() || huecoEditando !== null) {
    $("error-evolucion").textContent = "Revisa los ataques y la habilidad de la ficha antes de evolucionar.";
    return;
  }
  const captura = fichaActual.capture_id;
  try {
    // Lo elegido aquí manda sobre la evolución automática. Lo cambiado en la ficha (normalmente, el nivel) se guarda antes.
    noHaEvolucionado = true;
    evolucionElegida = null;
    pintarEstimaciones();
    if (fichaSinGuardar) await guardarDatosFicha();
    await pedirEvolucion(captura, evolucionManual);
    await cargarRun();
    const nuevo = vivosActual.find((q) => q.capture_id === captura);
    $("dialogo-evolucion").close();
    abrirFicha(nuevo, true, fichaLista.map((q) => (q.capture_id === captura ? nuevo : q)));
    await cargaFichaEnCurso;
    // Las estimaciones también se guardan: el análisis del equipo lee lo guardado
    await guardarDatosFicha();
  } catch (error) {
    if ($("dialogo-evolucion").open) {
      $("error-evolucion").textContent = error.message;
      noHaEvolucionado = false;
      pintarEstimaciones();
    } else $("error-ficha").textContent = error.message;
  }
});

$("f-naturaleza").addEventListener("change", () => {
  marcarNaturaleza();
  pintarEstimaciones();
});
// Cada nivel es una ocasión nueva de evolucionar, como en el juego
$("f-nivel").addEventListener("input", () => {
  noHaEvolucionado = false;
  evolucionElegida = null;
  pintarEstimaciones();
});
// Lo que se escribe a mano es la lectura real de este nivel. Al vaciarlo se quita solo esa: las anteriores no se pierden
for (const campo of ESTADISTICAS) {
  $("f-" + campo).addEventListener("input", () => {
    const valor = numeroONulo("f-" + campo);
    const nivel = nivelFichaValido();
    if (!nivel) return;
    const otras = (lecturasFicha[campo] || []).filter((x) => x.level !== nivel);
    lecturasFicha[campo] = Number.isInteger(valor) && valor >= 1 ? [...otras, lecturaNueva(campo, nivel, valor)] : otras;
    pintarEstimaciones();
  });
  $("f-" + campo).addEventListener("blur", pintarEstimaciones);
}
// Si lo estimado ya coincide con el juego, confirmarlo también aporta información
$("confirmar-estimadas").addEventListener("click", () => {
  const nivel = nivelFichaValido();
  for (const campo of ESTADISTICAS) {
    const valor = numeroONulo("f-" + campo);
    if (esEstimada(campo) && Number.isInteger(valor) && valor >= 1) {
      lecturasFicha[campo] = [...lecturasFicha[campo].filter((x) => x.level !== nivel), lecturaNueva(campo, nivel, valor)];
    }
  }
  fichaSinGuardar = true;
  pintarEstimaciones();
});

function abrirFicha(p, vivo, lista = [p]) {
  fichaLista = lista;
  fichaActual = p;
  fichaVivoLista = vivo;
  $("ficha-navegar").hidden = lista.length < 2;
  $("ficha-posicion").textContent = `${lista.findIndex((q) => q.capture_id === p.capture_id) + 1} / ${lista.length}`;
  const enEquipo = equipoActual.some((q) => q.capture_id === p.capture_id);
  $("error-ficha").textContent = "";
  cargaFichaEnCurso = cargarFicha(p.capture_id, p.species_id);
  pintarCabeceraFicha(p, vivo);
  const estado = [elemento("span", vivo ? "Vivo" : muerteDefinitiva() ? "Muerto" : "Debilitado", "marca-estado" + (vivo ? "" : " muerto"))];
  if (enEquipo) estado.push(elemento("span", "En el equipo", "marca-estado"));
  if (p.shiny) estado.push(elemento("span", "✨ Variocolor", "marca-estado variocolor"));
  $("ficha-estado").replaceChildren(...estado);

  // Solo las acciones que tienen sentido en cada caso
  const acciones = [];
  if (vivo) {
    acciones.push(boton("Debilitado", "primario", async () => {
      if (!await fichaPuedeCerrarse()) return;
      if (muerteDefinitiva() && !await confirmar("¿Debilitado?",
          "En esta partida, un Pokémon debilitado está muerto. Solo podrás revivirlo para corregir un error.", "Confirmar")) return;
      accionFicha(pedir(`/runs/${runActual}/captures/${p.capture_id}/death`, { method: "POST" }));
    }));
  } else {
    acciones.push(boton("Revivir", "", async () => {
      if (!await fichaPuedeCerrarse()) return;
      if (muerteDefinitiva() && !await confirmar("¿Revivir?",
          "En esta partida la muerte es definitiva. Revive solo para corregir un error al marcarla.", "Revivir")) return;
      accionFicha(pedir(`/runs/${runActual}/captures/${p.capture_id}/death`, { method: "DELETE" }));
    }));
  }
  if (enEquipo) {
    acciones.push(boton("Sacar del equipo", "", async () => {
      if (!await fichaPuedeCerrarse()) return;
      $("ficha").close();
      guardarEquipo(equipoActual.filter((q) => q.capture_id !== p.capture_id).map((q) => q.capture_id));
    }));
  } else if (vivo && equipoActual.length < TAMANO_EQUIPO) {
    acciones.push(boton("Añadir al equipo", "", async () => {
      if (!await fichaPuedeCerrarse()) return;
      $("ficha").close();
      guardarEquipo([...equipoActual.map((q) => q.capture_id), p.capture_id]);
    }));
  }
  if ((p.types || []).length) {
    acciones.push(boton("Debilidades", "", () => salirDeFicha(() => abrirAnalisis({ ...p, alive: vivo }))));
  }
  acciones.push(boton("Eliminar", "peligro", () => {
    eliminarEncuentro(p.capture_id, `${p.nickname || p.species} (${p.route})`);
  }));
  $("ficha-acciones").replaceChildren(...acciones);
  if (!$("ficha").open) $("ficha").showModal();
}

// Lo que saque de la ficha pregunta antes si hay cambios sin guardar
async function fichaPuedeCerrarse() {
  if (!fichaSinGuardar) return true;
  if (!await confirmar("¿Salir de la ficha?", "Tienes cambios sin guardar en esta ficha y se perderán.", "Salir")) return false;
  fichaSinGuardar = false;
  return true;
}

async function cerrarFicha() {
  if (await fichaPuedeCerrarse()) $("ficha").close();
}

$("cerrar-ficha").addEventListener("click", cerrarFicha);
// El buscador de ataques no cambia datos de la ficha
$("form-ficha").addEventListener("input", (evento) => {
  // Tampoco los datos de un ataque a mano: se guardan aparte
  if (evento.target.id !== "filtro-ataques" && !evento.target.closest(".datos-manuales")) fichaSinGuardar = true;
});

// ---------- Pasar de un Pokémon a otro con las flechas ----------
let fichaLista = [];       // la lista desde la que se abrió: equipo, vivos o cementerio
let fichaActual = null;
let fichaVivoLista = true; // vivos y cementerio no traen «alive»: es el mismo para toda la lista
let fichaSinGuardar = false;
let cargaFichaEnCurso = null;

// Siguiente o anterior, y al llegar al final vuelve a empezar
function vecinoEn(lista, indice, sentido) {
  return lista[(indice + sentido + lista.length) % lista.length];
}

async function moverFicha(sentido) {
  const indice = fichaLista.findIndex((q) => q.capture_id === fichaActual?.capture_id);
  if (indice < 0 || fichaLista.length < 2) return;
  if (fichaSinGuardar && !await confirmar("¿Cambiar de Pokémon?", "Tienes cambios sin guardar en esta ficha y se perderán.", "Cambiar")) return;
  const siguiente = vecinoEn(fichaLista, indice, sentido);
  abrirFicha(siguiente, siguiente.alive ?? fichaVivoLista, fichaLista);
}

$("ficha-anterior").addEventListener("click", () => moverFicha(-1));
$("ficha-siguiente").addEventListener("click", () => moverFicha(1));
$("corregir-ficha").addEventListener("click", () => salirDeFicha(() => abrirCorreccion(fichaActual)));

function moverAnalisis(sentido) {
  const vivos = vivosEquipo();
  // En Ataque siempre hay un Pokémon a la vista: sin elegir, el primero
  const actual = pokeAnalisis ?? ($("analisis-ataque").hidden ? null : vivos[0]);
  const indice = vivos.findIndex((q) => q.capture_id === actual?.capture_id);
  if (indice < 0 || vivos.length < 2) return;
  pokeAnalisis = vecinoEn(vivos, indice, sentido);
  pintarAnalisis();
}

// En el documento y no en cada ventana: al repintar se pierde el foco y la pulsación ya no pasaría por ella.
// Mientras se escribe en un campo, las flechas mueven el cursor.
document.addEventListener("keydown", (evento) => {
  if (evento.key !== "ArrowLeft" && evento.key !== "ArrowRight") return;
  if (evento.target.closest("input, select, textarea") || $("dialogo-confirmar").open || $("dialogo-evolucion").open) return;
  const sentido = evento.key === "ArrowRight" ? 1 : -1;
  if ($("ficha").open) {
    evento.preventDefault();
    moverFicha(sentido);
  } else if ($("analisis").open && (!$("analisis-defensa").hidden || !$("analisis-ataque").hidden)) {
    evento.preventDefault();
    moverAnalisis(sentido);
  }
});

// Eliminar borra de verdad (decisión A): por eso se pide confirmación antes.
async function eliminarEncuentro(encuentroId, descripcion) {
  if (!await confirmar("¿Eliminar?",
      `Vas a eliminar ${descripcion}. Se borra por completo (también su ficha, su muerte y su sitio en el equipo) y no se puede deshacer.`,
      "Eliminar")) return;
  if ($("ficha").open) $("ficha").close(); // el aviso sale encima de la ficha: al cancelar, se sigue en ella
  mostrarMensaje("");
  try {
    await pedir(`/runs/${runActual}/encounters/${encuentroId}`, { method: "DELETE" });
  } catch (error) {
    mostrarMensaje(error.message);
  }
  await cargarRun();
}

// ---------- Análisis: daño de cada tipo ----------
// Dentro de un Pokémon, los multiplicadores de sus tipos se multiplican (como en el juego).
// En el equipo se cuenta cuántos vivos son débiles y cuántos resisten cada tipo, como hacen las herramientas y guías
// de equipos: lo que más pesa es que un tipo amenace a varios, no un solo ×4. Es una medida de tipos, no el daño real.
const MAXIMO_LISTA_EQUIPO = 5;
const AVISO_DEBILES = 3; // la pauta habitual: 3 débiles al mismo tipo ya es un problema
const ESCALA_POKEMON = 4; // ×4 (el máximo posible) llena la barra
const MULTIPLICADORES = [[4, "4", "m-x4"], [2, "2", "m-x2"], [0.5, "½", "m-m2"], [0.25, "¼", "m-m4"], [0, "0", "m-0"]];
let tablaTipos = null; // se pide una sola vez: no cambia
let pokeAnalisis = null; // el Pokémon elegido; null = el equipo
let filaAnalisis = null; // el tipo resaltado en el detalle

async function cargarTablaTipos() {
  tablaTipos ??= await pedir("/types/chart");
}

function vivosEquipo() {
  return equipoActual.filter((p) => p.alive && (p.types || []).length);
}

function multiplicador(ataque, tipos) {
  return tipos.reduce((total, t) => total * tablaTipos.factors[ataque][t.identifier], 1);
}

// De más a menos peligroso: más débiles; a igualdad, menos resistencias; a igualdad, algún ×4
function recuentoEquipo(vivos) {
  return tablaTipos.types
    .map((tipo) => {
      const valores = vivos.map((p) => multiplicador(tipo.identifier, p.types));
      return {
        tipo,
        valores,
        debiles: valores.filter((v) => v > 1).length,
        resisten: valores.filter((v) => v < 1).length,
        cuadruples: valores.filter((v) => v === 4).length,
      };
    })
    .sort((a, b) => b.debiles - a.debiles || a.resisten - b.resisten || b.cuadruples - a.cuadruples);
}

function textoRecuento({ debiles, resisten }) {
  const partes = [];
  if (debiles) partes.push(`${debiles} ${debiles === 1 ? "débil" : "débiles"}`);
  if (resisten) partes.push(`${resisten} ${resisten === 1 ? "resiste" : "resisten"}`);
  return partes.join(" · ");
}

// Una fila de la pestaña Equipo: un punto por Pokémon, con el color de su multiplicador (blanco si es neutro)
function barraRecuento(fila) {
  const boton = elemento("button", undefined, "barra-tipo barra-recuento");
  boton.type = "button";
  boton.dataset.tipo = fila.tipo.identifier;
  const puntos = elemento("span", undefined, "puntos-equipo");
  puntos.setAttribute("aria-hidden", "true");
  puntos.append(...fila.valores.map((v) => elemento("i", undefined, MULTIPLICADORES.find(([m]) => m === v)?.[2])));
  boton.append(etiquetaTipo(fila.tipo), puntos, elemento("span", textoRecuento(fila), "recuento"));
  boton.addEventListener("click", () => resaltarTipo(fila.tipo.identifier));
  return boton;
}

function etiquetaTipo(tipo) {
  const etiqueta = elemento("span", tipo.name, "tipo");
  etiqueta.style.background = COLOR_TIPO[tipo.identifier] || "#777";
  return etiqueta;
}

function barraDano({ tipo, valor }, escala) {
  const fila = elemento("button", undefined, "barra-tipo");
  fila.type = "button";
  fila.dataset.tipo = tipo.identifier;
  const pista = elemento("span", undefined, "pista-dano");
  const relleno = elemento("i");
  relleno.style.width = Math.min(100, (valor / escala) * 100) + "%";
  relleno.style.background = COLOR_TIPO[tipo.identifier] || "#777";
  const neutro = elemento("b"); // la marca del daño neutro (×1)
  neutro.style.left = 100 / escala + "%";
  pista.append(relleno, neutro);
  fila.append(etiquetaTipo(tipo), pista,
    elemento("span", "×" + valor.toLocaleString("es-ES", { maximumFractionDigits: 2 }), "valor-dano"));
  fila.addEventListener("click", () => resaltarTipo(tipo.identifier));
  return fila;
}

function pintarFilasAnalisis(contenedor, filas) {
  contenedor.replaceChildren(...(filas.length ? filas : [elemento("p", "Ninguna", "vacio")]));
}

function celdaMultiplicador(valor) {
  const celda = elemento("td", undefined, "celda");
  const datos = MULTIPLICADORES.find(([m]) => m === valor);
  if (datos) celda.append(elemento("span", datos[1], "mult " + datos[2]));
  return celda;
}

function cabezaPokemon(p) {
  const celda = elemento("th");
  const elegir = elemento("button", undefined, "cabeza");
  elegir.type = "button";
  elegir.dataset.captura = p.capture_id;
  elegir.append(miniatura(p.species_id, false, 34, p.shiny), elemento("span", p.nickname || p.species));
  // Volver a pulsarlo vuelve al equipo
  elegir.addEventListener("click", () => {
    // La ventana no se mueve: las barras cambian de altura, así que se compensa para que el dibujo siga en su sitio
    const antes = elegir.getBoundingClientRect().top;
    pokeAnalisis = pokeAnalisis?.capture_id === p.capture_id ? null : p;
    pintarAnalisis();
    const ahora = document.querySelector(`#analisis-mapa .cabeza[data-captura="${p.capture_id}"]`).getBoundingClientRect().top;
    $("analisis").scrollTop += ahora - antes;
  });
  celda.append(elegir);
  return celda;
}

function pintarDetalle(vivos, orden) {
  const cabecera = elemento("tr");
  cabecera.append(elemento("th", "⚔️", "nombre-tipo esquina"));
  cabecera.append(...vivos.map(cabezaPokemon));
  const filas = orden.map(({ tipo }) => {
    const fila = elemento("tr");
    fila.dataset.tipo = tipo.identifier;
    const nombre = elemento("th");
    nombre.append(etiquetaTipo(tipo));
    fila.append(nombre, ...vivos.map((p) => celdaMultiplicador(multiplicador(tipo.identifier, p.types))));
    return fila;
  });
  $("analisis-mapa").replaceChildren(cabecera, ...filas);
}

function resaltarTipo(tipo) {
  filaAnalisis = tipo;
  document.querySelectorAll("#analisis .barra-tipo").forEach((b) => b.classList.toggle("activa", b.dataset.tipo === tipo));
  document.querySelectorAll("#analisis-mapa tr[data-tipo]").forEach((f) => f.classList.toggle("fila-activa", f.dataset.tipo === tipo));
}

// Equipo o un Pokémon. Ataque es siempre de un Pokémon, y sin elegir muestra el primero
function pintarSelectorAnalisis(zona, conEquipo) {
  const lista = vivosEquipo();
  if (pokeAnalisis && !lista.some((p) => p.capture_id === pokeAnalisis.capture_id)) lista.push(pokeAnalisis);
  const activo = pokeAnalisis ?? (conEquipo ? null : lista[0]);
  const botones = lista.map((p) => {
    const elegir = elemento("button", undefined, "boton-pokemon" + (p.capture_id === activo?.capture_id ? " activo" : ""));
    elegir.type = "button";
    elegir.append(miniatura(p.species_id, !p.alive && p.alive !== undefined, 26, p.shiny), p.nickname || p.species);
    elegir.addEventListener("click", () => {
      pokeAnalisis = p;
      pintarAnalisis();
    });
    return elegir;
  });
  if (conEquipo) {
    const equipo = elemento("button", "Equipo", "boton-pokemon" + (activo ? "" : " activo"));
    equipo.type = "button";
    equipo.addEventListener("click", () => {
      pokeAnalisis = null;
      pintarAnalisis();
    });
    botones.unshift(equipo);
  }
  zona.replaceChildren(...botones, ...(activo?.types ?? []).map(etiquetaTipo));
  return activo;
}

function pintarAnalisis() {
  const vivos = vivosEquipo();
  const recuento = vivos.length ? recuentoEquipo(vivos) : [];
  pintarSelectorAnalisis($("analisis-elegido"), true);

  let amenazas, resistencias, inmunes = [];
  if (pokeAnalisis) {
    // Un Pokémon: su multiplicador con cada tipo, todo lo que no es neutro
    const lista = tablaTipos.types.map((tipo) => ({ tipo, valor: multiplicador(tipo.identifier, pokeAnalisis.types) }));
    amenazas = lista.filter((x) => x.valor > 1).sort((a, b) => b.valor - a.valor).map((x) => barraDano(x, ESCALA_POKEMON));
    resistencias = lista.filter((x) => x.valor > 0 && x.valor < 1).sort((a, b) => a.valor - b.valor).map((x) => barraDano(x, ESCALA_POKEMON));
    inmunes = lista.filter((x) => x.valor === 0).map((x) => etiquetaTipo(x.tipo));
  } else {
    const peores = recuento.filter((x) => x.debiles).slice(0, MAXIMO_LISTA_EQUIPO);
    // Un tipo que ya está en Amenazas no sale también aquí
    const mejores = recuento
      .filter((x) => x.resisten > x.debiles && !peores.includes(x))
      .sort((a, b) => b.resisten - b.debiles - (a.resisten - a.debiles) || b.resisten - a.resisten)
      .slice(0, MAXIMO_LISTA_EQUIPO);
    amenazas = peores.map(barraRecuento);
    resistencias = mejores.map(barraRecuento);
  }
  $("analisis-vacio").hidden = !!pokeAnalisis || vivos.length > 0;
  $("analisis-datos").hidden = !pokeAnalisis && !vivos.length;
  $("analisis-detalle").hidden = !vivos.length;
  pintarFilasAnalisis($("analisis-amenazas"), amenazas);
  pintarFilasAnalisis($("analisis-resistencias"), resistencias);
  $("titulo-amenazas").textContent = pokeAnalisis ? "Es débil contra" : "El equipo es débil contra";
  $("titulo-resistencias").textContent = pokeAnalisis ? "Resiste" : "El equipo resiste";
  $("zona-inmune").hidden = !inmunes.length;
  $("analisis-inmune").replaceChildren(...inmunes);

  const avisos = [];
  if (!pokeAnalisis) {
    const muchos = recuento.filter((x) => x.debiles >= AVISO_DEBILES);
    const sinResistir = recuento.filter((x) => !x.resisten).map((x) => x.tipo.name);
    avisos.push(...muchos.map((x) => `${x.tipo.name}: ${x.debiles} de ${vivos.length} débiles`));
    if (sinResistir.length) avisos.push("Nadie resiste: " + sinResistir.join(", "));
  }
  if ("aleatorio_tipos" in reglasPartida) avisos.push("Tipos aleatorizados: se usan los oficiales");
  $("analisis-aviso").textContent = avisos.join(". ");
  $("analisis-aviso").hidden = !avisos.length;

  if (vivos.length) {
    pintarDetalle(vivos, recuento);
    document.querySelectorAll("#analisis-mapa .cabeza").forEach((c) =>
      c.classList.toggle("activo", Number(c.dataset.captura) === pokeAnalisis?.capture_id));
    resaltarTipo(filaAnalisis ?? recuento[0].tipo.identifier);
  }
  pintarTablaTipos(vivos);
  pintarAtaque(vivos);
  pintarCombate(vivos);
}

// ---------- Análisis: lo que hacen los ataques asignados ----------
// Solo cuentan los ataques con daño y tipo conocido. Se mide contra un solo tipo: es una medida de tipos, no el daño real.
let ataquesDelEquipo = new Map(); // capture_id -> nombres de sus ataques

async function cargarAtaquesEquipo(pokemon) {
  const lista = vivosEquipo();
  if (pokemon && !lista.some((p) => p.capture_id === pokemon.capture_id)) lista.push(pokemon);
  const fichas = await Promise.all(lista.map((p) => pedir(`/runs/${runActual}/captures/${p.capture_id}/sheet`)));
  ataquesDelEquipo = new Map(lista.map((p, i) => [p.capture_id, fichas[i].moves]));
}

function haceDano(ataque) {
  return !!ataque?.type && ataque.category !== "status";
}

// El mejor multiplicador de esos ataques contra un tipo; null si ninguno hace daño
function mejorContra(nombres, defensor) {
  const valores = nombres.map(datosDeAtaque).filter(haceDano).map((a) => tablaTipos.factors[a.type][defensor]);
  return valores.length ? Math.max(...valores) : null;
}

function grupoEfecto(titulo, clase, lista) {
  if (!lista.length) return [];
  const grupo = elemento("div", undefined, "grupo-efecto");
  const tipos = elemento("div", undefined, "lista-tipos");
  tipos.append(...lista.map(etiquetaTipo));
  grupo.append(elemento("span", titulo, "efecto " + clase), tipos);
  return [grupo];
}

function tarjetaAtaque(nombre) {
  const a = datosDeAtaque(nombre);
  const tarjeta = elemento("div", undefined, "tarjeta-efecto");
  tarjeta.style.borderLeftColor = a?.type ? COLOR_TIPO[a.type] : "";
  const cabecera = elemento("div", undefined, "cabecera-efecto");
  cabecera.append(elemento("b", nombre));
  if (a?.type) cabecera.append(etiquetaTipo({ identifier: a.type, name: a.type_name }));
  cabecera.append(elemento("span", a?.category === "status" ? "Estado" : `Pot. ${a?.power ?? "—"}`, "dato-efecto"));
  tarjeta.append(cabecera);
  if (a?.category === "status") {
    tarjeta.append(elemento("p", "No hace daño: no tiene efectividad.", "resto-efecto"));
  } else if (!a?.type) {
    tarjeta.append(elemento("p", "Sin tipo: añade sus datos en la ficha para calcularlo.", "resto-efecto"));
  } else {
    const contra = (condicion) => tablaTipos.types.filter((t) => condicion(tablaTipos.factors[a.type][t.identifier]));
    tarjeta.append(
      ...grupoEfecto("×2 Supereficaz", "e-x2", contra((v) => v > 1)),
      ...grupoEfecto("×½ Poco eficaz", "e-m2", contra((v) => v > 0 && v < 1)),
      ...grupoEfecto("×0 No le afecta", "e-0", contra((v) => v === 0)),
      elemento("p", `×1 contra los otros ${contra((v) => v === 1).length} tipos`, "resto-efecto")
    );
  }
  return tarjeta;
}

function pintarAtaque(vivos) {
  const p = pintarSelectorAnalisis($("ataque-elegido"), false);
  const nombres = p ? ataquesDelEquipo.get(p.capture_id) ?? [] : [];
  const vacio = !p ? "Añade Pokémon vivos al equipo para ver su análisis."
    : !nombres.length ? "Este Pokémon no tiene ataques asignados: se ponen en su ficha." : "";
  $("ataque-vacio").textContent = vacio;
  $("ataque-vacio").hidden = !vacio;
  $("ataque-datos").hidden = !!vacio;
  if (vacio) return;
  const cubiertos = tablaTipos.types.filter((t) => mejorContra(nombres, t.identifier) > 1).length;
  $("ataque-resumen").textContent = `${p.nickname || p.species} es supereficaz contra ${cubiertos} de ${tablaTipos.types.length} tipos`;
  $("ataque-tarjetas").replaceChildren(...nombres.map(tarjetaAtaque));
}

// ---------- Análisis: el ataque que más daño haría contra el rival ----------
// Solo potencia y multiplicadores: elegir el mejor de verdad (prioridad, efectos, precisión) queda para la futura IA.
const BONUS_TIPO_PROPIO = 1.5;
let rivalCombate = []; // uno o dos tipos
let rivalEspecie = null; // el Pokémon rival, si se ha buscado por nombre: sus tipos se marcan solos

function elegirRival(id) {
  rivalEspecie = id;
  rivalCombate = datosEvolucion[id].types.map((t) => t.identifier);
  $("rival-nombre").value = "";
  pintarCombate(vivosEquipo());
}

function pintarRival() {
  const elegido = rivalEspecie && datosEvolucion?.[rivalEspecie];
  $("rival-elegido").hidden = !elegido;
  $("rival-nombre").hidden = !!elegido;
  if (!elegido) {
    $("nota-rival").textContent = datosEvolucion ? "Escribe su nombre y se marcan sus tipos." : "";
    return elegido;
  }
  $("rival-dibujo").replaceChildren(miniatura(rivalEspecie, false, 36));
  $("rival-texto").textContent = elegido.name;
  const oficiales = elegido.types.map((t) => t.identifier);
  const cambiados = oficiales.length !== rivalCombate.length || oficiales.some((t) => !rivalCombate.includes(t));
  // En un Randomlocke con tipos aleatorizados, los oficiales pueden no ser los de la partida
  $("nota-rival").textContent = cambiados ? "Tipos cambiados a mano." : `Tipos oficiales de ${elegido.name}. Puedes cambiarlos abajo.`;
  return elegido;
}

$("rival-nombre").addEventListener("input", () => {
  const texto = $("rival-nombre").value.trim().toLowerCase();
  const id = Object.keys(datosEvolucion ?? {}).find((k) => datosEvolucion[k].name.toLowerCase() === texto);
  if (id) elegirRival(Number(id));
});

$("quitar-rival").addEventListener("click", () => {
  rivalEspecie = null;
  rivalCombate = [];
  pintarCombate(vivosEquipo());
  $("rival-nombre").focus();
});

const numeroDano = (n) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });
const textoFactor = (v) => (v === 0.5 ? "½" : v === 0.25 ? "¼" : String(v));

function danosContra(vivos) {
  const filas = [];
  for (const p of vivos) {
    for (const nombre of ataquesDelEquipo.get(p.capture_id) ?? []) {
      const a = datosDeAtaque(nombre);
      if (!haceDano(a)) continue;
      const multiplicador = rivalCombate.reduce((total, tipo) => total * tablaTipos.factors[a.type][tipo], 1);
      const propio = p.types.some((t) => t.identifier === a.type);
      const dano = a.power ? a.power * multiplicador * (propio ? BONUS_TIPO_PROPIO : 1) : null;
      filas.push({ p, nombre, a, multiplicador, propio, dano });
    }
  }
  return filas.sort((x, y) => (y.dano ?? -1) - (x.dano ?? -1) || y.multiplicador - x.multiplicador);
}

function filaDano(f, maximo) {
  const fila = elemento("div", undefined, "fila-dano");
  const nombre = elemento("div", f.nombre, "nombre-dano");
  nombre.append(elemento("small", f.p.nickname || f.p.species));
  const barra = elemento("div", undefined, "barra-dano");
  const relleno = elemento("i");
  relleno.style.width = (f.dano ?? 0) / maximo * 100 + "%";
  relleno.style.background = COLOR_TIPO[f.a.type];
  barra.append(relleno);
  const partes = [f.a.power ?? "sin potencia", textoFactor(f.multiplicador), ...(f.propio ? ["1,5"] : [])];
  const cifra = elemento("div", undefined, "cifra-dano");
  cifra.append(elemento("b", f.dano === null ? "—" : numeroDano(f.dano)), elemento("small", partes.join(" × ")));
  fila.append(miniatura(f.p.species_id, false, 30, f.p.shiny), nombre, barra, cifra);
  return fila;
}

function pintarCombate(vivos) {
  const rival = pintarRival();
  $("combate-rival").replaceChildren(...tablaTipos.types.map((tipo) => {
    const elegir = elemento("button", tipo.name, rivalCombate.includes(tipo.identifier) ? "activo" : "");
    elegir.type = "button";
    elegir.style.background = COLOR_TIPO[tipo.identifier] || "#777";
    elegir.setAttribute("aria-pressed", rivalCombate.includes(tipo.identifier));
    elegir.addEventListener("click", () => {
      // Como máximo dos: el tercero sustituye al más antiguo
      rivalCombate = rivalCombate.includes(tipo.identifier)
        ? rivalCombate.filter((t) => t !== tipo.identifier)
        : [...rivalCombate, tipo.identifier].slice(-2);
      if (!rivalCombate.length) rivalEspecie = null;
      pintarCombate(vivosEquipo());
    });
    return elegir;
  }));
  const nombres = vivos.flatMap((p) => ataquesDelEquipo.get(p.capture_id) ?? []);
  const filas = rivalCombate.length ? danosContra(vivos) : [];
  const vacio = !vivos.length ? "Añade Pokémon vivos al equipo para ver su análisis."
    : !rivalCombate.length ? "Elige un rival o un tipo para ver tus ataques."
    : !filas.length ? "Tu equipo no tiene ataques con daño calculable." : "";
  $("combate-vacio").textContent = vacio;
  $("combate-vacio").hidden = !vacio;

  const mejor = filas[0]?.dano ? filas[0] : null;
  $("combate-mejor").hidden = !mejor;
  if (mejor) {
    const contra = rival ? ` contra ${rival.name}` : "";
    $("combate-mejor").replaceChildren(`Más daño${contra}: ${mejor.p.nickname || mejor.p.species} con ${mejor.nombre} `, elemento("b", numeroDano(mejor.dano)));
  }
  const avisos = [];
  if (filas.length && !mejor) avisos.push("Ningún ataque con potencia conocida le hace daño");
  const sinTipo = [...new Set(nombres.filter((n) => {
    const a = datosDeAtaque(n);
    return !a?.type && a?.category !== "status";
  }))];
  if (rivalCombate.length && sinTipo.length) avisos.push("Sin tipo, no cuentan: " + sinTipo.join(", ") + ". Puedes completarlos en la ficha");
  if ("aleatorio_tipos" in reglasPartida) avisos.push("Tipos aleatorizados: se usan los oficiales");
  $("combate-aviso").textContent = avisos.join(". ");
  $("combate-aviso").hidden = !avisos.length;
  const maximo = Math.max(1, ...filas.map((f) => f.dano ?? 0));
  $("combate-lista").replaceChildren(...filas.map((f) => filaDano(f, maximo)));
}

function columnaTipo(tipo, mio = false) {
  const celda = elemento("th", undefined, "col" + (mio ? " mio" : ""));
  const nombre = elemento("span", tipo.name.slice(0, 3));
  nombre.title = tipo.name;
  nombre.style.background = COLOR_TIPO[tipo.identifier] || "#777";
  celda.append(nombre);
  return celda;
}

// Tabla completa: ⚔️ en las filas y 🛡️ en las columnas; marcadas las columnas de los tipos del equipo
function pintarTablaTipos(vivos) {
  const mios = new Set(vivos.flatMap((p) => p.types.map((t) => t.identifier)));
  const cabecera = elemento("tr");
  cabecera.append(elemento("th", "⚔️ ↓ · 🛡️ →", "nombre-tipo esquina"));
  cabecera.append(...tablaTipos.types.map((tipo) => columnaTipo(tipo, mios.has(tipo.identifier))));
  const filas = tablaTipos.types.map((ataque) => {
    const fila = elemento("tr");
    const nombre = elemento("th");
    nombre.append(etiquetaTipo(ataque));
    fila.append(nombre);
    for (const defensor of tablaTipos.types) {
      const celda = celdaMultiplicador(tablaTipos.factors[ataque.identifier][defensor.identifier]);
      celda.dataset.columna = defensor.identifier;
      if (mios.has(defensor.identifier)) celda.classList.add("miacol");
      fila.append(celda);
    }
    return fila;
  });
  $("analisis-tabla").replaceChildren(cabecera, ...filas);
}

function verVistaAnalisis(vista) {
  document.querySelectorAll("#analisis .pestana").forEach((p) => p.classList.toggle("activa", p.dataset.vista === vista));
  for (const id of ["analisis-defensa", "analisis-ataque", "analisis-combate", "analisis-tipos"]) $(id).hidden = vista !== id;
  $("analisis").scrollTop = 0;
}

async function abrirAnalisis(pokemon = null) {
  mostrarMensaje("");
  try {
    await Promise.all([cargarTablaTipos(), cargarCatalogos(), cargarDatosEvolucion()]);
    await Promise.all([cargarAtaquesPartida(), cargarAtaquesEquipo(pokemon)]);
  } catch (error) {
    mostrarMensaje(error.message);
    return;
  }
  pokeAnalisis = pokemon;
  filaAnalisis = null;
  rivalCombate = [];
  rivalEspecie = null;
  $("rival-nombre").value = "";
  // Sin los datos de las especies se puede seguir eligiendo el tipo
  $("rival-nombre").disabled = !datosEvolucion;
  if (datosEvolucion && !$("lista-rivales").options.length) {
    $("lista-rivales").append(...Object.values(datosEvolucion).map((e) => new Option("", e.name)));
  }
  pintarAnalisis();
  verVistaAnalisis("analisis-defensa");
  $("analisis").showModal();
}

$("analisis-leyenda").append(...MULTIPLICADORES.map(([, texto, clase]) => elemento("span", texto, "mult " + clase)));
$("abrir-analisis").addEventListener("click", () => abrirAnalisis());
$("cerrar-analisis").addEventListener("click", () => $("analisis").close());
document.querySelectorAll("#analisis .pestana").forEach((p) =>
  p.addEventListener("click", () => verVistaAnalisis(p.dataset.vista)));
// La columna bajo el ratón se resalta
$("analisis-tabla").addEventListener("mouseover", (evento) => {
  const columna = evento.target.closest("[data-columna]")?.dataset.columna;
  document.querySelectorAll("#analisis-tabla td").forEach((td) => td.classList.toggle("cruz", !!columna && td.dataset.columna === columna));
});
$("analisis-tabla").addEventListener("mouseleave", () =>
  document.querySelectorAll("#analisis-tabla td.cruz").forEach((td) => td.classList.remove("cruz")));

// ---------- Equipo recomendado (fase 1: con lo que hay hoy) ----------
// Prueba todas las combinaciones de 6 de los vivos y puntúa fuerza, cobertura de tipos y defensa compartida.
// Usa solo lo registrado (estadísticas, tipos, habilidad y ataques): no supone nada futuro, que con aleatorizado no sirve.
const ESTILOS_EQUIPO = {
  equilibrado: { fuerza: 3, cobertura: 2, defensa: 1.5, ataque: 0.45, aguante: 0.40, velocidad: 0.15,
    explica: "Busca a los más fuertes, que golpeen a muchos tipos y sin debilidades compartidas." },
  ofensivo: { fuerza: 4, cobertura: 2.5, defensa: 0.75, ataque: 0.65, aguante: 0.15, velocidad: 0.20,
    explica: "Prioriza pegar fuerte y rápido; acepta más debilidades compartidas." },
  defensivo: { fuerza: 2.5, cobertura: 1, defensa: 3, ataque: 0.25, aguante: 0.65, velocidad: 0.10,
    explica: "Prioriza aguantar y que pocos tipos dañen a varios a la vez." },
};
// Habilidades que cambian lo que le hace cada tipo de ataque (por su nombre en español, como se guarda en la ficha)
const HABILIDADES_DEFENSA = {
  "Levitación": { inmune: ["ground"] }, "Geofagia": { inmune: ["ground"] },
  "Absorbe Electricidad": { inmune: ["electric"] }, "Pararrayos": { inmune: ["electric"] }, "Electromotor": { inmune: ["electric"] },
  "Absorbe Agua": { inmune: ["water"] }, "Colector": { inmune: ["water"] }, "Piel Seca": { inmune: ["water"], factor: { fire: 1.25 } },
  "Absorbe Fuego": { inmune: ["fire"] }, "Cuerpo Horneado": { inmune: ["fire"] }, "Herbívoro": { inmune: ["grass"] },
  "Sebo": { factor: { fire: 0.5, ice: 0.5 } }, "Ignífugo": { factor: { fire: 0.5 } }, "Pompa": { factor: { fire: 0.5 } },
  "Sal Purificadora": { factor: { ghost: 0.5 } }, "Peluche": { factor: { fire: 2 } },
  "Filtro": { supereficaz: 0.75 }, "Roca Sólida": { supereficaz: 0.75 }, "Armadura Prisma": { supereficaz: 0.75 },
  "Superguarda": { soloSupereficaz: true },
};
let estiloEquipo = "equilibrado";
let candidatosEquipo = [];       // los vivos con sus datos de hoy
const fijadosEquipo = new Set(); // capture_id que van sí o sí
let equipoPropuesto = [];        // capture_id del equipo recomendado, para «Aplicar»

function multTipos(ataque, tipos) {
  return tipos.reduce((m, t) => m * tablaTipos.factors[ataque][t], 1);
}
function recibeDano(ataque, p) {
  let m = multTipos(ataque, p.tipos);
  const h = HABILIDADES_DEFENSA[p.habilidad];
  if (!h) return m;
  if (h.inmune?.includes(ataque)) return 0;
  if (h.factor?.[ataque]) m *= h.factor[ataque];
  if (h.supereficaz && m > 1) m *= h.supereficaz;
  if (h.soloSupereficaz && m <= 1) return 0;
  return m;
}
function ataquesConDano(p) {
  const lista = p.moves.map(datosDeAtaque).filter(haceDano).map((a) => ({ type: a.type, category: a.category, power: a.power || 60 }));
  if (lista.length) return { lista, supuestos: false };
  // Sin ataques de daño registrados: se supone uno de 60 de cada tipo propio
  const categoria = p.st.attack >= p.st.sp_attack ? "physical" : "special";
  return { lista: p.tipos.map((t) => ({ type: t, category: categoria, power: 60 })), supuestos: true };
}
function danoContra(p, a, defensores) {
  const stab = p.tipos.includes(a.type) ? 1.5 : 1;
  return a.power * stab * multTipos(a.type, defensores) * (a.category === "physical" ? p.st.attack : p.st.sp_attack);
}
const golpeaFuerte = (p, defensores) => p.atq.lista.some((a) => multTipos(a.type, defensores) >= 2);

function fuerzaIndividual(p, maximos) {
  const w = ESTILOS_EQUIPO[estiloEquipo];
  return w.ataque * p.f.ataque / maximos.ataque + w.aguante * p.f.aguante / maximos.aguante + w.velocidad * p.f.velocidad / maximos.velocidad;
}

// Puntos de un grupo, de 0 a 100, con sus partes de 0 a 1 para el desglose
function puntuarEquipo(grupo, contexto) {
  const w = ESTILOS_EQUIPO[estiloEquipo];
  const fuerza = grupo.reduce((s, p) => s + fuerzaIndividual(p, contexto.maximos), 0) / grupo.length;
  const cubiertos = contexto.objetivos.filter((d) => grupo.some((p) => golpeaFuerte(p, d))).length;
  let penalizacion = 0;
  const peligros = [];
  for (const a of contexto.atacantes) {
    const v = grupo.map((p) => recibeDano(a, p));
    const debiles = v.filter((x) => x > 1).length, resisten = v.filter((x) => x < 1).length;
    penalizacion += Math.max(0, debiles - resisten) + (debiles >= 3 && !resisten ? 1 : 0);
    if (debiles >= 2 && !resisten) peligros.push(a);
  }
  const partes = {
    fuerza, cobertura: cubiertos / contexto.objetivos.length,
    defensa: Math.max(0, 1 - penalizacion / contexto.atacantes.length / 2),
  };
  const total = 100 * (w.fuerza * partes.fuerza + w.cobertura * partes.cobertura + w.defensa * partes.defensa)
    / (w.fuerza + w.cobertura + w.defensa);
  return { ...partes, total, cubiertos, peligros };
}

function combinacionesDe(lista, k, desde = 0, actual = [], salida = []) {
  if (actual.length === k) {
    salida.push([...actual]);
    return salida;
  }
  for (let i = desde; i < lista.length; i++) {
    actual.push(lista[i]);
    combinacionesDe(lista, k, i + 1, actual, salida);
    actual.pop();
  }
  return salida;
}

function calcularRecomendado() {
  const contra = $("rec-contra").value;
  const todosLosTipos = tablaTipos.types.map((t) => t.identifier);
  const objetivos = contra ? [[contra]] : todosLosTipos.map((t) => [t]);
  const ps = candidatosEquipo.map((c) => {
    const p = { ...c };
    p.atq = ataquesConDano(p);
    const ataque = objetivos.reduce((s, d) => s + Math.max(...p.atq.lista.map((a) => danoContra(p, a, d))), 0) / objetivos.length;
    p.f = { ataque, aguante: p.st.hp * (p.st.defense + p.st.sp_defense) / 2, velocidad: p.st.speed };
    return p;
  });
  const maximos = {
    ataque: Math.max(1, ...ps.map((p) => p.f.ataque)), aguante: Math.max(1, ...ps.map((p) => p.f.aguante)),
    velocidad: Math.max(1, ...ps.map((p) => p.f.velocidad)),
  };
  const contexto = { objetivos, atacantes: contra ? [contra] : todosLosTipos, maximos };
  let mejor = null;
  for (const grupo of combinacionesDe(ps, Math.min(6, ps.length))) {
    if ([...fijadosEquipo].some((id) => !grupo.some((p) => p.capture_id === id))) continue; // los fijados van sí o sí
    const puntos = puntuarEquipo(grupo, contexto);
    if (!mejor || puntos.total > mejor.puntos.total) mejor = { grupo, puntos };
  }
  const idsActual = equipoActual.filter((p) => p.alive).map((p) => p.capture_id);
  const actual = ps.filter((p) => idsActual.includes(p.capture_id));
  return {
    equipo: mejor.grupo, puntos: mejor.puntos, actual, idsActual,
    puntosActual: actual.length ? puntuarEquipo(actual, contexto) : null,
    todos: ps, objetivos, ranking: [...ps].sort((a, b) => fuerzaIndividual(b, maximos) - fuerzaIndividual(a, maximos)),
  };
}

const nombreDeTipo = (id) => tablaTipos.types.find((t) => t.identifier === id).name;
const enumerar = (xs) => (xs.length <= 2 ? xs.join(" y ") : xs.slice(0, -1).join(", ") + " y " + xs.at(-1));

function motivosRecomendado(p, r) {
  const otros = r.equipo.filter((q) => q !== p);
  const salida = [];
  if (fijadosEquipo.has(p.capture_id)) salida.push("Fijado por ti.");
  const solo = r.objetivos.filter((d) => golpeaFuerte(p, d) && !otros.some((q) => golpeaFuerte(q, d)));
  if (solo.length) salida.push(`Único que golpea fuerte a ${enumerar(solo.slice(0, 4).map((d) => nombreDeTipo(d[0])))}.`);
  const porHabilidad = (HABILIDADES_DEFENSA[p.habilidad]?.inmune || []).filter((a) => multTipos(a, p.tipos) > 0);
  if (porHabilidad.length) salida.push(`Inmune a ${enumerar(porHabilidad.map(nombreDeTipo))} por ${p.habilidad}.`);
  const resiste = tablaTipos.types.map((t) => t.identifier).filter((a) => recibeDano(a, p) < 1 && !otros.some((q) => recibeDano(a, q) < 1));
  if (resiste.length) salida.push(`Único que resiste ${enumerar(resiste.slice(0, 3).map(nombreDeTipo))}.`);
  const puesto = r.ranking.indexOf(p) + 1;
  if (puesto <= 2) salida.push(puesto === 1 ? "El más fuerte de tus Pokémon." : "Segundo más fuerte de tus Pokémon.");
  if (p.atq.supuestos) salida.push("Sin ataques de daño registrados: se supone uno de su tipo.");
  return (salida.length ? salida : ["Equilibra el equipo."]).slice(0, 3);
}

function botonFijar(p) {
  const fijado = fijadosEquipo.has(p.capture_id);
  const b = elemento("button", "📌", "rec-fijar" + (fijado ? " activa" : ""));
  b.type = "button";
  b.title = fijado ? "Quitar fijado" : "Fijar: llevarlo sí o sí";
  b.setAttribute("aria-label", `${b.title}: ${p.nick}`);
  b.setAttribute("aria-pressed", String(fijado));
  b.disabled = !fijado && fijadosEquipo.size >= 6;
  b.addEventListener("click", () => {
    if (fijado) fijadosEquipo.delete(p.capture_id);
    else fijadosEquipo.add(p.capture_id);
    pintarRecomendado();
  });
  return b;
}

function filaDesglose(nombre, s) {
  const fila = elemento("tr");
  fila.append(elemento("td", nombre), ...[s.fuerza, s.cobertura, s.defensa].map((x) => elemento("td", String(Math.round(x * 100)))),
    elemento("td", String(Math.round(s.total))));
  return fila;
}

function pintarRecomendado() {
  document.querySelectorAll("#recomendado [data-estilo]").forEach((b) => b.classList.toggle("activa", b.dataset.estilo === estiloEquipo));
  $("rec-explica").textContent = ESTILOS_EQUIPO[estiloEquipo].explica;
  $("rec-vacio").hidden = candidatosEquipo.length > 0;
  $("rec-datos").hidden = !candidatosEquipo.length;
  if (!candidatosEquipo.length) return;

  const r = calcularRecomendado();
  equipoPropuesto = r.equipo.map((p) => p.capture_id);
  $("rec-equipo").replaceChildren(...r.equipo.map((p) => {
    const caja = elemento("div", undefined, "rec-miembro");
    const texto = elemento("div");
    const nombre = elemento("b", p.nick);
    if (r.idsActual.includes(p.capture_id)) nombre.append(elemento("span", "ya en tu equipo", "rec-etiqueta"));
    texto.append(nombre, elemento("div", `${p.especieNombre} · nivel ${p.nivel}`, "rec-especie"),
      ...motivosRecomendado(p, r).map((m) => elemento("p", m, "rec-motivo")));
    caja.append(figura(p.species_id, false, 56, 1, true, p.shiny), texto, botonFijar(p));
    return caja;
  }));

  const contra = $("rec-contra").value;
  $("rec-resumen").replaceChildren(
    elemento("span", contra ? `${r.puntos.cubiertos ? "Alguien" : "Nadie"} le hace ×2 a ${nombreDeTipo(contra)}` : `×2 contra ${r.puntos.cubiertos} de 18 tipos`),
    elemento("span", r.puntos.peligros.length ? `Cuidado con: ${enumerar(r.puntos.peligros.map(nombreDeTipo))}` : "Sin debilidades compartidas graves")
  );

  const igual = r.actual.length === r.equipo.length && r.equipo.every((p) => r.idsActual.includes(p.capture_id));
  const comparar = [elemento("strong", `${Math.round(r.puntos.total)} / 100`)];
  if (igual) {
    comparar.push(elemento("span", "Es tu equipo actual: no hace falta cambiar nada.", "rec-mejora"));
  } else if (r.puntosActual) {
    const entran = r.equipo.filter((p) => !r.idsActual.includes(p.capture_id)).map((p) => p.nick);
    const salen = r.actual.filter((p) => !r.equipo.includes(p)).map((p) => p.nick);
    const diferencia = Math.round(r.puntos.total - r.puntosActual.total);
    const cambio = [entran.length ? "entra " + enumerar(entran) : "", salen.length ? "sale " + enumerar(salen) : ""].filter(Boolean).join(", ");
    comparar.push(elemento("span", `Tu equipo actual: ${Math.round(r.puntosActual.total)}`, "pista"),
      elemento("span", `Cambio: ${cambio}` + (diferencia >= 1 ? ` (+${diferencia})` : " (mejora muy poco)"), "rec-mejora"));
  } else {
    comparar.push(elemento("span", "Ahora no tienes equipo: «Aplicar» lo forma con estos.", "pista"));
  }
  $("rec-comparar").replaceChildren(...comparar);

  const cabecera = elemento("tr");
  cabecera.append(...["", "Fuerza", "Cobertura", "Defensa", "Total"].map((t) => elemento("th", t)));
  $("rec-desglose").replaceChildren(cabecera, filaDesglose("Recomendado", r.puntos),
    ...(r.puntosActual && !igual ? [filaDesglose("Tu equipo actual", r.puntosActual)] : []));
  $("aplicar-recomendado").disabled = igual;

  const fuera = r.todos.filter((p) => !r.equipo.includes(p));
  $("rec-zona-fuera").hidden = !fuera.length;
  $("rec-fuera").replaceChildren(...fuera.map((p) => {
    const fila = elemento("div");
    const texto = elemento("p");
    const flojo = r.ranking.indexOf(p) >= r.todos.length - 2;
    texto.append(elemento("b", p.nick + " "), elemento("span", flojo ? `De los más flojos ahora (nivel ${p.nivel}).` : "Aporta poco que no cubran los demás."));
    fila.append(figura(p.species_id, false, 40, 1, true, p.shiny), texto, botonFijar(p));
    return fila;
  }));
}

async function abrirRecomendado() {
  mostrarMensaje("");
  $("error-recomendado").textContent = "";
  let fichas;
  try {
    await Promise.all([cargarTablaTipos(), cargarCatalogos(), cargarDatosEvolucion(), cargarNaturalezas()]);
    await cargarAtaquesPartida();
    fichas = await Promise.all(vivosActual.map((p) => pedir(`/runs/${runActual}/captures/${p.capture_id}/sheet`)));
  } catch (error) {
    mostrarMensaje(error.message);
    return;
  }
  candidatosEquipo = vivosActual.map((p, i) => {
    const f = fichas[i];
    const especie = datosEvolucion?.[p.species_id];
    const nivel = f.level || 5;
    const n = naturalezas.find((x) => x.name === f.nature);
    const porNaturaleza = (campo) => {
      if (!n || n.increased === n.decreased) return 100;
      if (CAMPO_ESTADISTICA[n.increased] === campo) return 110;
      return CAMPO_ESTADISTICA[n.decreased] === campo ? 90 : 100;
    };
    // Lo que falte en la ficha se estima con la base de la especie y un IV medio
    const estimada = (campo) => {
      const q = 2 * (especie?.bases[campo] ?? 70) + 15;
      const interior = Math.floor(q * nivel / 100);
      return campo === "hp" ? interior + nivel + 10 : Math.floor((interior + 5) * porNaturaleza(campo) / 100);
    };
    return {
      capture_id: p.capture_id, species_id: p.species_id, shiny: p.shiny, nick: p.nickname || p.species,
      especieNombre: p.species, nivel, habilidad: f.ability, moves: f.moves || [],
      tipos: (p.types || []).map((t) => t.identifier),
      st: Object.fromEntries(ESTADISTICAS.map((campo) => [campo, f[campo] || estimada(campo)])),
    };
  }).filter((c) => c.tipos.length);
  fijadosEquipo.clear();
  if (!$("rec-contra").options[1]) $("rec-contra").append(...tablaTipos.types.map((t) => new Option(t.name, t.identifier)));
  $("rec-contra").value = "";
  const notas = ["Usa lo que tienes registrado hoy: estadísticas, tipos, habilidad y ataques."];
  if (reglasPartida.aleatorio_habilidades || reglasPartida.aleatorio_ataques) notas.push("Con habilidades o ataques aleatorios no se supone nada futuro.");
  if (muerteDefinitiva()) notas.push("Los muertos no cuentan.");
  $("rec-nota").textContent = notas.join(" ");
  pintarRecomendado();
  $("recomendado").scrollTop = 0;
  $("recomendado").showModal();
}

// Aplica el equipo: los que ya estaban mantienen su orden y los nuevos van detrás
async function aplicarRecomendado() {
  const anteriores = equipoActual.filter((p) => p.alive).map((p) => p.capture_id);
  const orden = [...anteriores.filter((id) => equipoPropuesto.includes(id)), ...equipoPropuesto.filter((id) => !anteriores.includes(id))];
  $("aplicar-recomendado").disabled = true;
  if (await guardarEquipo(orden)) {
    $("recomendado").close();
    mostrarMensaje("Equipo cambiado por el recomendado.");
  } else {
    $("error-recomendado").textContent = $("mensaje").textContent;
    $("aplicar-recomendado").disabled = false;
  }
}

$("abrir-recomendado").addEventListener("click", abrirRecomendado);
$("cerrar-recomendado").addEventListener("click", () => $("recomendado").close());
$("aplicar-recomendado").addEventListener("click", aplicarRecomendado);
$("rec-contra").addEventListener("change", pintarRecomendado);
document.querySelectorAll("#recomendado [data-estilo]").forEach((b) => b.addEventListener("click", () => {
  estiloEquipo = b.dataset.estilo;
  pintarRecomendado();
}));

// ---------- Editar partida: renombrar o eliminar ----------
// Se abre desde la barra de una partida o desde su tarjeta en la portada
let partidaEditada = null; // { id, name }

function abrirEditarPartida(id, name) {
  partidaEditada = { id, name };
  $("nuevo-nombre").value = name;
  $("error-partida").textContent = "";
  $("dialogo-partida").showModal();
}

$("editar-partida").addEventListener("click", () => abrirEditarPartida(runActual, nombrePartida));

$("cancelar-partida").addEventListener("click", () => $("dialogo-partida").close());

$("form-partida").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const nombre = $("nuevo-nombre").value.trim();
  $("error-partida").textContent = nombre ? "" : "Escribe un nombre.";
  if (!nombre) return;
  try {
    const run = await pedir(`/runs/${partidaEditada.id}`, { ...enviarJSON({ name: nombre }), method: "PATCH" });
    $("dialogo-partida").close();
    if (runActual === run.id) {
      nombrePartida = run.name;
      $("titulo-partida").textContent = run.name;
    } else {
      await mostrarInicio();
    }
  } catch (error) {
    $("error-partida").textContent = error.message;
  }
});

$("eliminar-partida").addEventListener("click", async () => {
  if (!await confirmar("¿Eliminar la partida?",
      `Vas a eliminar «${partidaEditada.name}» con todos sus Pokémon, fichas y muertes. No se puede deshacer.`,
      "Eliminar partida")) return;
  $("error-partida").textContent = "";
  try {
    await pedir(`/runs/${partidaEditada.id}`, { method: "DELETE" });
    $("dialogo-partida").close();
    if (runActual === null) await mostrarInicio();
    else location.hash = "#/";
  } catch (error) {
    $("error-partida").textContent = error.message;
  }
});

// ---------- Nuevo encuentro (ventana) ----------
// ---------- Buscar ruta: qué se capturó en ella, su estado y los fallos ----------
// Sale todo lo de cada ruta, sin mirar las reglas: según la partida y sus cláusulas puede haber más de un Pokémon.
let encuentrosActual = []; // capturas y fallos de la partida abierta

const claveRuta = (texto) => texto.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();

function encuentrosPorRuta() {
  const rutas = new Map();
  for (const e of encuentrosActual) {
    const clave = claveRuta(e.route);
    if (!rutas.has(clave)) rutas.set(clave, { clave, nombre: e.route, encuentros: [] });
    rutas.get(clave).encuentros.push(e);
  }
  return [...rutas.values()];
}

function filaEncuentro(e) {
  if (e.event_type === "fallo") {
    const fila = elemento("li", undefined, "fila");
    const texto = elemento("div", undefined, "texto");
    texto.append(elemento("div", e.species, "esp"));
    fila.append(texto, elemento("span", "Fallo", "estado-ruta e-fallo"), figura(e.species_id, false, 48, 1, true));
    return fila;
  }
  const vivo = vivosActual.find((p) => p.capture_id === e.id);
  const p = vivo ?? muertosActual.find((q) => q.capture_id === e.id);
  const elegir = elemento("button", undefined, "fila");
  elegir.type = "button";
  const texto = elemento("div", undefined, "texto");
  texto.append(elemento("div", e.nickname || "Sin mote", "mote"), elemento("div", e.species, "esp"));
  const estado = vivo ? "Vivo" : muerteDefinitiva() ? "Muerto" : "Debilitado";
  elegir.append(texto, elemento("span", estado, "estado-ruta " + (vivo ? "e-vivo" : "e-caido")), figura(e.species_id, !vivo, 48, 1, true, p?.shiny));
  if (p) {
    elegir.addEventListener("click", () => {
      $("dialogo-rutas").close();
      abrirFicha(p, !!vivo);
    });
  }
  const li = elemento("li");
  li.append(elegir);
  return li;
}

function pintarRutas() {
  const texto = $("buscar-ruta").value.trim();
  const buscado = claveRuta(texto);
  // La ruta exacta, primero: al buscar «Ruta 1» no debe quedar por debajo de «Ruta 10»
  const rutas = encuentrosPorRuta()
    .filter((r) => r.clave.includes(buscado))
    .sort((a, b) => (b.clave === buscado) - (a.clave === buscado) || a.nombre.localeCompare(b.nombre, "es", { numeric: true }));
  if (!rutas.length) {
    $("resultado-rutas").replaceChildren(elemento("p", texto ? `No has capturado nada en «${texto}».` : "Todavía no has registrado ningún encuentro.", "vacio"));
    return;
  }
  $("resultado-rutas").replaceChildren(...rutas.flatMap((r) => {
    const lista = elemento("ul", undefined, "lista");
    lista.append(...r.encuentros.map(filaEncuentro));
    return [elemento("h4", r.nombre), lista];
  }));
}

$("abrir-rutas").addEventListener("click", () => {
  $("buscar-ruta").value = "";
  pintarRutas();
  $("dialogo-rutas").showModal();
  $("buscar-ruta").focus();
});
$("buscar-ruta").addEventListener("input", pintarRutas);
$("cerrar-rutas").addEventListener("click", () => $("dialogo-rutas").close());

// Nuevo encuentro: captura o fallo (la muerte se marca desde la ficha del Pokémon).
// El mote y la casilla de variocolor solo tienen sentido en una captura; lo demás depende de las reglas de la partida.
let capturasActual = []; // lo que ya se ha capturado en esta partida
let capturaEnCorreccion = null; // id de la captura que se corrige; null al registrar un encuentro nuevo
let correccionSinMote = false;  // la captura corregida no tenía mote (llegó así del guardado): no se obliga a ponerlo

function ajustarFormularioEvento() {
  const captura = $("tipo-evento").value === "captura";
  const moteObligatorio = captura && "motes_obligatorios" in reglasPartida && !(capturaEnCorreccion !== null && correccionSinMote);
  $("campo-mote").hidden = !captura;
  $("mote").required = moteObligatorio;
  $("mote-opcional").hidden = moteObligatorio;
  $("campo-variocolor").hidden = !(captura && "clausula_variocolor" in reglasPartida);
  if ($("campo-variocolor").hidden && capturaEnCorreccion === null) $("variocolor").checked = false;
  avisarDuplicado();
}

// Cláusula de duplicados: la web avisa y no rechaza, porque el jugador puede querer repetir especie
function avisarDuplicado() {
  const especie = $("especie").value.trim().toLowerCase();
  const repetida = $("tipo-evento").value === "captura" && "clausula_duplicados" in reglasPartida
    && capturasActual.find((c) => c.species.toLowerCase() === especie && c.id !== capturaEnCorreccion);
  $("aviso-evento").textContent = repetida
    ? `Ya capturaste un ${repetida.species} en ${repetida.route}. La cláusula de duplicados te permite ignorar este encuentro y buscar otra especie.`
    : "";
}

$("especie").addEventListener("input", avisarDuplicado);

function abrirVentanaEvento(titulo, captureId) {
  capturaEnCorreccion = captureId;
  $("titulo-evento").textContent = titulo;
  $("campo-tipo").hidden = captureId !== null; // una captura corregida sigue siendo una captura
  $("error-evento").textContent = "";
  ajustarFormularioEvento();
  $("dialogo-evento").showModal();
  $("ruta").focus();
}

$("abrir-registro").addEventListener("click", () => {
  $("form-evento").reset();
  abrirVentanaEvento("Nuevo encuentro", null);
});

function abrirCorreccion(p) {
  $("form-evento").reset();
  $("tipo-evento").value = "captura";
  $("ruta").value = p.route;
  $("especie").value = p.species;
  $("mote").value = p.nickname || "";
  correccionSinMote = !p.nickname;
  $("variocolor").checked = !!p.shiny;
  abrirVentanaEvento("Corregir datos", p.capture_id);
}

$("tipo-evento").addEventListener("change", ajustarFormularioEvento);

$("cancelar-evento").addEventListener("click", () => {
  volverAFicha = true; // cancelar es ir atrás, como Esc
  $("dialogo-evento").close();
});

$("form-evento").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  $("error-evento").textContent = "";
  volverAFicha = false; // Esc pudo cerrar solo la lista de sugerencias: guardar no vuelve atrás
  // Si la ruta ya existe con otras mayúsculas o acentos, se guarda como estaba: no debe contar como otra ruta
  const ruta = encuentrosPorRuta().find((r) => r.clave === claveRuta($("ruta").value))?.nombre ?? $("ruta").value;
  const datos = { event_type: $("tipo-evento").value, route: ruta, species: $("especie").value };
  const mote = $("mote").value.trim();
  if (datos.event_type === "captura" && mote) datos.nickname = mote;
  if ($("variocolor").checked) datos.shiny = true;
  try {
    let nueva = null;
    if (capturaEnCorreccion === null) {
      nueva = await pedir(`/runs/${runActual}/events`, enviarJSON(datos));
    } else {
      await pedir(`/runs/${runActual}/captures/${capturaEnCorreccion}`, { ...enviarJSON(datos), method: "PUT" });
    }
    const origen = capturaEnCorreccion === null ? null : origenFicha;
    // Tras recargar, las listas son otras: se recuerda de cuál venía para buscar sus datos nuevos
    const lista = origen && (origen.lista === equipoActual ? () => equipoActual
      : origen.lista === vivosActual ? () => vivosActual : () => muertosActual);
    const corregida = capturaEnCorreccion;
    $("dialogo-evento").close();
    await cargarRun();
    if (origen) {
      const actualizada = lista().find((q) => q.capture_id === corregida);
      if (actualizada) abrirFicha(actualizada, origen.vivo, lista());
    }
    // Una captura nueva lleva directamente a rellenar su ficha
    const capturado = nueva?.event_type === "captura" && vivosActual.find((q) => q.capture_id === nueva.id);
    if (capturado) {
      abrirFicha(capturado, true, vivosActual);
      $("f-nivel").focus();
    }
  } catch (error) {
    // El error se enseña dentro de la ventana, que sigue abierta para corregir el dato
    $("error-evento").textContent = error.message;
  }
});

// ---------- Cerrar ventanas ----------
// Esc y Cancelar van atrás: si se llegó desde la ficha, vuelven a ella. Pulsar fuera o la ✕ sale del todo.
let origenFicha = null;   // la ficha de la que se salió
let volverAFicha = false; // la ventana se está cerrando con Esc o Cancelar

// Al volver, la ficha se recarga: los cambios sin guardar se perderían
async function salirDeFicha(abrir) {
  if (!await fichaPuedeCerrarse()) return;
  origenFicha = { p: fichaActual, vivo: fichaActual.alive ?? fichaVivoLista, lista: fichaLista };
  $("ficha").close();
  abrir();
}

document.addEventListener("keydown", (evento) => {
  if (evento.key !== "Escape") return;
  // Se cierra a mano: el navegador puede agrupar esta ventana con la de debajo y cerrar las dos
  if ($("dialogo-confirmar").open) {
    evento.preventDefault();
    $("dialogo-confirmar").close();
    return;
  }
  if ($("dialogo-evolucion").open) {
    evento.preventDefault();
    $("dialogo-evolucion").close();
    return;
  }
  if (origenFicha) volverAFicha = true;
  // Se intercepta la tecla: el evento «cancel» de la ventana no siempre impide que se cierre
  if ($("ficha").open && fichaSinGuardar) {
    evento.preventDefault();
    cerrarFicha();
  }
});

for (const ventana of [$("analisis"), $("dialogo-evento")]) {
  ventana.addEventListener("close", () => {
    const origen = origenFicha;
    const volver = volverAFicha;
    origenFicha = null;
    volverAFicha = false;
    if (origen && volver) abrirFicha(origen.p, origen.vivo, origen.lista);
  });
}

// Pulsar fuera (en el fondo oscuro) cierra cualquier ventana. Se exige que la pulsación también empiece fuera,
// para que seleccionar texto y soltar el ratón fuera de la caja no la cierre.
for (const ventana of document.querySelectorAll("dialog")) {
  let empezoFuera = false;
  ventana.addEventListener("mousedown", (evento) => { empezoFuera = evento.target === ventana; });
  ventana.addEventListener("click", (evento) => {
    if (evento.target !== ventana || !empezoFuera) return;
    if (ventana === $("ficha")) cerrarFicha();
    else ventana.close();
  });
}

// ---------- Importar el guardado del juego ----------
// El archivo se envía al servidor, que lo lee sin ejecutar nada y devuelve una propuesta; aquí se marca qué aplicar
// y se envían solo esos cambios. Nada cambia hasta pulsar «Aplicar».
let propuestaImportacion = null;
let opcionesImportacion = []; // por cada casilla: { casilla, aplicar(cambios) }

function textoSinAcentos(texto) {
  return (texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function abrirImportacion() {
  propuestaImportacion = null;
  opcionesImportacion = [];
  $("archivo-guardado").value = "";
  $("estado-importar").textContent = "";
  $("error-importar").textContent = "";
  $("cambios-importar").replaceChildren();
  contarImportacion();
  pintarMapas();
  $("dialogo-importar").showModal();
}

$("abrir-importar").addEventListener("click", abrirImportacion);
$("cancelar-importar").addEventListener("click", () => $("dialogo-importar").close());

// ---------- Nombres de las rutas del juego (Data/MapInfos.rxdata) ----------
// El guardado solo dice el número de mapa de cada Pokémon. Con los nombres subidos una vez a la partida,
// los nuevos llegan al importar con su ruta puesta.
let mapasPartida = 0; // cuántos nombres de mapas tiene la partida abierta

function pintarMapas() {
  const zona = $("imp-mapas");
  const subir = boton(mapasPartida ? "Cambiar" : "Subir MapInfos.rxdata", "mini", () => $("archivo-mapas").click());
  if (mapasPartida) {
    zona.replaceChildren(
      elemento("span", `✓ Rutas del juego cargadas (${mapasPartida} mapas): los nuevos llegan con su ruta.`, "imp-mapas-ok"),
      subir, boton("Quitar", "mini", quitarMapas)
    );
    return;
  }
  const texto = elemento("span");
  texto.append("Para que los nuevos lleguen con su ruta, sube una vez ", elemento("code", "Data\\MapInfos.rxdata"),
    " de la carpeta del juego (donde está Game.exe).");
  zona.replaceChildren(texto, subir);
}

// Si ya hay un guardado leído, se vuelve a leer para que las rutas aparezcan en los nuevos
function releerGuardado() {
  if ($("archivo-guardado").files[0]) $("archivo-guardado").dispatchEvent(new Event("change"));
}

$("archivo-mapas").addEventListener("change", async () => {
  const archivo = $("archivo-mapas").files[0];
  $("archivo-mapas").value = "";
  if (!archivo) return;
  $("error-importar").textContent = "";
  try {
    const r = await pedir(`/runs/${runActual}/maps`, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: archivo,
    });
    mapasPartida = r.maps;
    pintarMapas();
    releerGuardado();
  } catch (error) {
    $("error-importar").textContent = error.message;
  }
});

async function quitarMapas() {
  $("error-importar").textContent = "";
  try {
    await pedir(`/runs/${runActual}/maps`, { method: "DELETE" });
    mapasPartida = 0;
    pintarMapas();
    releerGuardado();
  } catch (error) {
    $("error-importar").textContent = error.message;
  }
}

$("archivo-guardado").addEventListener("change", async () => {
  const archivo = $("archivo-guardado").files[0];
  if (!archivo) return;
  $("error-importar").textContent = "";
  $("cambios-importar").replaceChildren();
  opcionesImportacion = [];
  contarImportacion();
  $("estado-importar").textContent = "Leyendo el guardado…";
  try {
    propuestaImportacion = await pedir(`/runs/${runActual}/import/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: archivo,
    });
    pintarImportacion(propuestaImportacion);
  } catch (error) {
    $("estado-importar").textContent = "";
    $("error-importar").textContent = error.message;
  }
});

// Una línea con casilla: «Nivel   7 → 12»
function cambioImportacion(que, antes, despues, aplicar, marcado = true, clase = "") {
  const fila = elemento("label", undefined, "imp-cambio" + (clase ? " " + clase : ""));
  const casilla = elemento("input");
  casilla.type = "checkbox";
  casilla.checked = marcado;
  casilla.addEventListener("change", contarImportacion);
  const texto = elemento("span");
  if (antes !== null && antes !== undefined && antes !== "") texto.append(String(antes), elemento("span", " → ", "imp-flecha"));
  texto.append(String(despues));
  fila.append(casilla, elemento("span", que, "imp-que"), texto);
  opcionesImportacion.push({ casilla, aplicar });
  return fila;
}

function tarjetaImportacion(speciesId, nombre, detalle, filas) {
  const caja = elemento("div", undefined, "imp-poke");
  caja.append(speciesId ? miniatura(speciesId, false, 44) : elemento("span"));
  const texto = elemento("div");
  const titulo = elemento("div", nombre, "imp-nombre");
  if (detalle) titulo.append(elemento("small", detalle));
  texto.append(titulo, ...(filas.length ? filas : [elemento("div", "Sin cambios.", "imp-nada")]));
  caja.append(texto);
  return caja;
}

// IV y EV del guardado, solo si están completos (en el orden de ESTADISTICAS)
function genesDelJuego(p) {
  const completos = (x) => Array.isArray(x) && x.length === 6 && x.every((v) => Number.isInteger(v));
  return completos(p.iv) && completos(p.ev) ? { iv: p.iv, ev: p.ev } : null;
}

function mismosGenes(guardados, genes, nivel) {
  return !!guardados && guardados.level === nivel
    && ESTADISTICAS.every((e, i) => guardados.iv[e] === genes.iv[i] && guardados.ev[e] === genes.ev[i]);
}

function cambiosDePokemon(p, c, cambio) {
  const ficha = c.sheet;
  const filas = [];
  const poner = (campo, valor) => (cambios) => { cambio(cambios)[campo] = valor; };
  if (p.species_id && p.species_id !== c.species_id) filas.push(cambioImportacion("Especie", c.species, p.species, poner("species", p.species)));
  if (p.nickname && p.nickname !== c.nickname) filas.push(cambioImportacion("Mote", c.nickname || "sin mote", p.nickname, poner("nickname", p.nickname)));
  if (p.level !== ficha.level) filas.push(cambioImportacion("Nivel", ficha.level ?? "—", p.level, poner("level", p.level)));
  if (p.nature && p.nature !== ficha.nature) filas.push(cambioImportacion("Naturaleza", ficha.nature ?? "—", p.nature, poner("nature", p.nature)));
  if (p.ability && p.ability !== ficha.ability) filas.push(cambioImportacion("Habilidad", ficha.ability ?? "—", p.ability, poner("ability", p.ability)));
  if ((p.item || null) !== (ficha.item || null)) filas.push(cambioImportacion("Objeto", ficha.item ?? "ninguno", p.item ?? "ninguno", poner("item", p.item)));
  const antes = ficha.moves.map(textoSinAcentos), ahora = p.moves.map(textoSinAcentos);
  const entran = p.moves.filter((a) => !antes.includes(textoSinAcentos(a)));
  const salen = ficha.moves.filter((a) => !ahora.includes(textoSinAcentos(a)));
  if (entran.length || salen.length) {
    const texto = [entran.length ? "+ " + entran.join(", ") : "", salen.length ? "− " + salen.join(", ") : ""].filter(Boolean).join(" · ");
    filas.push(cambioImportacion("Ataques", null, texto, poner("moves", p.moves)));
  }
  const actuales = ESTADISTICAS.map((e) => ficha[e]);
  const juego = ESTADISTICAS.map((e) => p.stats[e]);
  if (actuales.some((v, i) => v !== juego[i])) {
    // Las estadísticas van con su nivel: son una lectura real de ese nivel
    filas.push(cambioImportacion("Estadísticas", actuales.map((v) => v ?? "—").join(" · "), juego.join(" · ") + " (exactas)",
      (cambios) => { Object.assign(cambio(cambios), { stats: p.stats, level: p.level }); }));
  }
  const genes = genesDelJuego(p);
  if (genes && !mismosGenes(ficha.iv_ev, genes, p.level)) {
    filas.push(cambioImportacion("IV y EV", ficha.iv_ev ? "otros" : "—", `IV ${genes.iv.join("/")} · EV ${genes.ev.join("/")}`,
      (cambios) => { Object.assign(cambio(cambios), { iv: genes.iv, ev: genes.ev, level: p.level }); }));
  }
  if (p.fainted && c.alive && propuestaImportacion.death_rule) {
    filas.push(cambioImportacion("¿Ha muerto?", null, "En el juego está debilitado y sin curar", (cambios) => {
      cambio(cambios).dead = true;
      cambios.muertos.add(p.game_id);
    }, false, "imp-aviso"));
  }
  if (!c.alive && !p.fainted) filas.push(elemento("div", "Está muerto en el tracker, pero en el juego tiene PS. No se cambia.", "imp-nada"));
  return filas;
}

function pintarImportacion(propuesta) {
  opcionesImportacion = [];
  const porId = new Map(propuesta.tracker.map((c) => [c.capture_id, c]));
  const emparejados = propuesta.pokemon.filter((p) => p.match);
  const nuevos = propuesta.pokemon.filter((p) => !p.match);
  const lugar = (p) => (p.place === "party" ? "en el equipo" : "en la caja");
  const POR = { id: "", nickname: "", species: " · emparejado por especie" };
  const bloques = [];

  bloques.push(elemento("h4", `Tus Pokémon (${emparejados.length})`, "imp-titulo"));
  for (const p of emparejados) {
    const c = porId.get(p.match.capture_id);
    // El identificador del juego se guarda siempre, para emparejarlo sin dudas la próxima vez
    const cambio = (cambios) => {
      let u = cambios.updates.find((x) => x.capture_id === c.capture_id);
      if (!u) cambios.updates.push(u = { capture_id: c.capture_id, game_id: p.game_id });
      return u;
    };
    opcionesImportacion.push({ casilla: null, aplicar: (cambios) => { cambio(cambios); } });
    const detalle = lugar(p) + POR[p.match.by] + (c.alive ? "" : " · muerto en el tracker");
    bloques.push(tarjetaImportacion(p.species_id || c.species_id, p.nickname || p.species, detalle, cambiosDePokemon(p, c, cambio)));
  }

  if (nuevos.length) {
    bloques.push(elemento("h4", `Nuevos (${nuevos.length})`, "imp-titulo"));
    for (const p of nuevos) {
      if (!p.species_id) {
        bloques.push(tarjetaImportacion(null, p.nickname || p.species, lugar(p),
          [elemento("div", `La especie «${p.species}» no está en la lista: no se puede añadir.`, "imp-nada")]));
        continue;
      }
      const ruta = elemento("input", undefined, "imp-ruta");
      ruta.value = p.suggested_route || "";
      ruta.placeholder = "¿En qué ruta?";
      ruta.maxLength = 100;
      ruta.setAttribute("list", "lista-rutas");
      const fila = cambioImportacion("Añadir", null, `${p.species}, nivel ${p.level}`, (cambios) => {
        cambios.new.push({
          game_id: p.game_id, species: p.species, nickname: p.nickname, shiny: p.shiny, route: ruta.value.trim(),
          level: p.level, nature: p.nature, ability: p.ability, item: p.item, moves: p.moves, stats: p.stats,
          ...(genesDelJuego(p) ?? {}),
        });
      });
      fila.append(ruta);
      bloques.push(tarjetaImportacion(p.species_id, p.nickname || p.species, lugar(p), [fila]));
    }
  }

  const faltan = propuesta.missing.map((id) => porId.get(id)).filter((c) => c.alive);
  if (faltan.length) {
    bloques.push(elemento("h4", `No están en el guardado (${faltan.length})`, "imp-titulo"));
    for (const c of faltan) {
      bloques.push(tarjetaImportacion(c.species_id, c.nickname || c.species, c.route,
        [elemento("div", "No se cambia nada. ¿Lo liberaste o lo intercambiaste?", "imp-nada")]));
    }
  }

  // El equipo, en el orden del juego. Solo cuentan los que existirán tras importar y no se marcan como muertos.
  const nombreJuego = (id) => { const p = propuesta.pokemon.find((x) => x.game_id === id); return p.nickname || p.species; };
  const nombreActual = (id) => { const c = porId.get(id); return c.nickname || c.species; };
  const iguales = propuesta.party.game.length === propuesta.party.current.length && propuesta.party.game.every((id, i) => {
    const p = propuesta.pokemon.find((x) => x.game_id === id);
    return p.match?.capture_id === propuesta.party.current[i];
  });
  bloques.push(elemento("h4", "Equipo", "imp-titulo"));
  if (propuesta.party.game.length && !iguales) {
    bloques.push(cambioImportacion("Equipo", propuesta.party.current.map(nombreActual).join(", ") || "vacío",
      propuesta.party.game.map(nombreJuego).join(", "), (cambios) => { cambios.equipo = true; }));
  } else bloques.push(elemento("div", "El mismo que en el tracker.", "imp-nada"));

  if (propuesta.bag.length) {
    bloques.push(elemento("h4", "Mochila", "imp-titulo"));
    const muestra = propuesta.bag.slice(0, 4).map((o) => `${o.item} ×${o.count}`).join(", ");
    bloques.push(elemento("div", `${propuesta.bag.length} objetos leídos (${muestra}…). Se podrán importar cuando exista la mochila.`, "imp-nada"));
  }
  const avisos = [];
  if (propuesta.untranslated.length) avisos.push(`Sin traducir (propios del juego): ${propuesta.untranslated.join(", ")}.`);
  if (propuesta.discarded) avisos.push(`${propuesta.discarded} Pokémon del guardado tenían datos fuera de rango y se han descartado.`);
  if (avisos.length) bloques.push(elemento("p", avisos.join(" "), "aviso-analisis"));

  $("cambios-importar").replaceChildren(...bloques);
  const hayCambios = opcionesImportacion.some((o) => o.casilla);
  $("estado-importar").textContent = `${propuesta.pokemon.filter((p) => p.place === "party").length} en el equipo y `
    + `${propuesta.pokemon.filter((p) => p.place === "box").length} en cajas. `
    + (hayCambios ? "Marca solo lo que quieras aplicar." : "✓ Todo coincide con el tracker: no hay nada que aplicar.");
  contarImportacion();
}

function contarImportacion() {
  const n = opcionesImportacion.filter((o) => o.casilla?.checked).length;
  $("aplicar-importar").textContent = n ? `Aplicar ${n} ${n === 1 ? "cambio" : "cambios"}` : "Aplicar cambios";
  $("aplicar-importar").disabled = !propuestaImportacion || !n;
}

$("aplicar-importar").addEventListener("click", async () => {
  const cambios = { updates: [], new: [], muertos: new Set(), equipo: false };
  for (const o of opcionesImportacion) if (!o.casilla || o.casilla.checked) o.aplicar(cambios);
  if (cambios.new.some((n) => !n.route)) {
    $("error-importar").textContent = "Escribe la ruta de los Pokémon nuevos que vas a añadir.";
    return;
  }
  const datos = { updates: cambios.updates, new: cambios.new };
  if (cambios.equipo) {
    const existiran = new Set([
      // Un muerto del tracker solo puede seguir en el equipo si ya estaba
      ...propuestaImportacion.pokemon.filter((p) => p.match && (
        propuestaImportacion.tracker.find((c) => c.capture_id === p.match.capture_id).alive
        || propuestaImportacion.party.current.includes(p.match.capture_id))).map((p) => p.game_id),
      ...cambios.new.map((n) => n.game_id),
    ]);
    datos.party = propuestaImportacion.party.game.filter((id) => existiran.has(id) && !cambios.muertos.has(id));
  }
  $("error-importar").textContent = "";
  $("aplicar-importar").disabled = true;
  try {
    await pedir(`/runs/${runActual}/import/apply`, enviarJSON(datos));
    $("dialogo-importar").close();
    await cargarRun();
    mostrarMensaje("Guardado importado.");
  } catch (error) {
    $("error-importar").textContent = error.message;
    contarImportacion();
  }
});

// Arranque: al final, cuando ya están declaradas todas las variables que usa
navegar();
