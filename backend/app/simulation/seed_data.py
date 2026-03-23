import random
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.tank import Tank
from app.models.blend_batch import BlendBatch
from app.models.recipe import Recipe
from app.models.supplier import Supplier
from app.models.equipment import Equipment
from app.models.event_log import EventLog


async def seed_database(db: AsyncSession) -> None:
    """Seed database with realistic dummy data if tables are empty."""
    result = await db.execute(select(func.count()).select_from(Tank))
    tank_count = result.scalar()
    if tank_count and tank_count > 0:
        return

    now = datetime.now(timezone.utc)

    # --- Recipes ---
    recipes_data = [
        {
            "name": "SAE 10W-40",
            "base_oil_pct": 74.0,
            "viscosity_modifier_pct": 9.5,
            "antioxidant_pct": 3.5,
            "detergent_pct": 5.0,
            "pour_point_depressant_pct": 2.0,
            "predicted_viscosity": 96.5,
            "predicted_flash_point": 218.0,
            "predicted_tbn": 9.2,
            "cost_per_liter": 1.85,
            "quality_score": 88.0,
        },
        {
            "name": "SAE 15W-50",
            "base_oil_pct": 72.0,
            "viscosity_modifier_pct": 11.0,
            "antioxidant_pct": 3.0,
            "detergent_pct": 6.0,
            "pour_point_depressant_pct": 2.5,
            "predicted_viscosity": 108.0,
            "predicted_flash_point": 222.0,
            "predicted_tbn": 10.1,
            "cost_per_liter": 1.98,
            "quality_score": 85.5,
        },
        {
            "name": "SAE 5W-30",
            "base_oil_pct": 76.0,
            "viscosity_modifier_pct": 8.0,
            "antioxidant_pct": 4.0,
            "detergent_pct": 4.5,
            "pour_point_depressant_pct": 1.5,
            "predicted_viscosity": 89.0,
            "predicted_flash_point": 210.0,
            "predicted_tbn": 8.5,
            "cost_per_liter": 1.92,
            "quality_score": 91.0,
        },
        {
            "name": "SAE 20W-50",
            "base_oil_pct": 70.0,
            "viscosity_modifier_pct": 13.0,
            "antioxidant_pct": 2.5,
            "detergent_pct": 7.0,
            "pour_point_depressant_pct": 3.0,
            "predicted_viscosity": 115.0,
            "predicted_flash_point": 228.0,
            "predicted_tbn": 10.8,
            "cost_per_liter": 1.75,
            "quality_score": 82.0,
        },
        {
            "name": "SAE 10W-30",
            "base_oil_pct": 75.0,
            "viscosity_modifier_pct": 7.5,
            "antioxidant_pct": 3.8,
            "detergent_pct": 4.8,
            "pour_point_depressant_pct": 1.8,
            "predicted_viscosity": 92.0,
            "predicted_flash_point": 214.0,
            "predicted_tbn": 8.9,
            "cost_per_liter": 1.80,
            "quality_score": 89.0,
        },
        {
            "name": "Hydraulic ISO 46",
            "base_oil_pct": 78.0,
            "viscosity_modifier_pct": 6.0,
            "antioxidant_pct": 5.0,
            "detergent_pct": 3.0,
            "pour_point_depressant_pct": 1.0,
            "predicted_viscosity": 88.5,
            "predicted_flash_point": 215.0,
            "predicted_tbn": 7.2,
            "cost_per_liter": 1.70,
            "quality_score": 87.5,
        },
        {
            "name": "Gear Oil 80W-90",
            "base_oil_pct": 68.0,
            "viscosity_modifier_pct": 15.0,
            "antioxidant_pct": 2.0,
            "detergent_pct": 8.0,
            "pour_point_depressant_pct": 3.5,
            "predicted_viscosity": 118.0,
            "predicted_flash_point": 230.0,
            "predicted_tbn": 7.5,
            "cost_per_liter": 1.95,
            "quality_score": 80.0,
        },
        {
            "name": "Turbine Oil 32",
            "base_oil_pct": 82.0,
            "viscosity_modifier_pct": 4.0,
            "antioxidant_pct": 6.0,
            "detergent_pct": 2.0,
            "pour_point_depressant_pct": 0.5,
            "predicted_viscosity": 85.0,
            "predicted_flash_point": 225.0,
            "predicted_tbn": 6.8,
            "cost_per_liter": 2.10,
            "quality_score": 93.0,
        },
        {
            "name": "Compressor Oil 46",
            "base_oil_pct": 79.0,
            "viscosity_modifier_pct": 5.5,
            "antioxidant_pct": 5.5,
            "detergent_pct": 3.5,
            "pour_point_depressant_pct": 1.2,
            "predicted_viscosity": 90.0,
            "predicted_flash_point": 220.0,
            "predicted_tbn": 7.8,
            "cost_per_liter": 2.05,
            "quality_score": 90.0,
        },
        {
            "name": "Transformer Oil",
            "base_oil_pct": 85.0,
            "viscosity_modifier_pct": 2.0,
            "antioxidant_pct": 7.0,
            "detergent_pct": 1.5,
            "pour_point_depressant_pct": 0.3,
            "predicted_viscosity": 86.0,
            "predicted_flash_point": 235.0,
            "predicted_tbn": 6.5,
            "cost_per_liter": 2.20,
            "quality_score": 95.0,
        },
    ]

    recipe_objs = []
    for r in recipes_data:
        recipe = Recipe(**r)
        db.add(recipe)
        recipe_objs.append(recipe)
    await db.flush()

    # --- Tanks ---
    materials = [
        "SN150 Base Oil",
        "SN500 Base Oil",
        "PAO 6",
        "Viscosity Modifier",
        "Antioxidant Package",
        "Detergent Additive",
        "Pour Point Depressant",
        "Hydraulic Base",
    ]

    tank_grid = [
        (100, 100), (250, 100), (400, 100), (550, 100),
        (100, 250), (250, 250), (400, 250), (550, 250),
        (100, 400), (250, 400), (400, 400), (550, 400),
    ]

    tank_data = [
        {"name": "T-101", "material": "SN150 Base Oil", "capacity_liters": 80000, "current_level": 0.82, "temperature_c": 62.0, "status": "normal"},
        {"name": "T-102", "material": "SN500 Base Oil", "capacity_liters": 80000, "current_level": 0.71, "temperature_c": 65.0, "status": "normal"},
        {"name": "T-103", "material": "PAO 6", "capacity_liters": 50000, "current_level": 0.58, "temperature_c": 55.0, "status": "normal"},
        {"name": "T-104", "material": "Viscosity Modifier", "capacity_liters": 30000, "current_level": 0.45, "temperature_c": 48.0, "status": "normal"},
        {"name": "T-105", "material": "SN150 Base Oil", "capacity_liters": 80000, "current_level": 0.90, "temperature_c": 63.0, "status": "normal"},
        {"name": "T-106", "material": "Antioxidant Package", "capacity_liters": 20000, "current_level": 0.67, "temperature_c": 50.0, "status": "normal"},
        {"name": "T-107", "material": "Detergent Additive", "capacity_liters": 25000, "current_level": 0.40, "temperature_c": 52.0, "status": "low"},
        {"name": "T-108", "material": "Pour Point Depressant", "capacity_liters": 15000, "current_level": 0.55, "temperature_c": 46.0, "status": "normal"},
        {"name": "T-109", "material": "SN500 Base Oil", "capacity_liters": 80000, "current_level": 0.78, "temperature_c": 68.0, "status": "normal"},
        {"name": "T-110", "material": "Hydraulic Base", "capacity_liters": 60000, "current_level": 0.62, "temperature_c": 58.0, "status": "normal"},
        {"name": "T-111", "material": "PAO 6", "capacity_liters": 50000, "current_level": 0.88, "temperature_c": 57.0, "status": "normal"},
        {"name": "T-112", "material": "Viscosity Modifier", "capacity_liters": 30000, "current_level": 0.12, "temperature_c": 49.0, "status": "critical"},
    ]

    for i, td in enumerate(tank_data):
        pos = tank_grid[i]
        tank = Tank(
            name=td["name"],
            material=td["material"],
            capacity_liters=td["capacity_liters"],
            current_level=td["current_level"],
            temperature_c=td["temperature_c"],
            status=td["status"],
            position_x=float(pos[0]),
            position_y=float(pos[1]),
        )
        db.add(tank)
    await db.flush()

    # --- Blend Batches ---
    recipe_ids = [r.id for r in recipe_objs]
    batch_data = [
        {"batch_id": "B-2024-001", "stage": "queued", "temperature_c": 0.0, "mixing_speed_rpm": 0.0, "progress_pct": 0.0, "volume_liters": 12000, "alerts": []},
        {"batch_id": "B-2024-002", "stage": "queued", "temperature_c": 0.0, "mixing_speed_rpm": 0.0, "progress_pct": 0.0, "volume_liters": 8000, "alerts": []},
        {"batch_id": "B-2024-003", "stage": "mixing", "temperature_c": 78.0, "mixing_speed_rpm": 125.0, "progress_pct": 30.0, "volume_liters": 15000, "alerts": [], "started_at": now - timedelta(hours=1)},
        {"batch_id": "B-2024-004", "stage": "mixing", "temperature_c": 82.0, "mixing_speed_rpm": 140.0, "progress_pct": 65.0, "volume_liters": 10000, "alerts": [], "started_at": now - timedelta(hours=2, minutes=30)},
        {"batch_id": "B-2024-005", "stage": "sampling", "temperature_c": 75.0, "mixing_speed_rpm": 60.0, "progress_pct": 78.0, "volume_liters": 9000, "alerts": ["Sampling in progress"], "started_at": now - timedelta(hours=4)},
        {"batch_id": "B-2024-006", "stage": "lab", "temperature_c": 70.0, "mixing_speed_rpm": 0.0, "progress_pct": 88.0, "volume_liters": 11000, "alerts": ["Lab analysis running"], "started_at": now - timedelta(hours=6)},
        {"batch_id": "B-2024-007", "stage": "completed", "temperature_c": 72.0, "mixing_speed_rpm": 0.0, "progress_pct": 100.0, "volume_liters": 14000, "alerts": [], "started_at": now - timedelta(hours=10), "completed_at": now - timedelta(hours=2)},
        {"batch_id": "B-2024-008", "stage": "failed", "temperature_c": 0.0, "mixing_speed_rpm": 0.0, "progress_pct": 42.0, "volume_liters": 7500, "alerts": ["Viscosity out of spec", "Batch aborted"], "started_at": now - timedelta(hours=8), "completed_at": now - timedelta(hours=6)},
    ]

    for i, bd in enumerate(batch_data):
        batch = BlendBatch(
            batch_id=bd["batch_id"],
            recipe_id=recipe_ids[i % len(recipe_ids)],
            stage=bd["stage"],
            temperature_c=bd["temperature_c"],
            mixing_speed_rpm=bd["mixing_speed_rpm"],
            progress_pct=bd["progress_pct"],
            volume_liters=bd["volume_liters"],
            alerts=bd["alerts"],
            started_at=bd.get("started_at"),
            completed_at=bd.get("completed_at"),
        )
        db.add(batch)
    await db.flush()

    # --- Suppliers ---
    suppliers_data = [
        {"name": "PetroSupply Co.", "material": "SN150 Base Oil", "price_per_liter": 0.85, "lead_time_days": 5, "quality_grade": "A", "reliability_score": 0.96, "is_preferred": True},
        {"name": "BaseChem Industries", "material": "SN500 Base Oil", "price_per_liter": 0.92, "lead_time_days": 7, "quality_grade": "A", "reliability_score": 0.93, "is_preferred": True},
        {"name": "ChemTrade Global", "material": "PAO 6", "price_per_liter": 2.45, "lead_time_days": 10, "quality_grade": "A", "reliability_score": 0.91, "is_preferred": False},
        {"name": "AddPak Solutions", "material": "Viscosity Modifier", "price_per_liter": 1.65, "lead_time_days": 6, "quality_grade": "B", "reliability_score": 0.88, "is_preferred": False},
        {"name": "LubriChem Direct", "material": "SN150 Base Oil", "price_per_liter": 0.78, "lead_time_days": 14, "quality_grade": "B", "reliability_score": 0.82, "is_preferred": False},
        {"name": "Apex Additives Ltd.", "material": "Antioxidant Package", "price_per_liter": 3.20, "lead_time_days": 8, "quality_grade": "A", "reliability_score": 0.95, "is_preferred": True},
    ]

    for sd in suppliers_data:
        supplier = Supplier(**sd)
        db.add(supplier)
    await db.flush()

    # --- Equipment ---
    equipment_data = [
        {"name": "Blender B1", "type": "Blender", "health_pct": 92.0, "status": "running", "last_maintenance": now - timedelta(days=30), "next_maintenance_due": now + timedelta(days=60)},
        {"name": "Blender B2", "type": "Blender", "health_pct": 87.0, "status": "running", "last_maintenance": now - timedelta(days=45), "next_maintenance_due": now + timedelta(days=45)},
        {"name": "Blender B3", "type": "Blender", "health_pct": 62.0, "status": "warning", "last_maintenance": now - timedelta(days=80), "next_maintenance_due": now + timedelta(days=10)},
        {"name": "Pump P-01", "type": "Pump", "health_pct": 95.0, "status": "running", "last_maintenance": now - timedelta(days=15), "next_maintenance_due": now + timedelta(days=75)},
        {"name": "Pump P-02", "type": "Pump", "health_pct": 41.0, "status": "warning", "last_maintenance": now - timedelta(days=90), "next_maintenance_due": now + timedelta(days=5)},
        {"name": "Heat Exchanger HX-1", "type": "Heat Exchanger", "health_pct": 78.0, "status": "running", "last_maintenance": now - timedelta(days=60), "next_maintenance_due": now + timedelta(days=30)},
        {"name": "Filtration Unit F-1", "type": "Filter", "health_pct": 88.0, "status": "idle", "last_maintenance": now - timedelta(days=20), "next_maintenance_due": now + timedelta(days=70)},
        {"name": "Mixing Tank MT-1", "type": "Mixing Tank", "health_pct": 99.0, "status": "running", "last_maintenance": now - timedelta(days=10), "next_maintenance_due": now + timedelta(days=80)},
    ]

    for ed in equipment_data:
        equip = Equipment(**ed)
        db.add(equip)
    await db.flush()

    # --- Event Logs (50 historical events) ---
    categories = ["blend", "tank", "equipment", "quality", "supply"]
    severities = ["info", "info", "info", "warning", "warning", "critical"]

    event_templates = [
        ("blend", "info", "Batch {batch} started successfully with volume {vol}L"),
        ("blend", "info", "Batch {batch} progressed to sampling stage"),
        ("blend", "warning", "Batch {batch} temperature deviation detected: {temp}°C"),
        ("blend", "critical", "Batch {batch} viscosity out of specification"),
        ("blend", "info", "Batch {batch} completed — quality approved"),
        ("tank", "info", "Tank {tank} refilled to {level}% capacity"),
        ("tank", "warning", "Tank {tank} level below 20% — reorder required"),
        ("tank", "critical", "Tank {tank} critically low: {level}% remaining"),
        ("tank", "info", "Tank {tank} temperature stabilized at {temp}°C"),
        ("equipment", "info", "Scheduled maintenance completed on {equip}"),
        ("equipment", "warning", "{equip} health degraded to {health}%"),
        ("equipment", "critical", "{equip} failure detected — switching to standby"),
        ("equipment", "info", "{equip} resumed normal operation"),
        ("quality", "info", "Quality prediction updated — off-spec risk: {risk}%"),
        ("quality", "warning", "Flash point prediction below threshold for batch {batch}"),
        ("quality", "critical", "TBN out of specification — batch {batch} flagged"),
        ("quality", "info", "Lab results confirmed — batch {batch} passed"),
        ("supply", "info", "Purchase order confirmed from {supplier}"),
        ("supply", "warning", "Lead time extended: {supplier} delivery delayed by {days} days"),
        ("supply", "info", "Price update received from {supplier}: ${price}/L"),
    ]

    batches = ["B-2024-001", "B-2024-002", "B-2024-003", "B-2024-004", "B-2024-005"]
    tanks = ["T-101", "T-102", "T-107", "T-112"]
    equips = ["Blender B1", "Blender B3", "Pump P-02", "Heat Exchanger HX-1"]
    suppliers_list = ["PetroSupply Co.", "BaseChem Industries", "ChemTrade Global"]

    rng = random.Random(42)
    for i in range(50):
        template_cat, template_sev, template_msg = rng.choice(event_templates)
        msg = template_msg.format(
            batch=rng.choice(batches),
            vol=rng.randint(8000, 15000),
            temp=round(rng.uniform(72.0, 88.0), 1),
            tank=rng.choice(tanks),
            level=rng.randint(8, 95),
            equip=rng.choice(equips),
            health=rng.randint(25, 70),
            risk=rng.randint(5, 45),
            supplier=rng.choice(suppliers_list),
            days=rng.randint(1, 5),
            price=round(rng.uniform(0.75, 2.50), 2),
        )
        hours_ago = rng.uniform(0, 72)
        event = EventLog(
            timestamp=now - timedelta(hours=hours_ago),
            severity=template_sev,
            category=template_cat,
            message=msg,
            resolved=rng.random() > 0.3,
        )
        db.add(event)

    await db.commit()
