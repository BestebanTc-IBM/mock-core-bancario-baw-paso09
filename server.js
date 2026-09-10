/**
 * mock-core-bancario — Paso 09 · Desembolso
 * PoC BOAT Banesco · CrediCarro
 *
 * Simula el Core bancario IBM i/AS400 para el Paso 09.
 * Una sola transacción atómica:
 *   1. Abona el crédito en la cuenta del cliente
 *   2. Debita al cliente y deposita en la cuenta del concesionario
 *   3. Genera el Comprobante Electrónico de Transferencia + Plan de Pagos
 *
 * BAW Task: Task_09_Desembolso (serviceTask)
 *
 * Inputs  (SIPOC Paso 09 — v1.1.2):
 *   firmas.firmaClienteOk              Boolean — guarda de entrada (v1.1.0)
 *   firmas.firmaBancoOk                Boolean — guarda de entrada (v1.1.0)
 *   firmas.firmaConcesionarioOk        Boolean — guarda de entrada
 *   polizas.pagoPolizasOk              Boolean — guarda de entrada
 *   credito.montoFinanciable           Decimal
 *   cliente.cedulaIdentidad            Integer  — solo dígitos (v1.1.1)
 *   cliente.cuentaCliente              String
 *   vehiculo.concesionario             String   — A, B o C
 *   concesionario.cuentaConcesionario  String
 *
 * Outputs (SIPOC Paso 09 — v1.1.2):
 *   desembolso.comprobanteTransferencia  String
 *   desembolso.planPagos                 String  — PP-BANESCO-CREDICARRO
 *   desembolso.timestamp                 String  — ISO-8601 (v1.1.0)
 *
 * Trigger de fallo demo: cliente.cuentaCliente === "FAIL-DEMO-0000"
 */

"use strict";

const express = require("express");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3009;

// Plan de pagos estático — referencia fija para la PoC
const PLAN_PAGOS_REF = "PP-BANESCO-CREDICARRO";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Genera número de comprobante de transferencia */
function generarComprobante() {
  const seg = uuidv4().replace(/-/g, "").substring(0, 12).toUpperCase();
  return `CET-${seg}`;
}

/**
 * Valida campos requeridos del body.
 * Acepta integer 0 como valor válido para cedulaIdentidad.
 */
function validarInputs(body) {
  const requeridos = [
    ["firmas.firmaClienteOk",             body?.firmas?.firmaClienteOk],
    ["firmas.firmaBancoOk",               body?.firmas?.firmaBancoOk],
    ["firmas.firmaConcesionarioOk",       body?.firmas?.firmaConcesionarioOk],
    ["polizas.pagoPolizasOk",             body?.polizas?.pagoPolizasOk],
    ["credito.montoFinanciable",          body?.credito?.montoFinanciable],
    ["cliente.cedulaIdentidad",           body?.cliente?.cedulaIdentidad],
    ["cliente.cuentaCliente",             body?.cliente?.cuentaCliente],
    ["vehiculo.concesionario",            body?.vehiculo?.concesionario],
    ["concesionario.cuentaConcesionario", body?.concesionario?.cuentaConcesionario],
  ];
  return requeridos
    .filter(([, v]) => v === undefined || v === null || v === "")
    .map(([k]) => k);
}

// ─────────────────────────────────────────────
// POST /api/v1/desembolso/ejecutar
//   Transacción atómica de desembolso.
//   BAW Task_09_Desembolso (serviceTask)
// ─────────────────────────────────────────────
app.post("/api/v1/desembolso/ejecutar", (req, res) => {
  try {
    const faltantes = validarInputs(req.body);
    if (faltantes.length > 0) {
      return res.status(400).json({
        error: "CAMPOS_REQUERIDOS_FALTANTES",
        mensaje: "Faltan campos obligatorios del SIPOC Paso 09.",
        camposFaltantes: faltantes,
      });
    }

    const { firmas, polizas, credito, cliente, vehiculo, concesionario } = req.body;

    // Guardas de entrada — las tres firmas del paso 08 deben estar OK
    if (!firmas.firmaClienteOk) {
      return res.status(422).json({
        error: "PRECONDICION_FALLIDA",
        mensaje: "El cliente no ha firmado el contrato (firmas.firmaClienteOk = false).",
        desembolso: { comprobanteTransferencia: null, planPagos: null, timestamp: null },
      });
    }

    if (!firmas.firmaBancoOk) {
      return res.status(422).json({
        error: "PRECONDICION_FALLIDA",
        mensaje: "El banco no ha firmado el contrato (firmas.firmaBancoOk = false).",
        desembolso: { comprobanteTransferencia: null, planPagos: null, timestamp: null },
      });
    }

    if (!firmas.firmaConcesionarioOk) {
      return res.status(422).json({
        error: "PRECONDICION_FALLIDA",
        mensaje: "El concesionario no ha firmado el contrato (firmas.firmaConcesionarioOk = false).",
        desembolso: { comprobanteTransferencia: null, planPagos: null, timestamp: null },
      });
    }

    if (!polizas.pagoPolizasOk) {
      return res.status(422).json({
        error: "PRECONDICION_FALLIDA",
        mensaje: "Las pólizas no están emitidas y pagadas (polizas.pagoPolizasOk = false).",
        desembolso: { comprobanteTransferencia: null, planPagos: null, timestamp: null },
      });
    }

    // Trigger de fallo para demo
    if (cliente.cuentaCliente === "FAIL-DEMO-0000") {
      return res.status(503).json({
        error: "CORE_NO_DISPONIBLE",
        mensaje: "Core bancario temporalmente fuera de línea (modo demo-fallo).",
        desembolso: { comprobanteTransferencia: null, planPagos: null, timestamp: null },
      });
    }

    const comprobanteTransferencia = generarComprobante();
    const timestamp = new Date().toISOString();

    // Respuesta principal — BAW mapea desembolso.* a tw.local.desembolso.*
    res.status(201).json({
      desembolso: {
        comprobanteTransferencia,   // → tw.local.desembolso.comprobanteTransferencia
        planPagos: PLAN_PAGOS_REF,  // → tw.local.desembolso.planPagos
        timestamp,                  // → tw.local.desembolso.timestamp  (v1.1.0)
      },
      // detalle: desactivado en respuesta activa (v1.1.0) — conservado aquí como
      // referencia para Fase 2 / auditoría / BAI. Descomentar para reactivar.
      //
      // detalle: {
      //   operacion: "DESEMBOLSO_CREDITO_CREDICARRO",
      //   abonoCliente: {
      //     cuentaDestino:   cliente.cuentaCliente,
      //     titular:         cliente.cedulaIdentidad,
      //     montoAbonadoUsd: credito.montoFinanciable,
      //     descripcion:     "Abono crédito Crédi-Carro",
      //   },
      //   pagoConcesionario: {
      //     cuentaDebito:        cliente.cuentaCliente,
      //     concesionario:       vehiculo.concesionario,
      //     cuentaCredito:       concesionario.cuentaConcesionario,
      //     montoTransferidoUsd: credito.montoFinanciable,
      //     descripcion:         `Pago concesionario ${vehiculo.concesionario} — Crédi-Carro`,
      //   },
      //   sistema: "Core Bancario IBM i/AS400 (mock)",
      // },
    });

  } catch (err) {
    console.error("[mock-core-bancario] Error inesperado en /ejecutar:", err);
    res.status(500).json({
      error: "ERROR_INTERNO",
      mensaje: "Error inesperado en el mock del Core bancario.",
      detalle: err.message,
    });
  }
});

// ─────────────────────────────────────────────
// GET /api/v1/desembolso/:comprobante
//   Consulta un comprobante ya generado.
//   BAW / BAI puede usar esto para auditoría.
// ─────────────────────────────────────────────
app.get("/api/v1/desembolso/:comprobante", (req, res) => {
  const { comprobante } = req.params;

  if (!comprobante.startsWith("CET-")) {
    return res.status(404).json({
      error: "COMPROBANTE_NO_ENCONTRADO",
      mensaje: `No se encontró el comprobante '${comprobante}' en el registro mock.`,
    });
  }

  res.status(200).json({
    comprobante,
    tipo:              "COMPROBANTE_TRANSFERENCIA",
    estado:            "EJECUTADO",
    planPagos:         PLAN_PAGOS_REF,
    timestampConsulta: new Date().toISOString(),
    nota:              "Operación registrada por mock — válida solo para PoC.",
  });
});

// ─────────────────────────────────────────────
// GET /health
// ─────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.status(200).json({
    status:    "UP",
    servicio:  "mock-core-bancario",
    paso:      "09 · Desembolso",
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────
// Arranque
// ─────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[mock-core-bancario] Paso 09 corriendo en http://localhost:${PORT}`);
    console.log(`  POST /api/v1/desembolso/ejecutar        — transacción atómica de desembolso`);
    console.log(`  GET  /api/v1/desembolso/:comprobante    — consulta comprobante`);
    console.log(`  GET  /health                            — healthcheck`);
  });
}

module.exports = app;
