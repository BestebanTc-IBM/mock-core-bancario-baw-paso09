# mock-core-bancario — Paso 09 · Desembolso

Simula el **Core bancario IBM i/AS400** para el Paso 09 del proceso Crédi-Carro.  
BAW invoca este servicio desde un único `serviceTask` — **transacción atómica**.

---

## URLs

| Ambiente | URL |
|---|---|
| **Producción (Vercel)** | `https://mock-core-bancario-baw-paso09.vercel.app` |
| **Local (desarrollo)** | `http://localhost:3009` |

---

## Flujo

```
Task_08c (formalización) → Task_09_Desembolso → Task_10
                                   ↓
                     POST /api/v1/desembolso/ejecutar
                     1. Abona crédito en cuenta del cliente
                     2. Debita al cliente + deposita al concesionario
                     3. Genera CET + referencia de plan de pagos
```

---

## Endpoints

| Método | Ruta | URL completa (Vercel) |
|---|---|---|
| `POST` | `/api/v1/desembolso/ejecutar` | `https://mock-core-bancario-baw-paso09.vercel.app/api/v1/desembolso/ejecutar` |
| `GET` | `/api/v1/desembolso/:comprobante` | `https://mock-core-bancario-baw-paso09.vercel.app/api/v1/desembolso/CET-xxxx` |
| `GET` | `/health` | `https://mock-core-bancario-baw-paso09.vercel.app/health` |

---

## Arranque local

```bash
npm install
npm start          # node server.js  → http://localhost:3009
npm run dev        # nodemon (hot reload)
```

---

## Variables BAW mapeadas — `Task_09_Desembolso`

**Input:**
```
tw.local.firmas.firmaConcesionarioOk          → firmas.firmaConcesionarioOk   (guarda)
tw.local.polizas.pagoPolizasOk                → polizas.pagoPolizasOk          (guarda)
tw.local.credito.montoFinanciable             → credito.montoFinanciable
tw.local.cliente.cedulaIdentidad              → cliente.cedulaIdentidad
tw.local.cliente.cuentaCliente                → cliente.cuentaCliente
tw.local.vehiculo.concesionario               → vehiculo.concesionario
tw.local.concesionario.cuentaConcesionario    → concesionario.cuentaConcesionario
```

**Output:**
```
desembolso.comprobanteTransferencia  → tw.local.desembolso.comprobanteTransferencia
desembolso.planPagos                 → tw.local.desembolso.planPagos
```

---

## Códigos de respuesta

| Código | Causa |
|---|---|
| `201` | Desembolso ejecutado correctamente |
| `400` | Campos obligatorios faltantes en el request |
| `422` | Precondición fallida — firmas o pólizas incompletas |
| `503` | Core fuera de línea (modo demo-fallo) |

---

## Trigger de fallo para demo

Enviar `cliente.cuentaCliente = "FAIL-DEMO-0000"` → responde `503`.

---

## Entregables del paso (SIPOC)

| Variable | Valor | Descripción |
|---|---|---|
| `desembolso.comprobanteTransferencia` | `CET-XXXXXXXXXXXX` (dinámico) | Comprobante Electrónico de Transferencia |
| `desembolso.planPagos` | `PP-BANESCO-CREDICARRO` (estático) | Referencia del plan de pagos |

---

## Fase 2 — Integración con IBM RPA + AS400 real

Ver [`FASE2_RPA_AS400.md`](FASE2_RPA_AS400.md) para la arquitectura de producción:  
`BAW → IBM RPA Robotic Gateway → Bot 5250 → IBM i TechZone`
