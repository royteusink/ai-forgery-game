export const fadeInIds: Set<string> = new Set()
export const fadeInStartTimes: Map<string, number> = new Map()
export const FADE_IN_DURATION = 1

// Spin-in: each new element gets a random target rotation and high initial spin speed
export const spinTargets: Map<string, { rx: number; ry: number }> = new Map()

export function addFadeIn(elementId: string): void {
  fadeInIds.add(elementId)
  spinTargets.set(elementId, {
    rx: Math.random() * Math.PI * 4 + Math.PI * 2,
    ry: Math.random() * Math.PI * 4 + Math.PI * 2,
  })
}
