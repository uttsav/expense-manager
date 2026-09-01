import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ConnectivityService {
  readonly isOnline = signal(
    typeof navigator !== 'undefined'
      ? navigator.onLine
      : true,
  );

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('online', () => {
      this.isOnline.set(true);
    });

    window.addEventListener('offline', () => {
      this.isOnline.set(false);
    });
  }
}