import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { routes } from './app.routes';

/**
 * Application-wide providers, passed to bootstrapApplication in main.ts.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    // Reports uncaught browser errors (window error / unhandledrejection) through Angular's ErrorHandler
    provideBrowserGlobalErrorListeners(),
    // Pages cross-fade when the route changes (browsers without View Transitions just switch)
    provideRouter(routes, withViewTransitions()),
  ],
};
