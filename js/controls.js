'use strict';

class TouchControls {
  constructor() {
    this.joystick = { x: 0, y: 0, active: false };
    this.buttons = { pass: false, shoot: false, trick: false, sprint: false };
    this._callbacks = {};
    this._joystickTouchId = null;
    this._joystickCenter = { x: 0, y: 0 };
    this._joystickRadius = 50;
    this._joystickInner = null;
    this._keys = {};
  }

  init() {
    this._joystickInner = document.getElementById('joystick-inner');
    const zone = document.getElementById('joystick-zone');

    zone.addEventListener('touchstart',  this._onJStart.bind(this),  { passive: false });
    zone.addEventListener('touchmove',   this._onJMove.bind(this),   { passive: false });
    zone.addEventListener('touchend',    this._onJEnd.bind(this),    { passive: false });
    zone.addEventListener('touchcancel', this._onJEnd.bind(this),    { passive: false });

    this._setupBtn('btn-pass',   'pass');
    this._setupBtn('btn-shoot',  'shoot');
    this._setupBtn('btn-trick',  'trick');
    this._setupBtn('btn-sprint', 'sprint');

    window.addEventListener('keydown', this._onKeyDown.bind(this));
    window.addEventListener('keyup',   this._onKeyUp.bind(this));
  }

  _setupBtn(id, action) {
    const btn = document.getElementById(id);
    const press   = () => { this.buttons[action] = true;  if (this._callbacks[action]) this._callbacks[action](true);  };
    const release = () => { this.buttons[action] = false; if (this._callbacks[action]) this._callbacks[action](false); };
    btn.addEventListener('touchstart',  (e) => { e.preventDefault(); press();   }, { passive: false });
    btn.addEventListener('touchend',    (e) => { e.preventDefault(); release(); }, { passive: false });
    btn.addEventListener('touchcancel', (e) => { e.preventDefault(); release(); }, { passive: false });
    btn.addEventListener('mousedown',  press);
    btn.addEventListener('mouseup',    release);
    btn.addEventListener('mouseleave', release);
  }

  _onKeyDown(e) {
    this._keys[e.code] = true;
    const map = { Space: 'shoot', KeyX: 'pass', KeyZ: 'trick', ShiftLeft: 'sprint' };
    if (map[e.code]) { this.buttons[map[e.code]] = true; if (this._callbacks[map[e.code]]) this._callbacks[map[e.code]](true); }
  }

  _onKeyUp(e) {
    this._keys[e.code] = false;
    const map = { Space: 'shoot', KeyX: 'pass', KeyZ: 'trick', ShiftLeft: 'sprint' };
    if (map[e.code]) { this.buttons[map[e.code]] = false; if (this._callbacks[map[e.code]]) this._callbacks[map[e.code]](false); }
  }

  update() {
    if (!this._joystickTouchId) {
      let kx = 0, ky = 0;
      if (this._keys['ArrowLeft']  || this._keys['KeyA']) kx = -1;
      if (this._keys['ArrowRight'] || this._keys['KeyD']) kx =  1;
      if (this._keys['ArrowUp']    || this._keys['KeyW']) ky = -1;
      if (this._keys['ArrowDown']  || this._keys['KeyS']) ky =  1;
      const len = Math.sqrt(kx*kx + ky*ky);
      if (len > 0) {
        this.joystick.x = kx / len;
        this.joystick.y = ky / len;
        this.joystick.active = true;
      } else {
        this.joystick.x = 0;
        this.joystick.y = 0;
        this.joystick.active = false;
      }
    }
  }

  _onJStart(e) {
    e.preventDefault();
    const touch = e.changedTouches[0];
    this._joystickTouchId = touch.identifier;
    const rect = document.getElementById('joystick-outer').getBoundingClientRect();
    this._joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    this._joystickRadius = (rect.width / 2) - 5;
    this._updateJoystick(touch.clientX, touch.clientY);
  }

  _onJMove(e) {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      if (touch.identifier === this._joystickTouchId) {
        this._updateJoystick(touch.clientX, touch.clientY);
      }
    }
  }

  _onJEnd(e) {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      if (touch.identifier === this._joystickTouchId) {
        this._joystickTouchId = null;
        this.joystick.x = 0;
        this.joystick.y = 0;
        this.joystick.active = false;
        this._joystickInner.style.transform = 'translate(-50%, -50%)';
      }
    }
  }

  _updateJoystick(cx, cy) {
    const dx = cx - this._joystickCenter.x;
    const dy = cy - this._joystickCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clamped = Math.min(dist, this._joystickRadius);
    const angle = Math.atan2(dy, dx);
    const nx = Math.cos(angle) * clamped;
    const ny = Math.sin(angle) * clamped;
    this.joystick.x = nx / this._joystickRadius;
    this.joystick.y = ny / this._joystickRadius;
    this.joystick.active = true;
    this._joystickInner.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
  }

  on(action, cb) {
    this._callbacks[action] = cb;
  }
}
