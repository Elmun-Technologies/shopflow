// Google Identity Services (GIS) — minimal type declaration for the
// "Sign in with Google" button used on the admin login page.
export {};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: unknown): void;
          renderButton(el: HTMLElement | null, options: unknown): void;
          prompt(): void;
        };
      };
    };
  }
}
