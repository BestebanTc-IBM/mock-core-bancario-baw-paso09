# Fase 2 — Integración RPA + AS400 real (Paso 09 · Desembolso)

> **Estado:** Pendiente — revisar si alcanza antes del 17/09.  
> Para la PoC actual se usa el mock REST en `server.js`.

---

## Idea

Reemplazar el mock REST por un **IBM RPA Bot** que opera una pantalla 5250
del IBM i real, ejecuta la transacción de desembolso y retorna el comprobante
al BAW — sin cambiar nada en el `serviceTask` del proceso.

```
PoC actual:   BAW → mock REST (Node.js, puerto 3009)
Fase 2:       BAW → IBM RPA Robotic Gateway → Bot 5250 → IBM i AS400
```

El `serviceTask` en BAW es idéntico en ambos casos. Solo cambia la URL del endpoint.

---

## Recursos

- **Repo demo AS400 + RPA:**  
  https://github.com/bmarolleau/flight400-demo

- **Ambiente IBM i en TechZone:**  
  https://techzone.ibm.com/collection/69caf21433fe65185ca16a84

- **Tenant IBM RPA (CP4BA ITZ):**  
  https://cpd-cp4ba.apps.itz-k9po3g.infra01-lb.dal14.techzone.ibm.com/rpa/ui  
  Tenant: `5000 — ibm` (expira 31/08/2026)  
  Tenant: `5001 — Test` (expira 08/09/2026)

---

## Pasos para implementar

1. Reservar el ambiente IBM i de TechZone (link arriba)
2. Entrar al tenant RPA desde el CP4BA (SSO — no requiere login separado)
3. Descargar IBM RPA Studio desde: Control Center → Settings → Client Download
4. Grabar el bot contra la pantalla 5250 del AS400 usando el repo de referencia
5. Publicar el bot en el tenant `5000`
6. Cambiar la URL del Integration Node en BAW:  
   `http://localhost:3009` → `https://.../rpa/api/v1.0/workspace/...`
7. Probar end-to-end: BAW → bot → pantalla 5250 → comprobante → BAW

---

## Arquitectura del flujo

```
BAW Task_09 (serviceTask)
    │  HTTP POST → Robotic Gateway (CP4BA)
    ▼
IBM RPA Bot Agent (VM Windows)
    │  Abre sesión 5250 → IBM i TechZone
    │  Navega al programa de desembolso
    │  Llena: CI cliente / concesionario / monto
    │  Ejecuta F6 → captura comprobante
    ▼
BAW recibe respuesta síncrona
    desembolso.comprobanteTransferencia = "CET-XXXX"
    desembolso.planPagos                = "PP-BANESCO-CREDICARRO"
    Proceso avanza → Task_10
```
