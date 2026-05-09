'use strict';

class Ball {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.radius = 0.22;
    this.mesh = null;
    this.body = null;
  }

  create() {
    // Procedural football texture
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = 256;
    const ctx = cvs.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#111111';
    // Pentagon-like patches
    const patches = [
      [128,128], [128,58], [190,100], [190,158], [128,198], [66,158], [66,100],
      [200,30],  [56,30],  [220,200], [36,200]
    ];
    patches.forEach(([px, py]) => {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2 / 5) - Math.PI / 2;
        const x = px + 22 * Math.cos(a);
        const y = py + 22 * Math.sin(a);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    });
    const tex = new THREE.CanvasTexture(cvs);

    const geo = new THREE.SphereGeometry(this.radius, 20, 20);
    const mat = new THREE.MeshPhongMaterial({ map: tex, shininess: 60 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.scene.add(this.mesh);

    // Shadow blob
    const shadowGeo = new THREE.CircleGeometry(this.radius * 0.9, 12);
    this._shadow = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }));
    this._shadow.rotation.x = -Math.PI / 2;
    this._shadow.position.y = 0.005;
    this.scene.add(this._shadow);

    // Physics
    const groundMat = new CANNON.Material();
    const ballMat   = new CANNON.Material();
    const contact   = new CANNON.ContactMaterial(groundMat, ballMat, { friction: 0.4, restitution: 0.65 });
    this.world.addContactMaterial(contact);

    this.body = new CANNON.Body({
      mass: 0.43,
      material: ballMat,
      linearDamping: 0.25,
      angularDamping: 0.35
    });
    this.body.addShape(new CANNON.Sphere(this.radius));
    this.world.addBody(this.body);
  }

  reset(x = 0, z = 0) {
    this.body.position.set(x, this.radius + 0.05, z);
    this.body.velocity.setZero();
    this.body.angularVelocity.setZero();
  }

  shoot(dir, power) {
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
    this.body.applyImpulse(new CANNON.Vec3(
      dir.x * power,
      power * 0.38,
      dir.z * power
    ));
  }

  applyImpulse(dir, power) {
    this.body.applyImpulse(new CANNON.Vec3(
      dir.x * power,
      power * 0.2,
      dir.z * power
    ));
  }

  getPosition() {
    return this.body.position;
  }

  getVelocity() {
    return this.body.velocity;
  }

  update() {
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);

    // Shadow follows ball on ground
    const h = this.body.position.y - this.radius;
    const shadowScale = Math.max(0.2, 1 - h * 0.15);
    this._shadow.position.set(this.body.position.x, 0.005, this.body.position.z);
    this._shadow.scale.setScalar(shadowScale);
    this._shadow.material.opacity = Math.max(0.05, 0.35 * shadowScale);

    // Clamp x within sidelines
    const maxX = 34;
    if (Math.abs(this.body.position.x) > maxX) {
      this.body.velocity.x *= -0.6;
      this.body.position.x = Math.sign(this.body.position.x) * maxX;
    }
    // Reset if ball falls through
    if (this.body.position.y < -5) this.reset();
  }
}
