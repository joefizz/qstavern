# QSTavern — IFC Quantity Surveyor

A web application for extracting, exploring, and exporting quantity schedules from IFC files.

Upload an IFC file and get instant access to:
- Quantity schedules (area, volume, length per element)
- Material and product type data
- Spatial hierarchy browser
- Interactive 3D viewer with element selection
- CSV and XLSX export

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Python · FastAPI · Uvicorn |
| IFC parsing | IfcOpenShell 0.8 |
| Data | Pandas · openpyxl · Pydantic v2 |
| Frontend | React 18 · Vite · TypeScript |
| Styling | Tailwind CSS |
| Table | TanStack Table v8 |
| Charts | Recharts |
| 3D viewer | Three.js · React Three Fiber · Drei |
| Container | Docker Compose |

---

## Quick start

**Requirements:** Docker Desktop

```bash
# Clone
git clone <repo-url>
cd QS/ifc-qs-app

# Start in dev mode (hot reload on both frontend and backend)
docker compose up

# Frontend:  http://localhost:9090
# Backend:   http://localhost:8001
# API docs:  http://localhost:8001/docs
```

### Rebuild after dependency changes

```bash
docker compose build
docker compose up
```

### Run backend tests

```bash
docker compose run backend pytest
```

### Production build

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build
```

---

## Environment variables

Copy `.env.example` to `.env` and adjust as needed:

```
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE_MB=200
CORS_ORIGINS=http://localhost:3000
```

---

## API reference

| Method | Path | Description |
|---|---|---|
| `GET`  | `/health` | Health check + IfcOpenShell version |
| `POST` | `/api/upload` | Upload `.ifc` file → returns `file_id` |
| `GET`  | `/api/files/{id}/process` | SSE stream: parse progress + final summary |
| `GET`  | `/api/files/{id}/summary` | Project metadata |
| `GET`  | `/api/files/{id}/quantities` | Element schedule (filterable) |
| `GET`  | `/api/files/{id}/aggregates` | Totals by type or storey |
| `GET`  | `/api/files/{id}/geometry` | Mesh data for 3D viewer |
| `GET`  | `/api/files/{id}/tree` | Spatial hierarchy (Project→Site→Building→Storey) |
| `GET`  | `/api/files/{id}/export/csv` | CSV download |
| `GET`  | `/api/files/{id}/export/xlsx` | XLSX download (3 sheets) |

Full interactive docs at `/docs` when the backend is running.

---

## Project structure

```
ifc-qs-app/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI route handlers
│   │   ├── core/         # IFC parsing engine (extractor, tree, units)
│   │   ├── models/       # Pydantic schemas
│   │   └── services/     # File store, aggregator, exporter
│   ├── tests/
│   │   └── fixtures/     # IFC2x3 and IFC4 test files
│   └── main.py
├── frontend/
│   ├── src/
│   │   ├── api/          # Typed API client
│   │   └── components/   # React components
│   └── public/           # Static assets (favicon, etc.)
├── docker-compose.yml
├── docker-compose.override.yml   # Dev overrides
└── docker-compose.prod.yml       # Production ports
```

---

## IFC support

- IFC2x3 and IFC4 schemas
- Quantities sourced from `IfcElementQuantity` (BaseQuantities) where present; geometry bounding box fallback otherwise
- Units normalised to **m / m² / m³** regardless of model export settings
- Supported element types: `IfcWall`, `IfcSlab`, `IfcRoof`, `IfcBeam`, `IfcColumn`, `IfcDoor`, `IfcWindow`, `IfcStair`, `IfcRailing`, `IfcCovering`, `IfcCurtainWall`
