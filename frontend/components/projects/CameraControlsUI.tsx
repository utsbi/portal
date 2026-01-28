import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { CameraPreset } from "@/lib/data/projects";
import { cn } from "@/lib/utils";

interface CameraControlsUIProps {
  presets: CameraPreset[] | null;
  activeIndex: number;
  onPresetSelect: (index: number) => void;
  onReset: () => void;
}

export function CameraControlsUI({
  presets,
  activeIndex,
  onPresetSelect,
  onReset,
}: CameraControlsUIProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsExpanded(false);
      }
    }
    if (isExpanded) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isExpanded]);

  if (!presets || presets.length === 0) {
    return null;
  }

  const shouldCollapse = presets.length > 4;
  const activePreset = activeIndex >= 0 ? presets[activeIndex] : null;

  return (
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 p-6 md:p-8 z-20 pointer-events-none">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="flex gap-2 pointer-events-auto items-end"
        ref={containerRef}
      >
        {shouldCollapse ? (
          <div className="relative flex flex-col items-center gap-2">
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute bottom-full mb-2 left-0 bg-sbi-dark/80 backdrop-blur-md rounded-lg border border-sbi-dark-border p-1 min-w-[160px] shadow-xl overflow-hidden"
                >
                  <div className="flex flex-col gap-0.5 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {presets.map((preset, index) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          onPresetSelect(index);
                          setIsExpanded(false);
                        }}
                        className={cn(
                          "px-3 py-2 text-left text-sm rounded-md transition-colors w-full flex items-center justify-between group",
                          activeIndex === index
                            ? "bg-sbi-green/10 text-sbi-green"
                            : "text-white/80 hover:bg-white/10 hover:text-white",
                        )}
                      >
                        <span>{preset.label}</span>
                        {activeIndex === index && (
                          <div className="w-1.5 h-1.5 rounded-full bg-sbi-green" />
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-2 bg-sbi-dark/60 backdrop-blur-md rounded-lg border border-sbi-dark-border p-1">
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="px-3 py-2 rounded text-sm font-medium text-white hover:bg-white/10 transition-colors flex items-center gap-2 min-w-[140px] justify-between"
              >
                <span className="truncate max-w-[120px]">
                  {activePreset ? activePreset.label : "Select View"}
                </span>
                {isExpanded ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronUp size={14} />
                )}
              </button>

              <div className="w-px bg-sbi-dark-border my-1" />

              <button
                type="button"
                onClick={onReset}
                className="px-3 py-2 rounded text-sbi-muted hover:text-white hover:bg-white/10 transition-colors"
                title="Reset View"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 p-1 bg-sbi-dark/60 backdrop-blur-md rounded-lg border border-sbi-dark-border">
            {presets.map((preset, index) => (
              <motion.button
                key={preset.id}
                type="button"
                onClick={() => onPresetSelect(index)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "px-3 py-2 rounded text-xs font-medium whitespace-nowrap transition-colors",
                  activeIndex === index
                    ? "bg-sbi-green text-sbi-dark"
                    : "text-white hover:bg-white/10",
                )}
              >
                {preset.label}
              </motion.button>
            ))}

            <div className="w-px bg-sbi-dark-border mx-1" />

            <motion.button
              type="button"
              onClick={onReset}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-2 py-2 rounded text-sbi-muted hover:text-white hover:bg-white/10 transition-colors"
              title="Reset View"
            >
              <RotateCcw size={14} />
            </motion.button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
