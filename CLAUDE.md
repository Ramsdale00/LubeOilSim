# CLAUDE.md — LubeOilSim Simulator

## Project Purpose

Build a **highly futuristic, AI-driven digital twin simulator** for a Lube Oil Blending Plant (LOBP).

> **Scope is strictly the simulator** — not a full production application. Focus exclusively on the simulation platform. Do not build authentication, admin panels, or production deployment layers.

The simulator should feel like a next-generation industrial command center — a sci-fi control room with holographic panels, real-time streaming data, and immersive interactivity.

**Vision:** _"Tesla meets NASA meets Industrial AI Control Room"_

---

## UI / UX Design Principles

These are non-negotiable — visual quality is as important as functionality.

- **Light theme** with glassmorphism cards and holographic panel effects
- **Animated pipelines** showing oil flow between tanks in real time
- **Real-time charts** with smooth transitions (no static snapshots)
- **Floating control panels** and draggable widgets
- **3D tank visualization** — animated fill levels, temperature glow effects
- **Interactive plant map** with zoom and pan
- **Status indicators** — glowing pulses, heatmaps, colour-coded alerts
- Smooth animations and transitions are **required everywhere**, not optional

---

## Simulator Modules

### 1. Recipe Lab
- Create and modify lubricant formulations
- Ingredient sliders: base oil %, additive %
- Real-time AI prediction of:
  - Viscosity
  - Flash point
  - TBN (Total Base Number)
- Cost vs Quality optimization toggle
- "AI Suggest Recipe" button (simulated response)

### 2. Blend Simulator
- Start / stop blending batches
- Animated pipeline flow during active blends
- Multi-stage process: `queued → mixing → sampling → lab → completed`
- Adjustable parameters: temperature, mixing speed, ingredient sequence
- Real-time progress bars and alerts

### 3. Tank Digital Twin
- Visual tank farm layout
- Per-tank display: fill level (animated liquid), material type, temperature
- Drag-and-drop tank allocation
- Low-stock alerts with glowing indicators

### 4. Quality AI Engine
- Live prediction graphs with confidence intervals
- Off-spec risk meter (0–100%)
- AI recommendations: adjust ingredient %, modify temperature
- Side-by-side comparison: predicted vs actual (simulated) lab values

### 5. Supply & Cost Optimizer
- Multi-supplier selection interface
- Per-supplier display: price, lead time, quality grade
- AI suggests cheapest + optimal supplier mix
- Dynamic cost breakdown visualization

### 6. Command Dashboard
- KPI tiles: production volume, cost per batch, energy usage, equipment utilization
- Live event feed: alerts, failures, delays
- Timeline view of operations

### 7. AI Control Panel
- Natural language input (e.g. "Start blend B101", "Optimize recipe for cost")
- Simulation mode: run what-if scenarios, compare outputs side by side

---

## Tech Stack

### Frontend
| Tool | Purpose |
|------|---------|
| React + TypeScript | Component framework |
| Tailwind CSS | Glassmorphism styling |
| Recharts | Animated real-time charts |
| Zustand | Global state management |
| Three.js | 3D tank visualization |

### Backend
| Tool | Purpose |
|------|---------|
| FastAPI (Python) | REST + WebSocket API |
| PostgreSQL | Persistent data store |
| Redis + WebSockets | Real-time data streaming |
| Celery | Async simulation task queue |

### AI / ML
| Tool | Purpose |
|------|---------|
| scikit-learn / TensorFlow | Simulated quality prediction & recipe optimization models |

> All AI/ML responses are **simulated** — no live model inference required. Use dummy datasets and pre-computed responses to drive the UI.

---

## Simulation Features

- **Time acceleration**: 1x, 5x, 10x
- **Injectable events**:
  - Equipment failure
  - Material shortage
  - Quality deviation
- Injected events show immediate visual impact across the simulator
- All data is driven by **dummy datasets + simulated API responses**

---

## Advanced Features

- Predictive maintenance alerts with equipment health meters
- Energy consumption heatmap
- Cross-recipe learning suggestions (simulated)
- Scenario comparison mode (side-by-side what-if analysis)

---

## Architecture Conventions

- **Modular**: each module (Recipe Lab, Blend Simulator, etc.) is an independent, self-contained component
- **No real plant connection** — everything is simulated
- **No auth/admin** — out of scope
- Dummy data should be realistic enough to make the simulator feel live
- WebSocket connections should stream simulated updates at regular intervals to keep the UI animated

---

## Repository Structure (Target)

```
LubeOilSim/
├── frontend/               # React + TypeScript app
│   ├── src/
│   │   ├── components/     # Shared UI components
│   │   ├── modules/        # One folder per simulator module
│   │   ├── store/          # Zustand stores
│   │   ├── hooks/          # Custom React hooks
│   │   └── assets/         # Static assets
│   ├── package.json
│   └── tailwind.config.ts
├── backend/                # FastAPI app
│   ├── app/
│   │   ├── api/            # Route handlers
│   │   ├── simulation/     # Simulation logic + dummy data generators
│   │   ├── models/         # DB models
│   │   └── ml/             # Simulated AI/ML model wrappers
│   └── requirements.txt
├── CLAUDE.md
└── docker-compose.yml
```

---

## Development Priorities

1. Get the visual shell right first — glassmorphism layout, animated plant map, tank farm
2. Wire up simulated WebSocket streams to drive live data
3. Implement modules one at a time, starting with Command Dashboard → Blend Simulator → Tank Digital Twin
4. Add AI/ML simulation layer last (Recipe Lab, Quality Engine, AI Control Panel)
