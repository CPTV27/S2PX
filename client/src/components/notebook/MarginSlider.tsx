import { MARGIN_SLIDER_MIN, MARGIN_SLIDER_MAX } from '../../engine/constants';

interface MarginSliderProps {
  value: number; // 0-1
  onChange: (value: number) => void;
}

export function MarginSlider({ value, onChange }: MarginSliderProps) {
  const pct = Math.round(value * 100);
  const colorClass = pct < 40 ? 'nb-slider-red' : pct < 46 ? 'nb-slider-yellow' : 'nb-slider-green';
  const colorVar = pct < 40 ? 'var(--nb-error)' : pct < 46 ? 'var(--nb-warning)' : 'var(--nb-success)';

  return (
    <div className="nb-slider-container">
      <div className="flex items-center justify-between mb-2">
        <span className="nb-label">Margin Target</span>
        <span
          className="font-mono text-lg font-semibold"
          style={{ color: colorVar }}
        >
          {pct}%
        </span>
      </div>
      <input
        type="range"
        className={`nb-slider ${colorClass}`}
        min={MARGIN_SLIDER_MIN * 100}
        max={MARGIN_SLIDER_MAX * 100}
        step={1}
        value={pct}
        onChange={e => onChange(Number(e.target.value) / 100)}
      />
      <div className="flex justify-between mt-1">
        <span className="font-mono text-[0.6rem] text-[var(--nb-text-dim)]">
          {Math.round(MARGIN_SLIDER_MIN * 100)}%
        </span>
        <span className="font-mono text-[0.6rem] text-[var(--nb-text-dim)]">
          {Math.round(MARGIN_SLIDER_MAX * 100)}%
        </span>
      </div>
    </div>
  );
}
