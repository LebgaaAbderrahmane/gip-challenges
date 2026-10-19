import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

const GITHUB_URL = 'https://github.com/LebgaaAbderrahmane/gip-challenges';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-surface-elevated text-text'
      : 'text-text-muted hover:bg-surface hover:text-text',
  ].join(' ');

export default function SiteShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // Close the mobile menu on navigation.
  useEffect(() => setMenuOpen(false), [pathname]);

  // Escape closes the mobile menu.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-bg"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span
              aria-hidden="true"
              className="grid h-7 w-7 place-items-center rounded-md bg-accent-muted text-sm font-bold text-accent"
            >
              G
            </span>
            <span>
              GIP Challenges
              <span className="ml-2 hidden text-xs font-normal text-text-subtle sm:inline">
                engineering portfolio
              </span>
            </span>
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            <NavLink to="/tasks" className={navLinkClass}>
              Challenges
            </NavLink>
            <NavLink to="/about" className={navLinkClass}>
              About
            </NavLink>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-md px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface hover:text-text"
            >
              Source
            </a>
          </nav>

          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
            className="rounded-md border border-border px-3 py-2 text-sm text-text-muted md:hidden"
          >
            Menu
          </button>
        </div>

        {menuOpen && (
          <nav
            id="mobile-nav"
            aria-label="Main (mobile)"
            className="border-t border-border bg-surface md:hidden"
          >
            <div className="container-page flex flex-col py-2">
              <NavLink to="/tasks" className={navLinkClass}>
                Challenges
              </NavLink>
              <NavLink to="/about" className={navLinkClass}>
                About
              </NavLink>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-md px-3 py-2 text-sm font-medium text-text-muted"
              >
                Source
              </a>
            </div>
          </nav>
        )}
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="mt-20 border-t border-border">
        <div className="container-page flex flex-col gap-4 py-8 text-sm text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            Seven engineering challenges — one front door. Built as a working portfolio, not a
            mockup.
          </p>
          <p className="flex items-center gap-4">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="underline decoration-border underline-offset-4 hover:text-text"
            >
              github.com/LebgaaAbderrahmane
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}