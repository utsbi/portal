"use client";

import { File, Upload, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState } from "react";

interface UploadedFile {
  id: string;
  name: string;
  size: string;
  file: File; // Keep the real File object for uploading
}

interface FileUploadProps {
  onFilesChange?: (files: File[]) => void; // Pass real File objects to parent
}

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export function FileUpload({ onFilesChange }: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = useCallback(
    (newRawFiles: File[]) => {
      setError(null);

      const validFiles = newRawFiles.filter((file) => {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          setError(`"${file.name}" exceeds the 50MB file size limit.`);
          return false;
        }
        return true;
      });

      if (validFiles.length === 0) return;

      const converted: UploadedFile[] = validFiles.map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: formatFileSize(file.size),
        file,
      }));

      const updated = [...files, ...converted];
      setFiles(updated);
      onFilesChange?.(updated.map((f) => f.file));
    },
    [files, onFilesChange],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(Array.from(e.dataTransfer.files));
    },
    [addFiles],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return;
      addFiles(Array.from(e.target.files));
      e.target.value = ""; // allow re-selecting the same file
    },
    [addFiles],
  );

  const removeFile = useCallback(
    (id: string) => {
      const updated = files.filter((f) => f.id !== id);
      setFiles(updated);
      onFilesChange?.(updated.map((f) => f.file));
    },
    [files, onFilesChange],
  );

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border border-dashed rounded-lg transition-all duration-300 ${
          isDragging
            ? "border-sbi-green bg-sbi-green/5"
            : "border-sbi-dark-border hover:border-sbi-green/30 bg-transparent"
        }`}
        whileHover={{ scale: 1.01 }}
      >
        <input
          type="file"
          multiple
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className="flex flex-col items-center justify-center py-8 px-4 cursor-pointer"
        >
          <motion.div
            animate={{
              y: isDragging ? -4 : 0,
              scale: isDragging ? 1.1 : 1,
            }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <Upload
              className={`w-8 h-8 mb-3 transition-colors ${
                isDragging ? "text-sbi-green" : "text-sbi-muted"
              }`}
            />
          </motion.div>
          <p className="text-base text-sbi-muted mb-1">
            {isDragging ? "Drop files here" : "Drag & drop files here"}
          </p>
          <p className="text-sm text-sbi-muted-dark mb-2">or click to browse</p>
          <p className="text-xs text-sbi-muted-dark/70 uppercase tracking-widest">
            Max size 50MB per file
          </p>
        </label>
      </motion.div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-xs text-red-400 mt-2 px-1"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* File list */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            {files.map((file) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-3 p-3 bg-sbi-dark-card border border-sbi-dark-border/50 rounded-lg group hover:border-sbi-green/30 transition-colors"
              >
                <File className="w-4 h-4 text-sbi-green shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{file.name}</p>
                  <p className="text-xs text-sbi-muted">{file.size}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="p-1.5 rounded-md text-sbi-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
}
