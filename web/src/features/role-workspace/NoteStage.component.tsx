export function NoteStage({
  stages,
  value,
  disabled,
  onChange,
}: {
  stages: { id: string; name: string }[];
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mb-3 block text-sm">
      <span className="mb-1 block font-medium">Interview step</span>
      <select
        className="select min-h-11 w-full text-base"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">General role note</option>
        {value && !stages.some((stage) => stage.id === value) && (
          <option value={value} disabled>
            Removed interview step
          </option>
        )}
        {stages.map((stage) => (
          <option value={stage.id} key={stage.id}>
            {stage.name}
          </option>
        ))}
      </select>
    </label>
  );
}
