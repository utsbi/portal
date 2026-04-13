// components/FileCard.tsx
import { createClient } from '@supabase/supabase-js';

// Create Supabase client with custom storage
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)

const FileCard = ({ name, folderPath }: { name: string; folderPath: string | null }) => {
    const handleDownload = async () => {

        const fullPath = folderPath ? `${folderPath}/${name}` : name; // Construct the full path

        const { data, error } = await supabase.storage
            .from("Files")
            .createSignedUrl(fullPath, 60); // URL valid for 60 seconds

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
    };

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
};

export default FileCard;
