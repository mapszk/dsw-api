# DSW API: gestión de reservas de estacionamiento

API REST del trabajo práctico de **Desarrollo de Software** (UTN). Gestiona usuarios (administradores y clientes), playas de estacionamiento, cocheras, tarifas, reservas y pagos.

- Propuesta del TP: [tp-dsw/proposal.md](https://github.com/mapszk/tp-dsw/blob/main/proposal.md)
- Frontend: [mapszk/dsw-frontend](https://github.com/mapszk/dsw-frontend)
- Documentación del proyecto: [docs/README.md](docs/README.md)

## Índice

1. [Stack tecnológico](#stack-tecnológico)
2. [Instalación y ejecución local (Docker)](#instalación-y-ejecución-local-docker)
3. [Ejecución sin Docker para la API](#ejecución-sin-docker-para-la-api)
4. [Comandos útiles](#comandos-útiles)
5. [Estructura del proyecto](#estructura-del-proyecto)
6. [Reglas del equipo](#reglas-del-equipo)

## Stack tecnológico

- Node.js 22 + TypeScript
- Express 5
- PostgreSQL 16
- Prisma 7
- Zod
- Vitest + Supertest
- ESLint + Prettier
- Docker + Docker Compose

## Instalación y ejecución local (Docker)

**1. Clonar el repositorio**

```bash
git clone https://github.com/mapszk/dsw-api.git
cd dsw-api
```

**2. Crear el archivo de variables de entorno**

```bash
cp .env.example .env
```

**3. Levantar la aplicación**

```bash
docker compose up -d --build
```

Esto construye la imagen de la API, levanta PostgreSQL, espera a que la base esté lista, aplica las migraciones y arranca la API en modo desarrollo (se recarga sola al editar archivos de `src/`).

**4. Cargar datos iniciales (seed)**

```bash
docker compose exec api npm run db:seed
```

**5. Documentación de la API**

Con la API levantada, la documentación interactiva (Swagger UI) queda en http://localhost:3000/api/docs. La especificación OpenAPI está en [docs/openapi.yaml](docs/openapi.yaml).

Para probar endpoints protegidos desde Swagger, primero ejecutar `POST /auth/login` (por ejemplo con `admin@dsw.com` / `dsw12345`): la cookie de sesión queda guardada y se usa en los siguientes pedidos.

**6. Pagos con MercadoPago (opcional)**

Sin credenciales la API funciona igual, pero iniciar un pago con MercadoPago responde 503. Para probarlo en local:

1. En [MP Developers](https://www.mercadopago.com.ar/developers/panel) crear una aplicación y dos cuentas de prueba (vendedor y comprador).
2. Con la cuenta vendedora, copiar el Access Token de prueba en `MP_ACCESS_TOKEN`.
3. Exponer la API con un túnel (`ngrok http 3000`) y poner la URL pública, sin `/api`, en `API_PUBLIC_URL`.
4. En la aplicación de MP, configurar el webhook de **Pagos** con `<API_PUBLIC_URL>/api/webhooks/mercadopago` y copiar la clave secreta en `MP_WEBHOOK_SECRET`.
5. Reiniciar la API, iniciar el pago de una reserva activa (`POST /reservas/{id}/pagar` con `{ "metodo": "ONLINE" }`) y pagar en el link devuelto con la cuenta compradora y las tarjetas de prueba de MP.
