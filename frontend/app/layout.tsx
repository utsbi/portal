import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'UTSB Portal',
  description: 'Student portal website',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900">
        {/* Header */}
        <header className="border-b border-gray-200">
          <nav className="max-w-4xl mx-auto flex items-center justify-between p-4 text-sm">
            <div className="w-10 h-10 text-xl font-serif text-green-700">
              UT-S
            </div>

            <div className="flex gap-6">
              <Link href="/" className="hover:underline">
                Home
              </Link>
              <Link href="/about-me" className="hover:underline">
                About
              </Link>
              <Link href="/about" className="hover:underline">
                About Me
              </Link>
              <Link href="/outreach" className="hover:underline">
                Outreach
              </Link>
              <Link href="/projects" className="hover:underline">
                Projects
              </Link>
              <Link href="/contact" className="hover:underline">
                Contact Us
              </Link>
              <Link href="/login" className="hover:underline">
                Login
              </Link>
            </div>
          </nav>
        </header>

        {/* Render page content */}
        <div className="max-w-4xl mx-auto p-8">
          {children}
        </div>
      </body>
    </html>
  );
}
