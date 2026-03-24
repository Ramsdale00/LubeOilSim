// Tank types
export type MaterialType = 'base_oil' | 'viscosity_modifier' | 'antioxidant' | 'detergent' | 'pour_point_depressant' | 'finished_product'
export type TankStatus = 'normal' | 'low' | 'critical' | 'filling' | 'draining' | 'offline'

export interface Tank {
  id: string
  name: string
  capacity_liters: number
  current_level_liters: number
  fill_percent: number
  material: MaterialType
  temperature_c: number
  status: TankStatus
  position_x: number
  position_y: number
  last_updated: string
  temp_history: number[]
}

// Blend types
export type BlendStage = 'queued' | 'mixing' | 'sampling' | 'lab' | 'completed' | 'failed'

export interface BlendBatch {
  id: string
  recipe_id: string
  recipe_name: string
  stage: BlendStage
  progress_percent: number
  temperature_c: number
  mixing_speed_rpm: number
  start_time: string
  estimated_end_time: string
  volume_liters: number
  priority: 'low' | 'normal' | 'high' | 'urgent'
  alerts: string[]
  ingredient_sequence: string[]
}

// Recipe types
export interface RecipeIngredients {
  base_oil: number
  viscosity_modifier: number
  antioxidant: number
  detergent: number
  pour_point_depressant: number
}

export interface Recipe {
  id: string
  name: string
  description: string
  ingredients: RecipeIngredients
  target_viscosity: number
  target_flash_point: number
  target_tbn: number
  quality_score: number
  cost_per_liter: number
  created_at: string
  status: 'draft' | 'approved' | 'production' | 'archived'
}

export interface QualityPrediction {
  viscosity: number
  viscosity_confidence: number
  flash_point: number
  flash_point_confidence: number
  tbn: number
  tbn_confidence: number
  off_spec_risk: number
  cost_per_liter: number
  timestamp: string
}

// Supplier / Brand types
export type QualityGrade = 'A+' | 'A' | 'B+' | 'B' | 'C'

export interface Supplier {
  id: string
  name: string
  material: MaterialType
  price_per_liter: number
  lead_time_days: number
  quality_grade: QualityGrade
  reliability_percent: number
  min_order_liters: number
  is_preferred: boolean
  region: string
}

export interface BrandProduct {
  id: string
  name: string
  material: MaterialType
  price_per_liter: number  // in INR
  lead_time_days: number
  quality_grade: QualityGrade
  min_order_liters: number
}

export interface Brand {
  id: string
  name: string
  region: string
  is_preferred: boolean
  reliability_percent: number
  products: BrandProduct[]
}

export interface OptimizationResult {
  recommended_mix: Array<{
    supplier_id: string
    supplier_name: string
    material: MaterialType
    volume_liters: number
    cost: number
    percentage: number
  }>
  total_cost_current: number
  total_cost_optimized: number
  savings_percent: number
  quality_impact: 'none' | 'minimal' | 'moderate' | 'significant'
  lead_time_days: number
}

// Equipment types
export interface Equipment {
  id: string
  name: string
  type: 'blender' | 'pump' | 'heat_exchanger' | 'filter' | 'lab_analyzer'
  health_percent: number
  status: 'running' | 'idle' | 'maintenance' | 'fault'
  last_maintenance: string
  next_maintenance: string
  run_hours: number
  alerts: string[]
}

// Event types
export type EventSeverity = 'info' | 'warning' | 'critical' | 'success'
export type EventType = 'equipment_failure' | 'material_shortage' | 'quality_deviation' | 'batch_complete' | 'maintenance_due' | 'supplier_update' | 'system'

export interface EventLog {
  id: string
  timestamp: string
  type: EventType
  severity: EventSeverity
  title: string
  message: string
  source: string
  acknowledged: boolean
}

// KPI types
export interface KPISnapshot {
  production_volume_liters: number
  cost_per_batch: number
  energy_kwh: number
  utilization_percent: number
  active_batches: number
  completed_batches_today: number
  quality_pass_rate: number
  timestamp: string
}

// Timeline types
export interface TimelineEntry {
  id: string
  batch_id: string
  batch_name: string
  start_time: string
  end_time: string
  stage: BlendStage
  color: string
}

// Heatmap types
export interface HeatmapCell {
  x: number
  y: number
  value: number
  label: string
}

// WebSocket message types
export type WSMessageType =
  | 'tank_update'
  | 'blend_update'
  | 'kpi_update'
  | 'event'
  | 'quality_update'
  | 'equipment_update'
  | 'simulation_tick'

export interface WSMessage {
  type: WSMessageType
  payload: unknown
  timestamp: string
}

// AI types
export interface AIResponse {
  id: string
  command: string
  response: string
  actions_taken: string[]
  timestamp: string
  processing_time_ms: number
}

export interface Scenario {
  id: string
  name: string
  description: string
  recipe_id: string
  parameters: {
    temperature: number
    mixing_speed: number
    ingredient_ratios: RecipeIngredients
  }
  results?: {
    viscosity: number
    flash_point: number
    tbn: number
    cost_per_liter: number
    off_spec_risk: number
  }
  status: 'configured' | 'running' | 'completed'
}
