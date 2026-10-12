import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Subscription, interval } from 'rxjs';

interface Ticket { id: string; status: string; desk?: number; created_at: string; }
interface Desk { id: number; status: 'disponible' | 'ocupada'; ticket: string | null; last_ticket: string | null; }
interface QueueState { next_number: number; queue: Ticket[]; desks: Desk[]; }

@Component({
  selector: 'app-root', standalone: true, imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private timer?: Subscription;
  private lastCalls = new Map<number, string | null>();
  state: QueueState = { next_number: 1, queue: [], desks: [] };
  loading = true;
  busyAction = false;
  error = '';
  success = '';
  newTicket = '';
  isScreen = window.location.pathname.startsWith('/pantalla');
  now = new Date();

  ngOnInit(): void {
    this.refresh(false);
    this.timer = interval(1800).subscribe(() => {
      this.now = new Date();
      this.refresh(true);
    });
  }

  ngOnDestroy(): void { this.timer?.unsubscribe(); }

  refresh(silent: boolean): void {
    this.http.get<QueueState>('/api/state').subscribe({
      next: (state) => {
        if (this.isScreen && !silent) this.lastCalls.clear();
        if (this.isScreen && silent) {
          for (const desk of state.desks ?? []) {
            const previous = this.lastCalls.get(desk.id);
            if (desk.ticket && previous !== desk.ticket) this.announce(desk.ticket, desk.id);
          }
        }
        for (const desk of state.desks ?? []) this.lastCalls.set(desk.id, desk.ticket);
        this.state = state;
        this.loading = false;
        if (!silent) this.error = '';
      },
      error: () => { this.loading = false; if (!silent) this.error = 'No se pudo conectar con el sistema de turnos.'; }
    });
  }

  createTicket(): void {
    this.busyAction = true; this.error = ''; this.success = '';
    this.http.post<{ ticket: Ticket; state: QueueState }>('/api/tickets', {}).subscribe({
      next: (result) => { this.state = result.state; this.newTicket = result.ticket.id; this.success = 'Tu turno está listo. Conserva este número.'; this.busyAction = false; },
      error: (err) => { this.error = err.error?.error ?? 'No se pudo generar el turno.'; this.busyAction = false; }
    });
  }

  callNext(desk: Desk): void {
    this.busyAction = true; this.error = ''; this.success = '';
    this.http.post<{ ticket: Ticket; state: QueueState }>(`/api/desks/${desk.id}/call`, {}).subscribe({
      next: (result) => { this.state = result.state; this.success = `${result.ticket.id} llamado a Ventanilla ${desk.id}.`; this.busyAction = false; },
      error: (err) => { this.error = err.error?.error ?? 'No se pudo llamar al siguiente turno.'; this.busyAction = false; }
    });
  }

  release(desk: Desk): void {
    this.busyAction = true; this.error = ''; this.success = '';
    this.http.post<{ state: QueueState }>(`/api/desks/${desk.id}/release`, {}).subscribe({
      next: (result) => { this.state = result.state; this.success = `Ventanilla ${desk.id} disponible. Puedes llamar al siguiente turno.`; this.busyAction = false; },
      error: () => { this.error = 'No se pudo actualizar la ventanilla.'; this.busyAction = false; }
    });
  }

  announce(ticket: string, desk: number): void {
    try {
      const AudioCtx = window.AudioContext;
      const context = new AudioCtx();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.frequency.value = 880; gain.gain.value = 0.14;
      oscillator.start(); oscillator.stop(context.currentTime + 0.22);
      oscillator.onended = () => { void context.close(); };
    } catch { /* El anuncio de voz sigue disponible aunque el navegador bloquee el tono. */ }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const speech = new SpeechSynthesisUtterance(`Turno ${ticket}. Pase a ventanilla ${desk}.`);
      speech.lang = 'es-MX'; speech.rate = 0.92;
      window.speechSynthesis.speak(speech);
    }
  }

  get waiting(): Ticket[] { return (this.state.queue ?? []).filter((ticket) => ticket.status === 'esperando'); }
  get serving(): Ticket[] { return (this.state.queue ?? []).filter((ticket) => ticket.status === 'atendiendo'); }
  get attendedCount(): number { return (this.state.queue ?? []).filter((ticket) => ticket.status === 'atendido').length; }
  get nextTicket(): Ticket | undefined { return this.waiting[0]; }
  timeLabel(): string { return this.now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }); }
}

