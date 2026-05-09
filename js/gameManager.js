'use strict';

class GameManager {
  constructor() {
    this.homeScore = 0; this.awayScore = 0;
    this.matchTime = 0; this.maxTime = 5 * 60;
    this.state = 'playing';
    this._resetTimer = 0;
    this._possession = 0.5;
    this.GOAL_W = 7.32; this.GOAL_H = 2.44;
    this.FL_HALF = 52.5; this.FW_HALF = 34;
  }

  init(players, ball) {
    this.players  = players; this.ball = ball;
    this.homeTeam = players.filter(p => p.team === 'home');
    this.awayTeam = players.filter(p => p.team === 'away');
    this.human    = players.find(p => p.isHuman);
  }

  update(dt, cam) {
    if (this.state === 'finished') return;
    if (this.state === 'goal') {
      this._resetTimer -= dt;
      if (this._resetTimer <= 0) { this.state = 'playing'; this._resetAll(); }
      return;
    }
    this.matchTime += dt;
    this._updateHUD();
    this._checkGoal(cam);
    this._checkBounds();
    this._updatePossession();
    if (this.matchTime >= this.maxTime) {
      this.state = 'finished';
      setTimeout(() => {
        const msg = this.homeScore > this.awayScore
          ? `GANASTE! ${this.homeScore} - ${this.awayScore}`
          : this.homeScore === this.awayScore
          ? `EMPATE ${this.homeScore} - ${this.awayScore}`
          : `PERDISTE ${this.homeScore} - ${this.awayScore}`;
        document.getElementById('message').textContent = msg;
      }, 300);
    }
  }

  _checkGoal(cam) {
    const bp = this.ball.getPosition();
    const inX = Math.abs(bp.x) < this.GOAL_W / 2;
    const inY = bp.y < this.GOAL_H + 0.3;
    if (bp.z < -this.FL_HALF && inX && inY) { this.homeScore++; this._onGoal('home', cam); }
    else if (bp.z > this.FL_HALF && inX && inY) { this.awayScore++; this._onGoal('away', cam); }
  }

  _onGoal(team, cam) {
    this.state = 'goal'; this._resetTimer = 3.5;
    document.getElementById('home-score').textContent = this.homeScore;
    document.getElementById('away-score').textContent = this.awayScore;
    this._showMessage(team === 'home' ? 'GOOOOOL!' : 'GOL DE LA CPU!');
    if (cam) cam.shake(1.5, 0.6);
    (team === 'home' ? this.homeTeam : this.awayTeam).forEach(p => p.celebrate());
  }

  _checkBounds() {
    const bp = this.ball.getPosition();
    if (Math.abs(bp.x) > this.FW_HALF + 3) {
      this.ball.reset(Math.sign(bp.x)*this.FW_HALF, Math.max(-this.FL_HALF+5, Math.min(this.FL_HALF-5, bp.z)));
    }
  }

  _updatePossession() {
    if (this.homeTeam.some(p => p.hasBall)) this._possession = this._possession*0.97;
    else if (this.awayTeam.some(p => p.hasBall)) this._possession = this._possession*0.97+0.03;
    document.getElementById('possession-home').style.width = ((1-this._possession)*100)+'%';
  }

  _resetAll() {
    this.ball.reset(0, 0);
    this._resetPositions();
  }

  _resetPositions() {
    const hP = [
      new THREE.Vector3(0,0,8), new THREE.Vector3(-9,0,18), new THREE.Vector3(9,0,18),
      new THREE.Vector3(-15,0,32), new THREE.Vector3(15,0,32), new THREE.Vector3(0,0,46)
    ];
    const aP = [
      new THREE.Vector3(0,0,-8), new THREE.Vector3(-9,0,-18), new THREE.Vector3(9,0,-18),
      new THREE.Vector3(-15,0,-32), new THREE.Vector3(15,0,-32), new THREE.Vector3(0,0,-46)
    ];
    this.homeTeam.forEach((p,i) => { if(hP[i]) p.reset(hP[i]); });
    this.awayTeam.forEach((p,i) => { if(aP[i]) p.reset(aP[i]); });
  }

  _updateHUD() {
    const rem = Math.max(0, this.maxTime - this.matchTime);
    const m = Math.floor(rem/60), s = Math.floor(rem%60);
    document.getElementById('timer').textContent = m.toString().padStart(2,'0')+':'+s.toString().padStart(2,'0');
  }

  _showMessage(msg) {
    const el = document.getElementById('message');
    el.textContent = msg;
    clearTimeout(this._mt);
    this._mt = setTimeout(() => { el.textContent = ''; }, 2800);
  }
}
