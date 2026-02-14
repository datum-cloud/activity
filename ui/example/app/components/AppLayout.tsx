import type { ReactNode } from "react";

interface AppLayoutProps {
  children: ReactNode;
}

/**
 * Shared app layout with header, main content area, and footer.
 * Replaces custom CSS classes: .app, .app-header, .logo, .main-content, .app-footer
 */
export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-muted to-muted/80">
      <header className="bg-transparent px-8 py-6 text-center">
        <div className="text-2xl font-semibold tracking-wider text-foreground">
          DATUM
        </div>
      </header>

      <main className="flex-1 px-8 py-8 max-w-7xl mx-auto w-full">
        {children}
      </main>

      <footer className="bg-gray-800 dark:bg-gray-900 text-white px-8 py-8 text-center mt-auto">
        <p className="my-2">
          Powered by <strong>Activity</strong> (activity.miloapis.com/v1alpha1)
        </p>
        <p className="opacity-80 my-2">
          <a
            href="https://github.com/datum-cloud/activity"
            target="_blank"
            rel="noopener noreferrer"
            className="text-aurora-moss no-underline hover:underline"
          >
            GitHub
          </a>
          {" | "}
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-aurora-moss no-underline hover:underline"
          >
            Documentation
          </a>
        </p>
      </footer>
    </div>
  );
}
