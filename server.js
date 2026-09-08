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
 * Inputs  (SIPOC Paso 09):
 *   firmas.firmaConcesionarioOk    Boolean — guarda de entrada
 *   polizas.pagoPolizasOk          Boolean — guarda de entrada
 *   credito.montoFinanciable       Decimal
 *   cliente.cedulaIdentidad        String
 *   cliente.cuentaCliente          String
 *   vehiculo.concesionario         String  — A, B o C
 *   concesionario.cuentaConcesionario String
 *
 * Outputs (SIPOC Paso 09):
 *   desembolso.comprobanteTransferencia  String
 *   desembolso.planPagos                 String  — referencia estática PP-BANESCO-CREDICARRO
 *
 * Trigger de fallo demo: cliente.cuentaCliente === "FAIL-DEMO-0000"
 */

"use strict";

const express = require("express");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3009;

const PLAN_PAGOS_REF = "PP-BANESCO-CREDICARRO";

function generarComprobante() {
  const seg = uuidv4().replace(/-/g, "").substring(0, 12).toUpperCase();
  return `CET-${seg}`;
}

function validarInputs(body) {
  const requeridos = [
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

app.post("/api/v1/desembolso/ejecutar", (req, res) => {
  const faltantes = validarInputs(req.body);
  if (faltantes.length > 0) {
    return res.status(400).json({
      error: "CAMPOS_REQUERIDOS_FALTANTES",
      mensaje: "Faltan campos obligatorios del SIPOC Paso 09.",
      camposFaltantes: faltantes,
    });
  }

  const { firmas, polizas, credito, cliente, vehiculo, concesionario } = req.body;

  if (!firmas.firmaConcesionarioOk) {
    return res.status(422).json({
      error: "PRECONDICION_FALLIDA",
      mensaje: "El contrato no está completamente firmado (firmas.firmaConcesionarioOk = false).",
      desembolso: { comprobanteTransferencia: null, planPagos: null },
    });
  }

  if (!polizas.pagoPolizasOk) {
    return res.status(422).json({
      error: "PRECONDICION_FALLIDA",
      mensaje: "Las pólizas no están emitidas y pagadas (polizas.pagoPolizasOk = false).",
      desembolso: { comprobanteTransferencia: null, planPagos: null },
    });
  }

  if (cliente.cuentaCliente === "FAIL-DEMO-0000") {
    return res.status(503).json({
      error: "CORE_NO_DISPONIBLE",
      mensaje: "Core bancario temporalmente fuera de línea (modo demo-fallo).",
      desembolso: { comprobanteTransferencia: null, planPagos: null },
    });
  }

  const comprobanteTransferencia = generarComprobante();
  const timestamp = new Date().toISOString();

  res.status(201).json({
    desembolso: {
      comprobanteTransferencia,
      planPagos: PLAN_PAGOS_REF,
    },
    detalle: {
      operacion: "DESEMBOLSO_CREDITO_CREDICARRO",
      timestamp,
      abonoCliente: {
        cuentaDestino:   cliente.cuentaCliente,
        titular:         cliente.cedulaIdentidad,
        montoAbonadoUsd: credito.montoFinanciable,
        descripcion:     "Abono crédito Crédi-Carro",
      },
      pagoConcesionario: {
        cuentaDebito:        cliente.cuentaCliente,
        concesionario:       vehiculo.concesionario,
        cuentaCredito:       concesionario.cuentaConcesionario,
        montoTransferidoUsd: credito.montoFinanciable,
        descripcion:         `Pago concesionario ${vehiculo.concesionario} — Crédi-Carro`,
      },
      sistema: "Core Bancario IBM i/AS400 (mock)",
    },
  });
});

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

app.get("/health", (_req, res) => {
  res.status(200).json({
    status:    "UP",
    servicio:  "mock-core-bancario",
    paso:      "09 · Desembolso",
    timestamp: new Date().toISOString(),
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[mock-core-bancario] Paso 09 corriendo en http://localhost:${PORT}`);
    console.log(`  POST /api/v1/desembolso/ejecutar        — transacción atómica de desembolso`);
    console.log(`  GET  /api/v1/desembolso/:comprobante    — consulta comprobante`);
    console.log(`  GET  /health                            — healthcheck`);
  });
}

module.exports = app;
