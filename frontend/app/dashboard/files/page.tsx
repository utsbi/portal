// pages/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import FileCard from './FileCard'; // Import the FileCard component
import { StorageError } from '@supabase/storage-js';

const FilesPage = () => {
    const [data, setData] = useState<any[]>([]);
    const [folders, setFolders] = useState<any[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [error, setError] = useState<StorageError | null>(null);

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);

    useEffect(() => {
        const fetchFolders = async () => {
            const { data: fetchedFolders, error: fetchError } = await supabase.storage.from('Files').list('', { limit: 100 });

            if (fetchError) {
                setError(fetchError);
            } else {
                setFolders(fetchedFolders);
            }
        };

        fetchFolders();
    }, []);

    useEffect(() => {
        const fetchFiles = async () => {
            if (selectedFolder) {
                const { data: fetchedFiles, error: fetchError } = await supabase.storage.from('Files').list(selectedFolder);

                if (fetchError) {
                    setError(fetchError);
                } else {
                    setData(fetchedFiles);
                }
            }
        };

        fetchFiles();
    }, [selectedFolder]);

    return (
        <div className="relative min-h-screen bg-sbi-dark text-white overflow-hidden">
            <header className="border-b border-sbi-dark-border px-12 py-6 fade-in">
                <h1 className="text-2xl font-semibold tracking-wide">
                    Client Document Portal
                </h1>
                <p className="text-sm text-sbi-muted-dark mt-1">
                    Secure access to organizational records
                </p>
            </header>

            <div className="flex">
                <aside className="w-72 border-r border-sbi-dark-border p-8 fade-in">
                    <h2 className="text-xs uppercase tracking-widest text-sbi-muted-dark mb-6">
                        Folders
                    </h2>
                    <ul className="space-y-4 text-sm">
                        {folders && folders.length > 0 ? (
                            folders.map((folder) => (
                                <li key={folder.name} className="hover:text-sbi-green cursor-pointer transition" onClick={() => setSelectedFolder(folder.name)}>
                                    {folder.name}
                                </li>
                            ))
                        ) : (
                            <li>No folders found</li>
                        )}
                    </ul>
                </aside>

                <main className="flex-1 p-12 fade-in">
                   <div className="text-sm text-sbi-muted-dark mb-8">
                       Home / Documents
                   </div>
                                      
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {data.map((item) => (
                            <FileCard key={item.id} name={item.name} folderPath={selectedFolder} lastModified={item.updated_at} />
                        ))}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default FilesPage;
