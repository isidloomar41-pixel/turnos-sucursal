# Turnos BBVA

Aplicación educativa de turnos para una sucursal bancaria. Incluye API REST en Flask y panel web en Angular con cuatro ventanillas, pantalla pública y avisos de voz/sonido.

## Requisitos

- Node.js 20 o superior
- Python 3.10 o superior

## Ejecutar en local

1. Instala las dependencias de la API: `cd backend; python -m venv .venv; .venv\\Scripts\\activate; pip install -r requirements.txt` (macOS/Linux: `source .venv/bin/activate`).
2. Inicia Flask: `python app.py` desde `backend`.
3. En otra terminal, ejecuta `npm install` y `npm start` desde `frontend`.
4. Abre `http://localhost:4200`. El tablero de pantalla está en `/pantalla`.

La API escucha en `http://localhost:5000/api`. La interfaz cambia automáticamente entre el proxy local y `/api` en producción.

## Funciones

- Generación secuencial A01, A02… y vista del comprobante.
- Cuatro ventanillas con asignación del turno más antiguo, estado ocupado/disponible y cierre de atención.
- Pantalla de turnos llamada con anuncio de voz y tono corto al llamar.
- Actualización automática en tiempo real mediante consulta periódica.
- Estado compartido y persistente con Redis REST cuando se configuran `KV_REST_API_URL` y `KV_REST_API_TOKEN` (Upstash/Vercel Marketplace). Sin estas variables usa almacenamiento en memoria, útil para desarrollo; las funciones sin base de datos persistente no garantizan un estado común entre instancias.

## Despliegue

El proyecto está configurado para Vercel: Angular se compila desde `frontend` y Flask se expone desde `api/index.py`. Configura `KV_REST_API_URL` y `KV_REST_API_TOKEN` en Vercel para que los turnos se compartan entre las instancias de la API. La opción más sencilla es crear una base de datos Redis compatible en Marketplace y copiar las credenciales como variables de entorno.

## Rutas de la interfaz

- `/` — generar turno y administrar las cuatro ventanillas.
- `/pantalla` — tablero público para televisor.

Proyecto escolar inspirado en flujos de atención bancaria; no afiliado a BBVA.

