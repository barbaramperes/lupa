import { bootstrapApplication } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { AppComponent } from './app/app.component';

/**
 * Zoneless: o estado desta aplicação vive todo em signals, portanto não há
 * razão para carregar zone.js nem para monkey-patch de APIs do browser.
 * Menos runtime, e a deteção de alterações passa a ser consequência do
 * grafo de signals em vez de um varrimento global.
 */
bootstrapApplication(AppComponent, {
  providers: [provideZonelessChangeDetection(), provideHttpClient(withFetch())],
}).catch((e) => console.error(e));
