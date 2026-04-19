interface Props {
  title: string;
  value: string | number;
  icon?: string;
}

export function StatsCard({ title, value, icon }: Props) {
  return (
    <div className="card stat">
      <div className="label">{icon ? `${icon} ` : ''}{title}</div>
      <div className="value">{value}</div>
    </div>
  );
}
