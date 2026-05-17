"use client";

import { useEffect, useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import { isInvalidMoveTarget } from "./storage";

export interface FolderNode {
    name: string;
    path: string;
    // Tri-state: undefined = unknown (lazy, show chevron until proven empty),
    // true = has child folders, false = confirmed leaf (hide chevron).
    hasSubfolders?: boolean;
    children?: FolderNode[];
}

interface TreeNodeProps {
    node: FolderNode;
    level: number;
    expandedPaths: Set<string>;
    selectedFolderPath: string;
    onNodeClick: (node: FolderNode) => void;
}

/**
 * One tree row + its (animated) child subtree. Extracted verbatim from the
 * former inline `renderTree`, with a @dnd-kit drop target wired to the folder's
 * full path. While a dragged item hovers, the row highlights and — if the
 * folder is collapsed and may have children — a 600ms spring-expand timer
 * opens it (Google-Drive style).
 */
export default function TreeNode({
    node,
    level,
    expandedPaths,
    selectedFolderPath,
    onNodeClick,
}: TreeNodeProps) {
    const isExpanded = expandedPaths.has(node.path);
    const isSelected = selectedFolderPath === node.path;
    // Chevron only for folders confirmed to have subfolders.
    const canExpand = node.hasSubfolders === true;

    const open = isExpanded || isSelected;
    const FolderGlyph = open ? FolderOpen : Folder;

    const { setNodeRef, isOver, active } = useDroppable({
        id: `drop:tree:${node.path}`,
        data: { kind: "folder", name: node.name, path: node.path },
    });

    // Only treat this row as a live drop target when the drop would actually
    // move something (not onto itself / its own subtree / its current parent).
    const activeData = active?.data.current as
        | { kind?: "file" | "folder"; path?: string }
        | undefined;
    const isValidTarget =
        isOver &&
        !!activeData?.path &&
        !!activeData.kind &&
        !isInvalidMoveTarget(activeData.path, activeData.kind, node.path);

    // v2: spring-expand on hover-while-collapsed. `onNodeClick` and `node`
    // get new identities on every parent re-render / tree refresh; keep
    // them in refs so the effect (and its 600ms timer) only re-subscribes
    // on the values that actually matter, instead of resetting mid-hover.
    const onNodeClickRef = useRef(onNodeClick);
    onNodeClickRef.current = onNodeClick;
    const nodeRef = useRef(node);
    nodeRef.current = node;

    const expandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (
            isValidTarget &&
            !isExpanded &&
            node.hasSubfolders !== false &&
            expandTimer.current === null
        ) {
            expandTimer.current = setTimeout(() => {
                expandTimer.current = null;
                onNodeClickRef.current(nodeRef.current);
            }, 600);
        }
        if ((!isValidTarget || isExpanded) && expandTimer.current !== null) {
            clearTimeout(expandTimer.current);
            expandTimer.current = null;
        }
        return () => {
            if (expandTimer.current !== null) {
                clearTimeout(expandTimer.current);
                expandTimer.current = null;
            }
        };
    }, [isValidTarget, isExpanded, node.path, node.hasSubfolders]);

    return (
        <li>
            <button
                ref={setNodeRef}
                type="button"
                onClick={() => onNodeClick(node)}
                aria-expanded={canExpand ? isExpanded : undefined}
                className={`group flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors duration-150 ${
                    isValidTarget
                        ? "border border-sbi-green/40 bg-sbi-green/10 [animation:sbiDragPulse_1.1s_ease-in-out_infinite]"
                        : "border border-transparent"
                } ${
                    isSelected
                        ? "bg-sbi-green/10 text-sbi-green"
                        : "text-sbi-muted hover:text-white hover:bg-white/[0.03]"
                }`}
            >
                {canExpand ? (
                    <ChevronRight
                        className={`size-3.5 shrink-0 text-sbi-muted-dark group-hover:text-current transition-transform duration-200 ${
                            isExpanded ? "rotate-90" : ""
                        }`}
                    />
                ) : (
                    <span className="size-3.5 shrink-0" />
                )}
                <FolderGlyph
                    className={`size-4 shrink-0 transition-colors ${
                        isSelected
                            ? "text-sbi-green"
                            : "text-sbi-muted group-hover:text-white"
                    }`}
                />
                <span className="flex-1 truncate leading-none">
                    {node.name}
                </span>
            </button>
            <AnimatePresence initial={false}>
                {canExpand &&
                isExpanded &&
                node.children &&
                node.children.length > 0 ? (
                    <motion.div
                        key="children"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-x-visible overflow-y-clip ml-[1.05rem] border-l border-sbi-dark-border/70 pl-2"
                    >
                        <ul className="space-y-1 mt-1">
                            {node.children.map((child) => (
                                <TreeNode
                                    key={child.path}
                                    node={child}
                                    level={level + 1}
                                    expandedPaths={expandedPaths}
                                    selectedFolderPath={selectedFolderPath}
                                    onNodeClick={onNodeClick}
                                />
                            ))}
                        </ul>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </li>
    );
}
