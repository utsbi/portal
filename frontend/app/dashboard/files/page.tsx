"use client";

import { StorageError } from "@supabase/storage-js";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import FileCard from "./FileCard";
import FolderCard from "./FolderCard";

interface StorageEntry {
    id: string | null;
    name: string;
    updated_at?: string;
}

interface FolderNode {
    name: string;
    path: string;
    hasSubfolders: boolean;
    children?: FolderNode[];
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

function isFolder(entry: StorageEntry) {
    return entry.id === null;
}

export default function FilesPage() {
    const [files, setFiles] = useState<StorageEntry[]>([]);
    const [subfolders, setSubfolders] = useState<FolderNode[]>([]);
    const [folderTree, setFolderTree] = useState<FolderNode[]>([]);
    const [selectedFolderPath, setSelectedFolderPath] = useState<string>("Media");
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(["Media"]));
    const [error, setError] = useState<StorageError | null>(null);

    const folderHasSubfolders = async (folderPath: string): Promise<boolean> => {
        const { data, error: fetchError } = await supabase.storage
            .from("Files")
            .list(folderPath, { limit: 200 });

        if (fetchError) {
            setError(fetchError);
            return false;
        }

        return (data ?? []).some((entry) => isFolder(entry as StorageEntry));
    };

    const fetchFolderNodes = async (folderPath: string): Promise<FolderNode[]> => {
        const { data, error: fetchError } = await supabase.storage
            .from("Files")
            .list(folderPath, { limit: 100 });

        if (fetchError) {
            setError(fetchError);
            return [];
        }

        const folderEntries = (data ?? [])
            .filter((entry) => isFolder(entry as StorageEntry))
            .map((folder) => {
                const path = folderPath ? `${folderPath}/${folder.name}` : folder.name;
                return { name: folder.name, path };
            })
            .sort((a, b) => a.name.localeCompare(b.name));

        const hasSubfolderChecks = await Promise.all(
            folderEntries.map(async (folder) => {
                const hasSubfolders = await folderHasSubfolders(folder.path);
                return {
                    name: folder.name,
                    path: folder.path,
                    hasSubfolders,
                };
            }),
        );

        return hasSubfolderChecks;
    };

    useEffect(() => {
        const bootstrapFolders = async () => {
            const rootNodes = await fetchFolderNodes("");
            setFolderTree(rootNodes);

            const mediaFolder = rootNodes.find(
                (node) => node.name.toLowerCase() === "media",
            );
            if (mediaFolder) {
                setSelectedFolderPath(mediaFolder.path);
                setExpandedPaths(new Set([mediaFolder.path]));
                const mediaChildren = await fetchFolderNodes(mediaFolder.path);
                setFolderTree((prev) =>
                    updateNodeChildren(prev, mediaFolder.path, mediaChildren),
                );
            } else if (rootNodes.length > 0) {
                setSelectedFolderPath(rootNodes[0].path);
                setExpandedPaths(new Set([rootNodes[0].path]));
                if (rootNodes[0].hasSubfolders) {
                    const firstChildren = await fetchFolderNodes(rootNodes[0].path);
                    setFolderTree((prev) =>
                        updateNodeChildren(prev, rootNodes[0].path, firstChildren),
                    );
                }
            }
        };

        void bootstrapFolders();
    }, []);

    useEffect(() => {
        const fetchFolderContents = async () => {
            if (!selectedFolderPath) {
                setFiles([]);
                setSubfolders([]);
                return;
            }

            const { data, error: fetchError } = await supabase.storage
                .from("Files")
                .list(selectedFolderPath, { limit: 200 });

            if (fetchError) {
                setError(fetchError);
                return;
            }

            const entries = (data ?? []) as StorageEntry[];
            const folderEntries = entries.filter((entry) => isFolder(entry));
            const fileEntries = entries.filter((entry) => !isFolder(entry));

            const childFolders = await Promise.all(
                folderEntries.map(async (folder) => {
                    const path = `${selectedFolderPath}/${folder.name}`;
                    const hasSubfolders = await folderHasSubfolders(path);
                    return {
                        name: folder.name,
                        path,
                        hasSubfolders,
                    };
                }),
            );

            setSubfolders(childFolders.sort((a, b) => a.name.localeCompare(b.name)));
            setFiles(fileEntries);
        };

        void fetchFolderContents();
    }, [selectedFolderPath]);

    const handleSelectFolder = (folderPath: string) => {
        setSelectedFolderPath(folderPath);
        setExpandedPaths((prev) => new Set(prev).add(folderPath));
    };

    const updateNodeChildren = (
        nodes: FolderNode[],
        targetPath: string,
        children: FolderNode[],
    ): FolderNode[] => {
        return nodes.map((node) => {
            if (node.path === targetPath) {
                return { ...node, children };
            }
            if (!node.children) {
                return node;
            }
            return {
                ...node,
                children: updateNodeChildren(node.children, targetPath, children),
            };
        });
    };

    const findNodeByPath = (nodes: FolderNode[], targetPath: string): FolderNode | null => {
        for (const node of nodes) {
            if (node.path === targetPath) {
                return node;
            }
            if (node.children) {
                const match = findNodeByPath(node.children, targetPath);
                if (match) {
                    return match;
                }
            }
        }
        return null;
    };

    const ensureNodeLoaded = async (nodePath: string) => {
        const node = findNodeByPath(folderTree, nodePath);
        if (!node?.hasSubfolders) {
            return;
        }
        if (node?.children) {
            return;
        }

        const children = await fetchFolderNodes(nodePath);
        setFolderTree((prev) => updateNodeChildren(prev, nodePath, children));
    };

    const handleToggleExpand = async (nodePath: string) => {
        await ensureNodeLoaded(nodePath);
        setExpandedPaths((prev) => {
            const next = new Set(prev);
            if (next.has(nodePath)) {
                next.delete(nodePath);
            } else {
                next.add(nodePath);
            }
            return next;
        });
    };

    const renderTree = (nodes: FolderNode[], level = 0) => {
        return (
            <ul className={level === 0 ? "space-y-2 text-sm" : "space-y-1 mt-1"}>
                {nodes.map((node) => {
                    const isExpanded = expandedPaths.has(node.path);
                    const isSelected = selectedFolderPath === node.path;
                    const canExpand = node.hasSubfolders;

                    return (
                        <li key={node.path}>
                            <div
                                className={`flex items-center gap-2 rounded px-2 py-1 transition ${
                                    isSelected
                                        ? "bg-sbi-dark-secondary text-sbi-green"
                                        : "hover:text-sbi-green"
                                }`}
                            >
                                {canExpand ? (
                                    <button
                                        type="button"
                                        className="w-4 text-xs text-sbi-muted-dark hover:text-white"
                                        onClick={() => void handleToggleExpand(node.path)}
                                        aria-label={
                                            isExpanded ? "Collapse folder" : "Expand folder"
                                        }
                                    >
                                        {isExpanded ? "▾" : "▸"}
                                    </button>
                                ) : (
                                    <span className="w-4" />
                                )}
                                <button
                                    type="button"
                                    className="text-left flex-1 truncate"
                                    onClick={() => handleSelectFolder(node.path)}
                                >
                                    {node.name}
                                </button>
                            </div>
                            {canExpand && isExpanded && node.children && node.children.length > 0 ? (
                                <div className="ml-4 border-l border-sbi-dark-border pl-2">
                                    {renderTree(node.children, level + 1)}
                                </div>
                            ) : null}
                        </li>
                    );
                })}
            </ul>
        );
    };

    const breadcrumb = useMemo(() => {
        if (!selectedFolderPath) {
            return "Home /";
        }
        const pathParts = selectedFolderPath.split("/").filter(Boolean);
        return ["Home", ...pathParts].join(" / ");
    }, [selectedFolderPath]);

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
                <aside className="w-80 border-r border-sbi-dark-border p-8 fade-in">
                    <h2 className="text-xs uppercase tracking-widest text-sbi-muted-dark mb-6">
                        Folders
                    </h2>
                    {folderTree.length > 0 ? renderTree(folderTree) : <p>No folders found</p>}
                </aside>

                <main className="flex-1 p-12 fade-in">
                    <div className="text-sm text-sbi-muted-dark mb-8">{breadcrumb}</div>

                    {error ? (
                        <div className="text-sm text-red-400 mb-6">
                            {error.message || "Failed to load files or folders."}
                        </div>
                    ) : null}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {subfolders.map((folder) => (
                            <FolderCard
                                key={folder.path}
                                name={folder.name}
                                onOpen={() => handleSelectFolder(folder.path)}
                            />
                        ))}
                        {files.map((item) => (
                            <FileCard
                                key={item.name}
                                name={item.name}
                                folderPath={selectedFolderPath}
                                updatedAt={item.updated_at}
                            />
                        ))}
                    </div>
                </main>
            </div>
        </div>
    );
}
