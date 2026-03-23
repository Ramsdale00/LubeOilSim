import { useEffect } from 'react'
import { useWebSocket } from './useWebSocket'
import { useTankStore } from '@/store/tankStore'
import { useBlendStore } from '@/store/blendStore'
import { useDashboardStore } from '@/store/dashboardStore'
import { useQualityStore } from '@/store/qualityStore'
import type { WSMessage, Tank, BlendBatch, KPISnapshot, EventLog, QualityPrediction } from '@/types'

export function useSimulationSocket() {
  const { lastMessage, status } = useWebSocket<WSMessage>('simulation')
  const { updateTank } = useTankStore()
  const { updateBatch } = useBlendStore()
  const { setKPIs, appendEvent } = useDashboardStore()
  const { appendPrediction, setRisk } = useQualityStore()

  useEffect(() => {
    if (!lastMessage) return

    switch (lastMessage.type) {
      case 'tank_update': {
        const tank = lastMessage.payload as Partial<Tank> & { id: string }
        updateTank(tank.id, tank)
        break
      }
      case 'blend_update': {
        const batch = lastMessage.payload as Partial<BlendBatch> & { id: string }
        updateBatch(batch.id, batch)
        break
      }
      case 'kpi_update': {
        setKPIs(lastMessage.payload as KPISnapshot)
        break
      }
      case 'event': {
        appendEvent(lastMessage.payload as EventLog)
        break
      }
      case 'quality_update': {
        const payload = lastMessage.payload as QualityPrediction
        appendPrediction(payload)
        setRisk(payload.off_spec_risk)
        break
      }
      default:
        break
    }
  }, [lastMessage, updateTank, updateBatch, setKPIs, appendEvent, appendPrediction, setRisk])

  return { status }
}
