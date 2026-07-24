export const EDGE_SWIPE_ZONE = 24
const EDGE_SWIPE_AXIS_THRESHOLD = 8
const EDGE_SWIPE_OPEN_RATIO = 0.35
const EDGE_SWIPE_FLICK_DISTANCE = 48
const EDGE_SWIPE_FLICK_VELOCITY = 0.5

export type EdgeSwipeAxis = "pending" | "horizontal" | "vertical"

export type EdgeSwipeState = {
  startX: number
  startY: number
  currentX: number
  currentY: number
  startedAt: number
  currentAt: number
  width: number
  axis: EdgeSwipeAxis
}

export type EdgeSwipeStart = {
  x: number
  y: number
  at: number
  width: number
}

export type EdgeSwipePoint = {
  x: number
  y: number
  at: number
}

export function beginEdgeSwipe(input: EdgeSwipeStart): EdgeSwipeState | undefined {
  if (input.width <= 0 || input.x < 0 || input.x > EDGE_SWIPE_ZONE) return
  return {
    startX: input.x,
    startY: input.y,
    currentX: input.x,
    currentY: input.y,
    startedAt: input.at,
    currentAt: input.at,
    width: input.width,
    axis: "pending",
  }
}

export function updateEdgeSwipe(state: EdgeSwipeState, point: EdgeSwipePoint): EdgeSwipeState {
  const dx = point.x - state.startX
  const dy = point.y - state.startY
  let axis = state.axis

  if (axis === "pending" && Math.max(Math.abs(dx), Math.abs(dy)) >= EDGE_SWIPE_AXIS_THRESHOLD) {
    axis = dx > 0 && Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical"
  }

  return {
    ...state,
    currentX: point.x,
    currentY: point.y,
    currentAt: point.at,
    axis,
  }
}

export function edgeSwipeOffset(state: EdgeSwipeState) {
  if (state.axis === "vertical") return 0
  return Math.min(state.width, Math.max(0, state.currentX - state.startX))
}

export function edgeSwipeProgress(state: EdgeSwipeState) {
  return edgeSwipeOffset(state) / state.width
}

export function edgeSwipeShouldOpen(state: EdgeSwipeState) {
  if (state.axis !== "horizontal") return false
  const offset = edgeSwipeOffset(state)
  if (offset / state.width >= EDGE_SWIPE_OPEN_RATIO) return true
  const elapsed = Math.max(1, state.currentAt - state.startedAt)
  return offset >= EDGE_SWIPE_FLICK_DISTANCE && offset / elapsed >= EDGE_SWIPE_FLICK_VELOCITY
}
