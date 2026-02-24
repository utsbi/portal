'use client'

export default async function FilesPage() {

  return (
    <div
      // ref={containerRef}
      className="relative min-h-screen bg-sbi-dark text-white overflow-hidden"
    >
      {/* Optional subtle background elements */}
      {/* <FloatingNodes />
      <AmbientGrid /> */}

      {/* Top Institutional Header */}
      <header className="border-b border-sbi-dark-border px-12 py-6 fade-in">
        <h1 className="text-2xl font-semibold tracking-wide">
          Client Document Portal
        </h1>
        <p className="text-sm text-sbi-muted-dark mt-1">
          Secure access to organizational records
        </p>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-72 border-r border-sbi-dark-border p-8 fade-in">
          <h2 className="text-xs uppercase tracking-widest text-sbi-muted-dark mb-6">
            Folders
          </h2>

          {/* Likely add a mapping here on what  */}
          <ul className="space-y-4 text-sm">
            <li className="hover:text-sbi-green cursor-pointer transition">
              All Documents
            </li>
            <li className="hover:text-sbi-green cursor-pointer transition">
              Financial Reports
            </li>
            <li className="hover:text-sbi-green cursor-pointer transition">
              Contracts
            </li>
            <li className="hover:text-sbi-green cursor-pointer transition">
              Tax Filings
            </li>
          </ul>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-12 fade-in">
          {/* Breadcrumb */}
          <div className="text-sm text-sbi-muted-dark mb-8">
            Home / Documents
          </div>

          {/* File Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FileCard name="Q4 Financial Statement.pdf" />
            <FileCard name="Board Minutes - Jan 2026.docx" />
            <FileCard name="02f27315-d20d-46c0-aaff-8782830447e3/1771616249954-catmeme.jpeg" />
          </div>
        </main>
      </div>
    </div>
  );
}

async function handleDownload() {
  
}

import { createClient } from '@supabase/supabase-js'


function FileCard({ name }: { name: string }) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  const handleDownload = async () => {
    const { data, error } = await supabase.storage
      .from("request-attachments")
      .createSignedUrl(name, 60); // URL valid for 60 seconds

    if (error) {
      console.error("Download error:", error);
      return;
    }

    // Trigger browser download
    const link = document.createElement("a");
    link.href = data.signedUrl;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  return (
    <div className="border border-sbi-dark-border rounded-lg p-6 hover:border-sbi-green transition cursor-pointer bg-sbi-dark-secondary">
      <div className="text-sm font-medium mb-2" onClick={handleDownload}>
        {name}
      </div>
      <div className="text-xs text-sbi-muted-dark">
        Last modified: Feb 20, 2026
      </div>
    </div>
  );
}
