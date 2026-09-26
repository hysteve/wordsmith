import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wordsmith",
  description: "Instrument panel for keyword clouds, rankings and audits",
};

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/clouds", label: "Clouds" },
  { href: "/jobs", label: "Jobs" },
  { href: "/runs", label: "Runs" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-[1100px] items-baseline gap-6 px-4 py-3">
            <Link href="/" className="font-medium tracking-tight">
              Wordsmith
            </Link>
            <nav className="flex gap-4 text-sm text-ink-soft">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="hover:text-ink transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <div className="mx-auto max-w-[1100px] px-4 py-8">{children}</div>
      </body>
    </html>
  );
}
