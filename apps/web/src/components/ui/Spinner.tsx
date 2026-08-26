interface SpinnerProps {
  className?: string;
}

export default function Spinner({ className = "py-20" }: SpinnerProps) {
  return (
    <div className={`flex justify-center ${className}`}>
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );
}
