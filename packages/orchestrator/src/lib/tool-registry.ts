import type { DependifyTool, DependifySkill, ToolRegistry } from '../types'
import type { MarketCode, ToolCategory } from '@dependify/config'

class ToolRegistryImpl implements ToolRegistry {
  private tools: Map<string, DependifyTool> = new Map()
  private skills: Map<string, DependifySkill> = new Map()

  register(tool: DependifyTool): void {
    if (this.tools.has(tool.id)) {
      console.warn(`[ToolRegistry] Tool ${tool.id} already registered — overwriting`)
    }
    this.tools.set(tool.id, tool)
    console.log(`[ToolRegistry] Registered tool: ${tool.id}`)
  }

  registerSkill(skill: DependifySkill): void {
    if (this.skills.has(skill.id)) {
      console.warn(`[ToolRegistry] Skill ${skill.id} already registered — overwriting`)
    }
    this.skills.set(skill.id, skill)
    console.log(`[ToolRegistry] Registered skill: ${skill.id}`)
  }

  getTool(id: string): DependifyTool | undefined {
    return this.tools.get(id)
  }

  getSkill(id: string): DependifySkill | undefined {
    return this.skills.get(id)
  }

  listTools(category?: ToolCategory): DependifyTool[] {
    const all = Array.from(this.tools.values())
    if (!category) return all
    return all.filter((t) => t.category === category)
  }

  listSkills(category?: ToolCategory): DependifySkill[] {
    const all = Array.from(this.skills.values())
    if (!category) return all
    return all.filter((s) => s.category === category)
  }

  getToolsForMarket(market: MarketCode): DependifyTool[] {
    return Array.from(this.tools.values()).filter((t) =>
      t.marketSupport.includes(market)
    )
  }

  // Returns tool definitions in the format Claude expects for tool_use
  toClaudeTools(): Array<{
    name: string
    description: string
    input_schema: Record<string, unknown>
  }> {
    const tools = Array.from(this.tools.values()).map((t) => ({
      name: t.id.replace(/\./g, '__'), // Claude tool names can't have dots
      description: `${t.name}: ${t.description}`,
      input_schema: {
        type: 'object' as const,
        ...t.inputSchema,
      },
    }))

    const skills = Array.from(this.skills.values()).map((s) => ({
      name: s.id.replace(/\./g, '__'),
      description: `[AI Skill] ${s.name}: ${s.description}`,
      input_schema: {
        type: 'object' as const,
        ...s.inputSchema,
      },
    }))

    return [...tools, ...skills]
  }

  get toolCount(): number {
    return this.tools.size
  }

  get skillCount(): number {
    return this.skills.size
  }
}

// Singleton registry
export const toolRegistry = new ToolRegistryImpl()
