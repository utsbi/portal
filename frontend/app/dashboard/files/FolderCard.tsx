interface FolderCardProps {
    name: string;
    onOpen: () => void;
}

export default function FolderCard({ name, onOpen }: FolderCardProps) {
    return (
        <button
            type="button"
            onClick={onOpen}
            className="w-full text-left border border-sbi-dark-border rounded-lg p-6 hover:border-sbi-green transition bg-sbi-dark-secondary"
        >
            <div className="text-sm font-medium mb-2 truncate">{name}</div>
            <div className="text-xs text-sbi-muted-dark">Folder</div>
        </button>
    );
}
