# Documentación: DSW API

Punto de entrada de la documentación del backend, según los requisitos de la cátedra.

| Sección                             | Estado                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------- |
| Proposal actualizada                | Pendiente                                                                 |
| Links a los PR                      | Pendiente                                                                 |
| Instrucciones de instalación        | Ver [README principal](../README.md#instalación-y-ejecución-local-docker) |
| Minutas de reunión y avance         | Pendiente                                                                 |
| Tracking de features, bugs e issues | Pendiente                                                                 |
| Documentación de la API             | Pendiente                                                                 |
| Evidencia de ejecución de tests     | Pendiente                                                                 |

## Modelo de datos

DER corregido por la cátedra. Diferencias en la implementación:

- `Usuario.rol` (`ADMIN` | `CLIENTE`): necesario para los 2 niveles de acceso.
- `TipoEstadia.duracionMinutos`: necesario para calcular el precio total de la reserva.
- `Usuario` - `Reserva` es 0..N del lado de la reserva (un administrador no tiene reservas).

```mermaid
erDiagram
    USUARIO ||--o{ RESERVA : "pertenece"
    COCHERA ||--o{ RESERVA : "ocupa"
    TIPO_VEHICULO ||--o{ RESERVA : "usa"
    TIPO_ESTADIA ||--o{ RESERVA : "usa"
    RESERVA ||--o| PAGO : "registra"
    PLAYA ||--|{ COCHERA : "pertenece"
    TIPO_VEHICULO ||--o{ TARIFA : "tiene"
    TIPO_ESTADIA ||--o{ TARIFA : "tiene"

    USUARIO {
        int id PK
        string nombre
        string telefono
        string dni UK
        string email UK
        string password
        enum rol
    }
    RESERVA {
        int id PK
        string patente
        datetime fechaInicio
        datetime fechaFin
        decimal precioTotal
        enum estado
    }
    PAGO {
        int id PK
        datetime fecha
        enum metodo
        decimal monto
    }
    COCHERA {
        int id PK
        boolean techada
        enum estado
    }
    PLAYA {
        int id PK
        string sector UK
    }
    TIPO_VEHICULO {
        int id PK
        string tipo UK
    }
    TIPO_ESTADIA {
        int id PK
        string tipo UK
        int duracionMinutos
    }
    TARIFA {
        int id PK
        datetime fechaDesde
        decimal valor
    }
```
