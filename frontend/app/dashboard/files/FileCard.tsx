import { createClient } from "@supabase/supabase-js";

interface FileCardProps {
    name: string;
    folderPath: string;
    updatedAt?: string | null;
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

export default function FileCard({ name, folderPath, updatedAt }: FileCardProps) {
    const getSignedUrl = async () => {
        const fullPath = folderPath ? `${folderPath}/${name}` : name;
        const { data, error } = await supabase.storage
            .from("Files")
            .createSignedUrl(fullPath, 60);

        if (error) {
            console.error("File URL error:", error);
            return null;
        }

        return data.signedUrl;
    };

    const handlePreview = async () => {
        const signedUrl = await getSignedUrl();
        if (!signedUrl) {
            return;
        }

        window.open(signedUrl, "_blank", "noopener,noreferrer");
    };

    const handleDownload = async () => {
        const signedUrl = await getSignedUrl();
        if (!signedUrl) {
            return;
        }
        // Append the download parameter to the signed URL
        const downloadUrl = `${signedUrl}?download`;
        
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const formattedDate = updatedAt
        ? new Date(updatedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
          })
        : "Unknown";

    return (
        <div className="border border-sbi-dark-border rounded-lg p-6 hover:border-sbi-green transition bg-sbi-dark-secondary">
            <div className="text-sm font-medium mb-2 truncate">{name}</div>
            <div className="text-xs text-sbi-muted-dark mb-5">
                Last modified: {formattedDate}
            </div>
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={handlePreview}
                    className="px-3 py-1.5 text-xs rounded border border-sbi-dark-border hover:border-sbi-green hover:text-sbi-green transition"
                >
                    Preview
                </button>
                <button
                    type="button"
                    onClick={handleDownload}
                    className="px-3 py-1.5 text-xs rounded border border-sbi-dark-border hover:border-sbi-green hover:text-sbi-green transition"
                >
                    Download
                </button>
            </div>
        </div>
    );
}
