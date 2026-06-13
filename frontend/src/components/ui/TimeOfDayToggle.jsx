import { useCityStore } from '../../store/cityStore';

const PRESETS = [
  { id: 'dawn', label: 'Dawn', icon: '🌅' },
  { id: 'day', label: 'Day', icon: '☀️' },
  { id: 'dusk', label: 'Dusk', icon: '🌇' },
  { id: 'night', label: 'Night', icon: '🌙' },
];

export function TimeOfDayToggle() {
  const timeOfDay = useCityStore((s) => s.timeOfDay);
  const setTimeOfDay = useCityStore((s) => s.setTimeOfDay);

  return (
    <div className="time-toggle glass-panel">
      {PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className={`time-toggle__btn${timeOfDay === preset.id ? ' time-toggle__btn--active' : ''}`}
          onClick={() => setTimeOfDay(preset.id)}
          aria-label={`Switch to ${preset.label}`}
          aria-pressed={timeOfDay === preset.id}
        >
          <span className="time-toggle__icon">{preset.icon}</span>
          <span className="time-toggle__label">{preset.label}</span>
        </button>
      ))}
    </div>
  );
}
