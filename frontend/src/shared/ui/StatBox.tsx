'use client';

interface StatBoxProps {
  value: number;
  label: string;
  color: 'blue' | 'green' | 'red';
}

export function StatBox({ value, label, color }: StatBoxProps) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className={`p-3 rounded-lg ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-gray-600">{label}</div>
    </div>
  );
}
