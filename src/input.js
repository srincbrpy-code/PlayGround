const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
  KeyJ: 'strike', KeyZ: 'strike',
  KeyK: 'heavy', KeyX: 'heavy',
  KeyL: 'parry', KeyC: 'parry',
  ShiftLeft: 'dash', ShiftRight: 'dash',
  KeyS: 'guard', ArrowDown: 'guard',
  Digit1: 'spell1', Numpad1: 'spell1',
  Digit2: 'spell2', Numpad2: 'spell2',
  Digit3: 'spell3', Numpad3: 'spell3',
  Escape: 'pause', KeyP: 'pause',
  Enter: 'confirm',
}

const GAME_KEYS = new Set(Object.keys(KEYMAP))
const BLOCK_DEFAULT = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space',
  'ShiftLeft', 'ShiftRight', 'Digit1', 'Digit2', 'Digit3',
])

const ACTIONS = ['left', 'right', 'jump', 'strike', 'heavy', 'parry', 'dash', 'guard', 'spell1', 'spell2', 'spell3', 'pause', 'confirm']

export class Input {
  constructor(target = window) {
    this.target = target
    this.held = new Set()
    this.edges = new Set()
    this.released = new Set()
    this.enabled = true
    this.onFirstInput = null
    this._first = false
    this._down = this._down.bind(this)
    this._up = this._up.bind(this)
    this._blur = this._blur.bind(this)
    target.addEventListener('keydown', this._down, { passive: false })
    target.addEventListener('keyup', this._up)
    target.addEventListener('blur', this._blur)
    this.touchHeld = new Set()
    this.touchEdges = new Set()
  }

  _guard(event) {
    const tag = event.target?.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
  }

  _down(event) {
    if (this._guard(event)) return
    const action = KEYMAP[event.code]
    if (!action) return
    if (BLOCK_DEFAULT.has(event.code)) event.preventDefault()
    if (!this.enabled) return
    if (!event.repeat && !this.held.has(action)) {
      this.edges.add(action)
      this.touchEdges.add(action)
      if (!this._first) {
        this._first = true
        this.onFirstInput?.()
      }
    }
    this.held.add(action)
  }

  _up(event) {
    const action = KEYMAP[event.code]
    if (!action) return
    this.held.delete(action)
    this.released.add(action)
  }

  _blur() {
    this.held.clear()
    this.touchHeld.clear()
  }

  setTouch(action, down) {
    if (down) {
      if (!this.touchHeld.has(action)) {
        this.touchEdges.add(action)
        if (!this._first) {
          this._first = true
          this.onFirstInput?.()
        }
      }
      this.touchHeld.add(action)
    } else {
      this.touchHeld.delete(action)
    }
  }

  down(action) {
    return this.held.has(action) || this.touchHeld.has(action)
  }

  pressed(action) {
    return this.edges.has(action) || this.touchEdges.has(action)
  }

  releasedNow(action) {
    return this.released.has(action)
  }

  consume(action) {
    this.edges.delete(action)
    this.touchEdges.delete(action)
  }

  endFrame() {
    this.edges.clear()
    this.touchEdges.clear()
    this.released.clear()
  }

  clear() {
    this.held.clear()
    this.touchHeld.clear()
    this.edges.clear()
    this.touchEdges.clear()
    this.released.clear()
  }

  get axis() {
    return (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0)
  }

  dispose() {
    this.target.removeEventListener('keydown', this._down)
    this.target.removeEventListener('keyup', this._up)
    this.target.removeEventListener('blur', this._blur)
  }
}

export { KEYMAP, ACTIONS, GAME_KEYS }
