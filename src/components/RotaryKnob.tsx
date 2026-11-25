import React, { useRef, useState } from 'react';

interface RotaryKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  unit?: string;
  accentColor?: string;
  size?: number;
  formatValue?: (val: number) => string;
  onChange: (val: number) => void;
}

export const RotaryKnob: React.FC<RotaryKnobProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  defaultValue,
  unit = '',
  accentColor = '#38bdf8',
  size = 52,
  formatValue,
  onChange
}) => {
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef(0);
  const startValRef = useRef(value);

  const clamped = Math.max(min, Math.min(max, value));
  const norm = (clamped - min) / (max - min || 1);

  // Arc sweeps from -135 deg to +135 deg (270 deg total)
  const angle = -135 + norm * 270;
  const radius = 20;
  const cx = 26;
  const cy = 26;

  const polarToCartesian = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad)
    };
  };

  const describeArc = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(endAngle);
    const end = polarToCartesian(startAngle);
    const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`;
  };

  const quantize = (raw: number) => {
    const bounded = Math.max(min, Math.min(max, raw));
    const snapped = Math.round(bounded / step) * step;
    return Number(snapped.toFixed(4));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    startYRef.current = e.clientY;
    startValRef.current = value;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const dy = startYRef.current - e.clientY;
    const sensitivity = e.shiftKey ? 420 : 145;
    const delta = (dy / sensitivity) * (max - min);
    onChange(quantize(startValRef.current + delta));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dir = e.deltaY < 0 ? 1 : -1;
    const fine = e.shiftKey ? step : Math.max(step, (max - min) / 40);
    onChange(quantize(value + dir * fine));
  };

  const handleDoubleClick = () => {
    if (defaultValue !== undefined) {
      onChange(defaultValue);
    }
  };

  const displayText = formatValue
    ? formatValue(clamped)
    : `${Number.isInteger(step) ? Math.round(clamped) : clamped.toFixed(step < 0.1 ? 2 : 1)}${unit}`;

  return (
    <div className="knob-wrapper" title={`${label}: ${displayText} (arraste ↑↓, scroll ou duplo clique)`}>
      <div
        className={`knob-control ${dragging ? 'is-dragging' : ''}`}
        style={{ width: size, height: size }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      >
        <svg viewBox="0 0 52 52" width={size} height={size}>
          {/* Track background arc */}
          <path
            d={describeArc(-135, 135)}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          {/* Value arc */}
          {norm > 0.004 && (
            <path
              d={describeArc(-135, angle)}
              fill="none"
              stroke={accentColor}
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          )}
          {/* Metallic knob cap */}
          <circle cx={cx} cy={cy} r="14.5" fill="#181c24" stroke="#363e4f" strokeWidth="1.5" />
          <circle cx={cx} cy={cy} r="12" fill="url(#knobGrad)" />
          {/* Pointer line */}
          <g transform={`rotate(${angle} ${cx} ${cy})`}>
            <line
              x1={cx}
              y1={cy - 3}
              x2={cx}
              y2={cy - 11.5}
              stroke={accentColor}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </g>
          <defs>
            <radialGradient id="knobGrad" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#384152" />
              <stop offset="100%" stopColor="#141820" />
            </radialGradient>
          </defs>
        </svg>
      </div>
      <span className="knob-label">{label}</span>
      <span className="knob-value">{displayText}</span>
    </div>
  );
};
