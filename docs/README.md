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

```mermaid
erDiagram
    CLIENTE ||--o{ RESERVA : realiza
    COCHERA ||--o{ RESERVA : ocupa
    TIPO_VEHICULO ||--o{ RESERVA : usa
    TIPO_ESTADIA ||--o{ RESERVA : usa
    RESERVA ||--o| PAGO : registra
    PLAYA ||--|{ COCHERA : contiene
    TIPO_VEHICULO ||--o{ TARIFA : aplica
    TIPO_ESTADIA ||--o{ TARIFA : aplica

    USUARIO {
        int id
        string email
        string password
        enum rol
    }
    CLIENTE {
        int id
        string nombre
        string telefono
        string dni
    }
    RESERVA {
        int id
        string patente
        datetime fechaInicio
        datetime fechaFin
        decimal precioUnitario
        decimal precioTotal
        enum estado
    }
    PAGO {
        int id
        datetime fecha
        enum metodo
        decimal monto
    }
    COCHERA {
        int id
        boolean techada
    }
    PLAYA {
        int id
        string sector
    }
    TIPO_VEHICULO {
        int id
        string tipo
        decimal ajuste
    }
    TIPO_ESTADIA {
        int id
        string tipo
    }
    TARIFA {
        int id
        decimal precio
    }
```
