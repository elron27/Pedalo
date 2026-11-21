import type { WakeLockPort } from '../ports';

/** Hält den Bildschirm während des Trainings an (und holt die Sperre zurück, wenn der Tab wieder sichtbar wird). */
export class BrowserWakeLock implements WakeLockPort {
  private sentinel: WakeLockSentinel | undefined;
  private wanted = false;
  private onVisible = () => {
    if (this.wanted && document.visibilityState === 'visible') void this.request().catch((e) => console.error(e));
  };

  private async request(): Promise<void> {
    if (!navigator.wakeLock) throw new Error('Dieser Browser kann den Bildschirm nicht wachhalten. Bitte Energiesparen am Gerät ausschalten.');
    this.sentinel = await navigator.wakeLock.request('screen');
  }

  async acquire(): Promise<void> {
    this.wanted = true;
    document.addEventListener('visibilitychange', this.onVisible);
    await this.request();
  }

  async release(): Promise<void> {
    this.wanted = false;
    document.removeEventListener('visibilitychange', this.onVisible);
    await this.sentinel?.release();
    this.sentinel = undefined;
  }
}
