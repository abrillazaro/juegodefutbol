'use strict';

class GameManager {
  constructor() {
    this.homeScore = 0;
    this.awayScore = 0;
    this.matchTime = 0;
    this.maxTime   = 5 * 60; // 5-minute match
    this.state     = 'playing'; // playing | goal | finished
    this._resetTimer  = 0;
    this._possession  = 0.5; // 0 = home, 1 = away

    // Field limits
    this.GOAL_W = 7.32;
    this.GOAL_H = 2.44;
    this.FL_HALF = 52.5;
    this.FW_HALF = 34;
  }

  init(players, ball) {
    this.players   = players;
    this.ball      = ball;
    this.homeTeam  = players.filter(p => p.team === 'home');
    this.awayTeam  = players.filter(p => p.team === 'away');
    this.human     = players.find(p => p.isHuman);
  }

  update(dt, camShaker) {
    if (this.state === 'finished') return;

    if (this.state === 'goal') {
      this._resetTimer -= dt;
      if (this._resetTimer <= 0) {
        this.state = 'playing';
        this._resetAll();
      }
      return;
    }

    this.matchTime += dt;
    this._updateHUD();
    this._checkGoal(camShaker);
    this._checkOutOfBounds();
    this._updatePossession();

    if (this.matchTime >= this.maxTime) {
      this.state = 'finished';
      this._showMessage('¡FINAL DEL PARTIDO!');
      this._showFinalScore();
    }
  }

  _checkGoal(camShaker) {
    const bp = this.ball.getPosition();
    const inGoalX = Math.abs(bp.x) < this.GOAL_W / 2;
    const inGoalY = bp.y < this.GOAL_H + 0.3;

    // Top goal (z = -52.5) — home scores
    if (bp.z < -this.FL_HALF && inGoalX && inGoalY) {
      this.homeScore++;
      this._onGoal('home', camShaker);
    }
    // Bottom goal (z = +52.5) — away scores
    else if (bp.z > this.FL_HALF && inGoalX && inGoalY) {
      this.awayScore++;
      this._onGoal('away', camShaker);
    }
  }

  _onGoal(scoringTeam, camShaker) {
    this.state = 'goal';
    this._resetTimer = 3.5;

    document.getElementById('home-score').textContent = this.homeScore;
    document.getElementById('away-score').textContent = this.awayScore;

    const isHumanGoal = scoringTeam === 'home';
    this._showMessage(isHumanGoal ? '⚽ ¡GOOOOOL!' : '¡GOL DE LA CPU!');

    if (camShaker) camShaker.shake(1.5, 0.6);

    // Celebrate scoring team
    const scorers = scoringTeam === 'home' ? this.homeTeam : this.awayTeam;
    scorers.forEach(p => p.celebrate());
  }

  _checkOutOfBounds() {
    const bp = this.ball.getPosition();
    if (Math.abs(bp.x) > this.FW_HALF + 3) {
      // Throw in: reset ball to sideline
      this.ball.reset(Math.sign(bp.x) * this.FW_HALF, Math.max(-this.FL_HALF + 5, Math.min(this.FL_HALF - 5, bp.z)));
    }
  }

  _updatePossession() {
    const hp = this.homeTeam.some(p => p.hasBall);
    const ap = this.awayTeam.some(p => p.hasBall);
    if (hp) this._possession = this._possession * 0.97 + 0.0 * 0.03;
    if (ap) this._possession = this._possession * 0.97 + 1.0 * 0.03;
    document.getElementById('possession-home').style.width = ((1 - this._possession) * 100) + '%';
  }

  _resetAll() {
    this.ball.reset(0, 0);
    this._resetPositions();
  }

  _resetPositions() {
    const homePos = [
      new THREE.Vector3(0, 0, 8),
      new THREE.Vector3(-9, 0, 18), new THREE.Vector3(9, 0, 18),
      new THREE.Vector3(-15, 0, 33), new THREE.Vector3(15, 0, 33),
      new THREE.Vector3(0, 0, 45),
    ];
    const awayPos = [
      new THREE.Vector3(0, 0, -8),
      new THREE.Vector3(-9, 0, -18), new THREE.Vector3(9, 0, -18),
      new THREE.Vector3(-15, 0, -33), new THREE.Vector3(15, 0, -33),
      new THREE.Vector3(0, 0, -45),
    ];
    this.homeTeam.forEach((p, i) => { if (homePos[i]) p.reset(homePos[i]); });
    this.awayTeam.forEach((p, i) => { if (awayPos[i]) p.reset(awayPos[i]); });
  }

  _updateHUD() {
    const rem  = Math.max(0, this.maxTime - this.matchTime);
    const mins = Math.floor(rem / 60);
    const secs = Math.floor(rem % 60);
    document.getElementById('timer').textContent =
      mins.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0');
  }

  _showMessage(msg) {
    const el = document.getElementById('message');
    el.textContent = msg;
    clearTimeout(this._msgTimeout);
    this._msgTimeout = setTimeout(() => { el.textContent = ''; }, 2800);
  }

  _showFinalScore() {
    setTimeout(() => {
      const msg = this.homeScore > this.awayScore
        ? `¡GANASTE! ${this.homeScore} - ${this.awayScore} 🏆`
        : this.homeScore === this.awayScore
        ? `EMPATE ${this.homeScore} - ${this.awayScore}`
        : `PERDISTE ${this.homeScore} - ${this.awayScore}`;
      document.getElementById('message').textContent = msg;
    }, 300);
  }
}
