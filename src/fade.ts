export const fadeInIds: Set<string> = new Set()
export const fadeInStartTimes: Map<string, number> = new Map()
export const FADE_IN_DURATION = 1

// Spin-in: each new element gets extra spin speed that decays to 0
export const spinTargets: Map<string, { sx: number; sy: number }> = new Map()

export function addFadeIn(elementId: string): void {
  fadeInIds.add(elementId)
  spinTargets.set(elementId, {
    sx: 0.06 + Math.random() * 0.08,
    sy: 0.04 + Math.random() * 0.06,
  })
}
