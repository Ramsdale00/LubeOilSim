import asyncio
import json
import random
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.tank import Tank
from app.models.blend_batch import BlendBatch
from app.models.equipment import Equipment
from app.models.event_log import EventLog
from app.simulation.data_generators import generate_kpi_snapshot


class SimulationEngine:
    def __init__(self, redis_client, db_session_factory):
        self.redis = redis_client
        self.db_factory = db_session_factory
        self.tick_count = 0
        self.is_running = False
        self.time_acceleration = settings.time_acceleration
        self._task: asyncio.Task | None = None

        # In-memory state cache
        self._tanks: list[dict] = []
        self._batches: list[dict] = []
        self._equipment: list[dict] = []
        self._kpis: dict = {}

    async def start(self) -> None:
        """Load initial state from DB, then start the background tick loop."""
        await self._load_state()
        self.is_running = True
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        """Stop the simulation engine gracefully."""
        self.is_running = False
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _run_loop(self) -> None:
        """Main tick loop."""
        while self.is_running:
            try:
                await self.tick()
            except Exception as exc:
                print(f"[SimulationEngine] tick error: {exc!r}")
            interval = settings.simulation_tick_interval / max(self.time_acceleration, 1)
            await asyncio.sleep(interval)

    async def _load_state(self) -> None:
        """Load current state from the database into in-memory cache."""
        async with self.db_factory() as db:
            tanks = (await db.execute(select(Tank))).scalars().all()
            self._tanks = [self._tank_to_dict(t) for t in tanks]

            batches = (await db.execute(select(BlendBatch))).scalars().all()
            self._batches = [self._batch_to_dict(b) for b in batches]

            equipment = (await db.execute(select(Equipment))).scalars().all()
            self._equipment = [self._equip_to_dict(e) for e in equipment]

        self._kpis = generate_kpi_snapshot(self._batches, self._tanks, self._equipment)

    async def tick(self) -> None:
        """Single simulation tick — advance all state and publish updates."""
        self.tick_count += 1
        accel = max(self.time_acceleration, 1)

        # 1. Advance blend batches
        stage_transitions = []
        for batch in self._batches:
            if batch["stage"] in ("mixing", "sampling", "lab"):
                progress_inc = 2.0 * accel
                batch["progress_pct"] = min(100.0, batch["progress_pct"] + progress_inc)

                # Stage transitions
                if batch["stage"] == "mixing" and batch["progress_pct"] >= 75.0:
                    batch["stage"] = "sampling"
                    stage_transitions.append((batch["id"], "sampling"))
                elif batch["stage"] == "sampling" and batch["progress_pct"] >= 88.0:
                    batch["stage"] = "lab"
                    stage_transitions.append((batch["id"], "lab"))
                elif batch["stage"] == "lab" and batch["progress_pct"] >= 100.0:
                    batch["stage"] = "completed"
                    batch["completed_at"] = datetime.now(timezone.utc).isoformat()
                    stage_transitions.append((batch["id"], "completed"))

        # 2. Drift tank levels
        mixing_batches = [b for b in self._batches if b["stage"] == "mixing"]
        for tank in self._tanks:
            if tank["status"] == "offline":
                continue
            # Base noise
            noise = random.gauss(0, 0.002)
            # Consume from active blending
            if mixing_batches and tank["material"] in ("SN150 Base Oil", "SN500 Base Oil", "PAO 6"):
                consumption = len(mixing_batches) * 0.0003 * accel
                tank["current_level"] = max(0.0, min(1.0, tank["current_level"] - consumption + noise))
            else:
                tank["current_level"] = max(0.0, min(1.0, tank["current_level"] + noise))

            # Update status
            level = tank["current_level"]
            if level < 0.10:
                tank["status"] = "critical"
            elif level < 0.20:
                tank["status"] = "low"
            elif tank["status"] in ("critical", "low"):
                tank["status"] = "normal"

        # 3. Drift temperatures
        for tank in self._tanks:
            if tank["status"] == "offline":
                continue
            if mixing_batches:
                trend = 0.3 * accel
            else:
                trend = 0.0
            noise = random.gauss(0, 0.3)
            tank["temperature_c"] = max(30.0, min(95.0, tank["temperature_c"] + trend * 0.05 + noise))

        # 4. Degrade equipment health
        for equip in self._equipment:
            if equip["status"] == "failed":
                continue
            degradation = 0.005 * accel
            equip["health_pct"] = max(0.0, equip["health_pct"] - degradation)

            if equip["health_pct"] < 10.0:
                equip["status"] = "failed"
            elif equip["health_pct"] < 30.0:
                if equip["status"] != "warning":
                    equip["status"] = "warning"

        # 5. Stochastic events (3% probability per tick)
        new_events = []
        if random.random() < 0.03:
            event = await self._generate_stochastic_event()
            if event:
                new_events.append(event)

        # 6. Compute KPIs
        self._kpis = generate_kpi_snapshot(self._batches, self._tanks, self._equipment)

        # 7. Persist important state changes to DB
        if stage_transitions or self.tick_count % 30 == 0:
            await self._persist_state(stage_transitions, new_events)

        # 8. Publish to Redis
        await self._publish("tanks", "tank_update", {"tanks": self._tanks})
        await self._publish("batches", "batch_update", {"batches": self._batches})
        await self._publish("equipment", "equipment_update", {"equipment": self._equipment})
        await self._publish("kpis", "kpi_update", {"kpis": self._kpis})

        if new_events:
            for ev in new_events:
                await self._publish("events", "new_event", ev)

    async def _generate_stochastic_event(self) -> dict | None:
        """Randomly generate a minor stochastic event."""
        event_types = [
            ("blend", "info", "Automatic viscosity check completed — within specification"),
            ("tank", "info", "Temperature sensor calibration triggered on tank group A"),
            ("equipment", "info", "Routine telemetry snapshot recorded"),
            ("quality", "info", "Background quality model updated with latest data"),
            ("supply", "info", "Inventory sync completed with warehouse system"),
        ]
        category, severity, message = random.choice(event_types)
        return {
            "category": category,
            "severity": severity,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "resolved": True,
        }

    async def inject_event(self, event_type: str, target_id: int | None = None) -> None:
        """Inject a simulation event."""
        now = datetime.now(timezone.utc)

        if event_type == "equipment_failure":
            target = None
            if target_id:
                target = next((e for e in self._equipment if e["id"] == target_id), None)
            if not target:
                running = [e for e in self._equipment if e["status"] != "failed"]
                target = random.choice(running) if running else None

            if target:
                target["health_pct"] = random.uniform(5.0, 14.0)
                target["status"] = "failed"
                message = f"CRITICAL: {target['name']} equipment failure detected. Health: {target['health_pct']:.1f}%. Immediate inspection required."
                await self._publish("events", "equipment_failure", {
                    "equipment": target,
                    "message": message,
                    "severity": "critical",
                    "timestamp": now.isoformat(),
                })
                await self._log_event_to_db("equipment", "critical", message)

        elif event_type == "material_shortage":
            target = None
            if target_id:
                target = next((t for t in self._tanks if t["id"] == target_id), None)
            if not target:
                target = random.choice(self._tanks) if self._tanks else None

            if target:
                target["current_level"] = random.uniform(0.04, 0.08)
                target["status"] = "critical"
                message = f"SHORTAGE: Tank {target['name']} material shortage — level dropped to {target['current_level']*100:.1f}%. Immediate resupply required."
                await self._publish("events", "material_shortage", {
                    "tank": target,
                    "message": message,
                    "severity": "critical",
                    "timestamp": now.isoformat(),
                })
                await self._log_event_to_db("tank", "critical", message)

        elif event_type == "quality_deviation":
            active = [b for b in self._batches if b["stage"] in ("mixing", "sampling")]
            target = None
            if target_id:
                target = next((b for b in active if b["id"] == target_id), None)
            if not target and active:
                target = random.choice(active)

            if target:
                alert_msg = f"Quality deviation: viscosity out of specification in batch {target['batch_id']} — off-spec risk elevated to {random.randint(65, 90)}%"
                if "alerts" not in target:
                    target["alerts"] = []
                target["alerts"].append(alert_msg)
                await self._publish("events", "quality_deviation", {
                    "batch": target,
                    "message": alert_msg,
                    "severity": "warning",
                    "timestamp": now.isoformat(),
                })
                await self._log_event_to_db("quality", "warning", alert_msg)

    def set_time_acceleration(self, factor: int) -> None:
        self.time_acceleration = factor

    async def _persist_state(self, stage_transitions: list, new_events: list) -> None:
        """Persist changed state to the database."""
        try:
            async with self.db_factory() as db:
                # Persist stage transitions
                for batch_id, new_stage in stage_transitions:
                    result = await db.execute(select(BlendBatch).where(BlendBatch.id == batch_id))
                    batch_obj = result.scalar_one_or_none()
                    if batch_obj:
                        batch_obj.stage = new_stage
                        batch_obj.progress_pct = next(
                            (b["progress_pct"] for b in self._batches if b["id"] == batch_id), batch_obj.progress_pct
                        )
                        if new_stage == "completed":
                            batch_obj.completed_at = datetime.now(timezone.utc)

                # Persist new events
                for ev in new_events:
                    if isinstance(ev, dict) and "message" in ev:
                        event_log = EventLog(
                            severity=ev.get("severity", "info"),
                            category=ev.get("category", "blend"),
                            message=ev["message"],
                            resolved=ev.get("resolved", False),
                        )
                        db.add(event_log)

                # Periodically persist tank and equipment state
                if self.tick_count % 30 == 0:
                    for tank_dict in self._tanks:
                        result = await db.execute(select(Tank).where(Tank.id == tank_dict["id"]))
                        tank_obj = result.scalar_one_or_none()
                        if tank_obj:
                            tank_obj.current_level = tank_dict["current_level"]
                            tank_obj.temperature_c = tank_dict["temperature_c"]
                            tank_obj.status = tank_dict["status"]

                    for equip_dict in self._equipment:
                        result = await db.execute(select(Equipment).where(Equipment.id == equip_dict["id"]))
                        equip_obj = result.scalar_one_or_none()
                        if equip_obj:
                            equip_obj.health_pct = equip_dict["health_pct"]
                            equip_obj.status = equip_dict["status"]

                await db.commit()
        except Exception as exc:
            print(f"[SimulationEngine] persist error: {exc!r}")

    async def _log_event_to_db(self, category: str, severity: str, message: str) -> None:
        """Directly log an event to DB."""
        try:
            async with self.db_factory() as db:
                event_log = EventLog(
                    severity=severity,
                    category=category,
                    message=message,
                    resolved=False,
                )
                db.add(event_log)
                await db.commit()
        except Exception as exc:
            print(f"[SimulationEngine] event log error: {exc!r}")

    async def _publish(self, channel: str, message_type: str, payload: dict) -> None:
        """Publish a message to a Redis pub/sub channel."""
        msg = {
            "channel": channel,
            "type": message_type,
            "payload": payload,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "tick": self.tick_count,
        }
        try:
            await self.redis.publish(channel, json.dumps(msg, default=str))
        except Exception as exc:
            print(f"[SimulationEngine] redis publish error on {channel}: {exc!r}")

    @staticmethod
    def _tank_to_dict(tank: Tank) -> dict:
        return {
            "id": tank.id,
            "name": tank.name,
            "material": tank.material,
            "capacity_liters": tank.capacity_liters,
            "current_level": tank.current_level,
            "temperature_c": tank.temperature_c,
            "status": tank.status,
            "position_x": tank.position_x,
            "position_y": tank.position_y,
        }

    @staticmethod
    def _batch_to_dict(batch: BlendBatch) -> dict:
        return {
            "id": batch.id,
            "batch_id": batch.batch_id,
            "recipe_id": batch.recipe_id,
            "stage": batch.stage,
            "temperature_c": batch.temperature_c,
            "mixing_speed_rpm": batch.mixing_speed_rpm,
            "progress_pct": batch.progress_pct,
            "volume_liters": batch.volume_liters,
            "alerts": batch.alerts or [],
            "started_at": batch.started_at.isoformat() if batch.started_at else None,
            "completed_at": batch.completed_at.isoformat() if batch.completed_at else None,
        }

    @staticmethod
    def _equip_to_dict(equip: Equipment) -> dict:
        return {
            "id": equip.id,
            "name": equip.name,
            "type": equip.type,
            "health_pct": equip.health_pct,
            "status": equip.status,
            "last_maintenance": equip.last_maintenance.isoformat() if equip.last_maintenance else None,
            "next_maintenance_due": equip.next_maintenance_due.isoformat() if equip.next_maintenance_due else None,
        }
