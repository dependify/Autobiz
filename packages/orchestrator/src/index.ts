export { orchestrator, DependifyOrchestrator } from './orchestrator'
export { toolRegistry } from './lib/tool-registry'
export type {
  TenantContext,
  OrchestratorInput,
  OrchestratorResult,
  DependifyTool,
  DependifySkill,
  ConversationMessage,
  IntentCategory,
  ClassifiedIntent,
} from './types'

// Auto-register built-in skills on import
import { toolRegistry } from './lib/tool-registry'
import { contentSkills } from './skills/content'
import { crmSkills } from './skills/crm'

for (const skill of [...contentSkills, ...crmSkills]) {
  toolRegistry.registerSkill(skill)
}
