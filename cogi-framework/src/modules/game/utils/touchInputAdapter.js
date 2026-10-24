export class TouchInputAdapter {
  constructor({ engine } = {}) {
    this.engine = engine
    this.bindings = new Map()
    this.pointerState = {
      left: new Set(),
      right: new Set(),
    }
  }

  bindButton(button, foot) {
    if (!button || !foot || !['left', 'right'].includes(foot)) return () => {}

    const onPointerDown = (event) => {
      if (event.pointerType === 'mouse' && typeof event.button === 'number' && event.button !== 0) return
      if (this.pointerState[foot].has(event.pointerId)) return
      event.preventDefault()
      this.pointerState[foot].add(event.pointerId)
      button.style.transform = 'scale(0.98)'
      button.style.filter = 'brightness(1.18)'
      button.style.boxShadow = '0 0 0 2px rgba(244,196,0,0.38)'
      this.engine?.handleTouchPress?.(foot, event)
    }

    const onPointerUp = (event) => {
      this.pointerState[foot].delete(event.pointerId)
      button.style.transform = 'none'
      button.style.filter = 'none'
      button.style.boxShadow = 'none'
      this.engine?.handleTouchRelease?.(foot, event.pointerId, event)
    }

    const onPointerCancel = (event) => {
      this.pointerState[foot].delete(event.pointerId)
      button.style.transform = 'none'
      button.style.filter = 'none'
      button.style.boxShadow = 'none'
      this.engine?.handleTouchCancel?.(foot, event.pointerId, event)
    }

    const onPointerLeave = (event) => {
      if (event.pointerType === 'mouse') {
        this.pointerState[foot].delete(event.pointerId)
        button.style.transform = 'none'
        button.style.filter = 'none'
        button.style.boxShadow = 'none'
        this.engine?.handleTouchRelease?.(foot, event.pointerId, event)
      }
    }

    button.addEventListener('pointerdown', onPointerDown, { passive: false, capture: true })
    button.addEventListener('pointerup', onPointerUp, { passive: false, capture: true })
    button.addEventListener('pointercancel', onPointerCancel, { passive: false, capture: true })
    button.addEventListener('pointerleave', onPointerLeave, { passive: false, capture: true })

    this.bindings.set(button, { foot, handlers: { onPointerDown, onPointerUp, onPointerCancel, onPointerLeave } })

    return () => {
      this.unbindButton(button)
    }
  }

  unbindButton(button) {
    const binding = this.bindings.get(button)
    if (!binding) return
    const { handlers } = binding
    button.style.transform = 'none'
    button.style.filter = 'none'
    button.style.boxShadow = 'none'
    button.removeEventListener('pointerdown', handlers.onPointerDown, { capture: true })
    button.removeEventListener('pointerup', handlers.onPointerUp, { capture: true })
    button.removeEventListener('pointercancel', handlers.onPointerCancel, { capture: true })
    button.removeEventListener('pointerleave', handlers.onPointerLeave, { capture: true })
    this.pointerState[binding.foot].clear()
    this.bindings.delete(button)
  }

  destroy() {
    for (const button of Array.from(this.bindings.keys())) {
      this.unbindButton(button)
    }
  }
}
