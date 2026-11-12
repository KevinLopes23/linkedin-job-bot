/** Escolhe o motor de nota (Gemini ou Claude local) conforme as configurações. */
import type { Settings } from '../../shared/types'
import type { Scorer } from '../scan/scanService'
import { ClaudeLocalScorer } from './claudeLocal'
import { GeminiClient } from './gemini'

/** null = Gemini escolhido mas sem chave (a varredura segue sem nota). */
export function createScorer(settings: Settings, getGeminiKey: () => string | null): Scorer | null {
  if (settings.aiEngine === 'claude') return new ClaudeLocalScorer(settings.claudeModel)
  const key = getGeminiKey()
  if (!key) return null
  return new GeminiClient(key, settings.geminiModel)
}
