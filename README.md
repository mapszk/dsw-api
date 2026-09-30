# DSW API: gestión de reservas de estacionamiento

API REST del trabajo práctico de **Desarrollo de Software** (UTN). Gestiona usuarios, playas de estacionamiento, cocheras, clientes, tarifas, reservas y pagos.

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

Para agilizar el desarrollo: levanta la API y la base de datos con un solo comando, sin instalar PostgreSQL.

### Requisitos previos

- [Git](https://git-scm.com/downloads)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows / macOS) o Docker Engine + Docker Compose (Linux)
- Opcional: [Node.js 22](https://nodejs.org/)

### Paso a paso

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

Crea tipos de vehículo, tipos de estadía, tarifas, una playa con cocheras y un usuario administrador:

| Email           | Contraseña | Rol   |
| --------------- | ---------- | ----- |
| `admin@dsw.com` | `admin123` | ADMIN |

**5. Verificar que funciona**

```bash
curl http://localhost:3000/api/health
```

Respuesta esperada: `{"status":"ok"}`. También podés abrir <http://localhost:3000/api/health> en el navegador.

**6. Ver logs y detener**

```bash
docker compose logs -f api   # ver logs de la API (Ctrl+C para salir)
docker compose down          # detener contenedores (los datos se conservan)
docker compose down -v       # detener y BORRAR la base de datos
```

### Problemas frecuentes

- **Puerto ocupado (3000 o 5432):** cambiá `PORT` o `POSTGRES_PORT` en `.env` y volvé a correr `docker compose up -d`.
- **Instalé una dependencia nueva:** reconstruí la imagen con `docker compose up -d --build`.
- **El hot reload no detecta cambios (Windows / macOS):** reiniciá la API con `docker compose restart api`.
- **Quiero empezar con la base limpia:** `docker compose down -v && docker compose up -d --build` y volvé a correr el seed.

## Ejecución sin Docker para la API

Si preferís correr la API directamente con Node (por ejemplo, para debuggear desde el editor), podés dejar solo la base en Docker:

```bash
cp .env.example .env
docker compose up -d db     # solo PostgreSQL
npm install                 # instala dependencias y genera el cliente de Prisma
npm run db:deploy           # aplica migraciones
npm run db:seed             # datos iniciales
npm run dev                 # API en http://localhost:3000
```

Antes de hacerlo, detené el contenedor `api` si estaba corriendo (`docker compose stop api`) para liberar el puerto 3000.

## Comandos útiles

Con Docker, anteponé `docker compose exec api` a los comandos `npm`/`npx` (ej: `docker compose exec api npm test`).

| Comando                                  | Descripción                                         |
| ---------------------------------------- | --------------------------------------------------- |
| `npm run dev`                            | API en modo desarrollo con recarga automática       |
| `npm run build` / `npm start`            | Compilar a `dist/` y ejecutar la versión compilada  |
| `npm test`                               | Ejecutar tests                                      |
| `npm run lint` / `npm run format`        | Revisar estilo / formatear código                   |
| `npm run typecheck`                      | Verificar tipos de TypeScript                       |
| `npx prisma migrate dev --name <nombre>` | Crear una migración después de modificar el esquema |
| `npm run db:deploy`                      | Aplicar migraciones pendientes                      |
| `npm run db:seed`                        | Cargar datos iniciales                              |
| `npm run db:studio`                      | Abrir Prisma Studio (explorador visual de la base)  |
| `npm run docker:up` / `docker:down`      | Atajos para levantar / detener Docker Compose       |

> Prisma Studio abre una interfaz web, conviene correrlo desde tu máquina (`npm run db:studio`) con la base levantada en Docker.

## Estructura del proyecto

```
dsw-api/
├── prisma/
│   ├── schema.prisma        # modelo de datos (basado en el DER)
│   ├── migrations/          # migraciones SQL generadas por Prisma
│   └── seed.ts              # datos iniciales
├── src/
│   ├── config/env.ts        # variables de entorno validadas con Zod
│   ├── lib/prisma.ts        # instancia única de PrismaClient
│   ├── middlewares/         # validate, error-handler, not-found
│   ├── modules/             # un directorio por entidad (routes, controller, service, schema)
│   ├── routes/index.ts      # router principal /api
│   ├── utils/               # HttpError y utilidades
│   ├── app.ts               # configuración de Express
│   └── server.ts            # punto de entrada
├── tests/                   # tests con Vitest + Supertest
├── docs/                    # documentación del TP
├── docker-compose.yml
└── Dockerfile
```

## Reglas del equipo

### Git y commits

- Mensajes de commit **cortos, simples y en español**, en modo imperativo/presente: `Agrega CRUD de playas`, `Corrige calculo de precio de reserva`.
- Un commit por cambio lógico. No mezclar cambios no relacionados.
- Nunca commitear `.env`, `node_modules/`, `dist/` ni el cliente generado de Prisma (`src/generated/`).
- `main` siempre estable. Trabajar en ramas (`feature/crud-playas`, `fix/solapamiento-reservas`) y mergear mediante Pull Request revisado por otro integrante.
- Antes de abrir un PR: `npm run lint`, `npm run typecheck` y `npm test` deben pasar.

### Arquitectura en capas

Cada entidad vive en `src/modules/<entidad>/` y se divide en:

| Archivo                   | Responsabilidad                                                                  |
| ------------------------- | -------------------------------------------------------------------------------- |
| `<entidad>.routes.ts`     | Define rutas y aplica middlewares (`validate`, autenticación)                    |
| `<entidad>.controller.ts` | Lee la request, llama al service y arma la respuesta HTTP. Sin lógica de negocio |
| `<entidad>.service.ts`    | Lógica de negocio y acceso a datos con Prisma. No conoce `req`/`res`             |
| `<entidad>.schema.ts`     | Schemas Zod de entrada (crear, actualizar, params, filtros)                      |

Flujo: `routes -> controller -> service -> Prisma`.

### Convenciones de código

- Entidades y campos del dominio en **español** (como en el DER): `Reserva`, `fechaInicio`, `precioTotal`. Código técnico en inglés (`validate`, `errorHandler`, `HttpError`).
- Archivos en `kebab-case`; variables y funciones en `camelCase`; clases y tipos en `PascalCase`.
- Imports relativos con extensión `.js` (requisito de ESM en Node).
- Toda entrada (body, params, query) se valida con Zod mediante el middleware `validate`.
- Los errores se lanzan con `HttpError` (ej: `throw HttpError.notFound('Playa no encontrada')`); el `errorHandler` global los transforma en respuesta. No usar `try/catch` en controllers solo para responder errores (Express 5 captura errores async).
- Contraseñas siempre hasheadas con `bcryptjs`; nunca devolver el campo `password` en respuestas.

### Formato de respuestas

- Éxito: el recurso o listado directamente en JSON. `201` al crear, `204` al eliminar.
- Error:

  ```json
  { "error": { "message": "Descripción legible", "details": {} } }
  ```

| Código | Uso                                                     |
| ------ | ------------------------------------------------------- |
| 400    | Datos inválidos (validación Zod, JSON mal formado)      |
| 401    | No autenticado                                          |
| 403    | Sin permisos para el recurso                            |
| 404    | Recurso o ruta inexistente                              |
| 409    | Conflicto (duplicado, cochera ocupada, estado inválido) |
| 500    | Error inesperado                                        |

- Los montos (`Decimal`) se devuelven como string (`"1500.00"`) para no perder precisión.

## Licencia

[MIT](LICENSE)
