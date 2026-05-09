'use strict';

class GameCamera {
  constructor(camera) {
    this.cam    = camera;
    this.angle  = 0; // yaw angle, used by controls for relative movement
    this._focus = new THREE.Vector3();
    this._ideal = new THREE.Vector3();
    this._lookAt = new THREE.Vector3();
  }

  update(humanPlayer, ball) {
    if (!humanPlayer || !ball) return;

    const pp = humanPlayer.mesh.position;
    const bp = ball.mesh.position;

    // Focus between player and ball (weighted toward player)
    this._focus.set(
      pp.x * 0.65 + bp.x * 0.35,
      0,
      pp.z * 0.65 + bp.z * 0.35
    );

    // Camera rides behind the player, slightly up
    const behind = new THREE.Vector3(
      Math.sin(humanPlayer.mesh.rotation.y),
      0,
      Math.cos(humanPlayer.mesh.rotation.y)
    ).multiplyScalar(16);

    this._ideal.set(
      this._focus.x + behind.x,
      14,
      this._focus.z + behind.z
    );

    // Lerp camera
    this.cam.position.lerp(this._ideal, 0.08);

    // Look at focus point slightly above ground
    this._lookAt.set(this._focus.x, 1.5, this._focus.z);
    this.cam.lookAt(this._lookAt);

    // Compute horizontal angle for relative joystick mapping
    this.angle = Math.atan2(
      this.cam.position.x - this._focus.x,
      this.cam.position.z - this._focus.z
    );
  }

  shake(intensity = 0.5, duration = 0.3) {
    this._shakeIntensity = intensity;
    this._shakeDuration  = duration;
    this._shakeTimer     = duration;
  }

  applyShake(dt) {
    if (!this._shakeTimer || this._shakeTimer <= 0) return;
    this._shakeTimer -= dt;
    const s = (this._shakeTimer / this._shakeDuration) * this._shakeIntensity;
    this.cam.position.x += (Math.random() - 0.5) * s;
    this.cam.position.y += (Math.random() - 0.5) * s;
  }
}
