export default function RedAlertPulse() {
  return (
    <div className="relative w-5 h-5 cursor-pointer">
      <span className="absolute inset-0 rounded-full bg-red-500 opacity-75 animate-ping" />
      <span className="relative block w-5 h-5 rounded-full bg-red-600 border-2 border-white shadow-md" />
    </div>
  );
}
