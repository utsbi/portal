//css also vibe coded
//progress bar for a single prooject
type ProgressBarProps = {
  percent: number;
};

export default function ProgressBar({ percent }: ProgressBarProps) {
  return (
    <div className="w-full">
      <div className="w-full bg-sbi-dark-border/30 rounded-full h-2.5 overflow-hidden">
        <div 
          className="bg-sbi-green h-2.5 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
        />
      </div>
      <p className="text-xs text-sbi-muted-dark mt-1.5 font-light tracking-wide">
        {percent}% Complete
      </p>
    </div>
  );
}