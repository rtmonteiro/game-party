import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type Stroke = { points: { x: number; y: number }[]; ts: number };

type Round = {
  id: string;
  item: string;
  answer: string;
  hints: string[];
  maxPhases: number;
  phase: number;
  buzzes: { name: string; time: number }[];
  finished: boolean;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnDestroy, AfterViewInit {
  @ViewChild('draw') drawRef!: ElementRef<HTMLCanvasElement>;

  name = localStorage.getItem('playerName') || '';
  canAnswer = false;
  position: number | null = null;
  allowedToAnswer = false;
  answerText = '';
  scoreboard: Array<{ name: string; score: number }> = [];
  round: Round | null = null;

  // admin UI
  adminMode = false;
  adminItem = '';
  adminAnswer = '';
  adminHints = '';
  adminMaxPhases = 3;

  private strokes: Stroke[] = [];
  private drawing = false;
  private activePoints: { x: number; y: number }[] = [];
  private raf = 0;
  private pollInterval?: ReturnType<typeof setInterval>;

  ngAfterViewInit() {
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    const canvas = this.drawRef.nativeElement;
    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e as PointerEvent));
    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e as PointerEvent));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e as PointerEvent));
    this.raf = requestAnimationFrame(() => this.renderLoop());
    this.startPolling();
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resizeCanvas.bind(this));
    window.removeEventListener('pointerup', this.onPointerUp.bind(this));
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  resizeCanvas() {
    const canvas = this.drawRef?.nativeElement;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }

  onPointerDown(e: PointerEvent) {
    this.drawing = true;
    this.activePoints = [{ x: e.clientX, y: e.clientY }];
  }

  onPointerMove(e: PointerEvent) {
    if (!this.drawing) return;
    this.activePoints.push({ x: e.clientX, y: e.clientY });
  }

  onPointerUp(_e: PointerEvent) {
    if (!this.drawing) return;
    this.drawing = false;
    this.strokes.push({ points: this.activePoints.slice(), ts: Date.now() });
    this.activePoints = [];
  }

  renderLoop() {
    const canvas = this.drawRef?.nativeElement;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const now = Date.now();
      // draw active
      if (this.activePoints.length) {
        ctx.beginPath();
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255,200,50,0.9)';
        ctx.moveTo(this.activePoints[0].x, this.activePoints[0].y);
        for (const p of this.activePoints) ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      // draw stored strokes with fade
      this.strokes = this.strokes.filter((s) => now - s.ts < 2000);
      for (const s of this.strokes) {
        const age = now - s.ts;
        const alpha = 1 - age / 2000;
        ctx.beginPath();
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(255,200,50,${alpha})`;
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (const p of s.points) ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    }
    this.raf = requestAnimationFrame(() => this.renderLoop());
  }

  saveName() {
    localStorage.setItem('playerName', this.name);
  }

  async buzz() {
    if (!this.name) return alert('Enter your name first');
    try {
      const r = await fetch('/api/buzz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: this.name }) });
      const j = await r.json();
      if (r.ok) {
        this.position = j.position;
        this.allowedToAnswer = !!j.canAnswer;
      } else {
        alert(j.error || 'buzz failed');
      }
    } catch (err) {
      console.error(err);
    }
  }

  async submitAnswer() {
    if (!this.name) return alert('enter name');
    try {
      const r = await fetch('/api/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: this.name, answer: this.answerText }) });
      const j = await r.json();
      if (r.ok) {
        if (j.correct) {
          alert('Correct! +' + j.points + ' points');
          this.allowedToAnswer = false;
          this.answerText = '';
          this.fetchScoreboard();
          this.fetchState();
        } else {
          alert('Incorrect');
        }
      } else {
        alert(j.error || 'answer failed');
      }
    } catch (err) {
      console.error(err);
    }
  }

  async fetchScoreboard() {
    try {
      const r = await fetch('/api/scoreboard');
      const j = await r.json();
      this.scoreboard = j.players || [];
    } catch (_e) {
      // Silently handle fetch errors
    }
  }

  async fetchState() {
    try {
      const r = await fetch('/api/state');
      const j = await r.json();
      this.round = j.round;
    } catch (_e) {
      // Silently handle fetch errors
    }
  }

  startPolling() {
    this.fetchScoreboard();
    this.fetchState();
    this.pollInterval = setInterval(() => {
      this.fetchScoreboard();
      this.fetchState();
    }, 1000);
  }

  async startRound() {
    try {
      const hints = this.adminHints.split('\n').map((s) => s.trim()).filter(Boolean);
      const body = { item: this.adminItem, answer: this.adminAnswer, hints, maxPhases: this.adminMaxPhases };
      const r = await fetch('/api/start-round', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (r.ok) {
        this.round = j.round;
        alert('Round started');
      } else {
        alert(j.error || 'start failed');
      }
    } catch (e) {
      console.error(e);
    }
  }

  async nextPhase() {
    try {
      const r = await fetch('/api/next-phase', { method: 'POST' });
      const j = await r.json();
      if (r.ok) {
        this.round = j.round;
        alert('Advanced to next phase');
      } else {
        alert(j.error || 'next phase failed');
      }
    } catch (e) {
      console.error(e);
    }
  }
}
