import React from 'react';
import './RangeSlider.css';

interface RangeSliderProps {
    label: string;
    min: number;
    max: number;
    step?: number;
    value: [number | null, number | null];
    onChange: (value: [number | null, number | null]) => void;
    unit?: string;
}

const RangeSlider: React.FC<RangeSliderProps> = ({
    label,
    min,
    max,
    step = 0.01,
    value,
    onChange,
    unit = ''
}) => {
    const [minValue, maxValue] = value;

    const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value === '' ? null : parseFloat(e.target.value);
        onChange([val, maxValue]);
    };

    const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value === '' ? null : parseFloat(e.target.value);
        onChange([minValue, val]);
    };

    return (
        <div className="range-slider" style={{ display: 'flex', flexDirection: 'column', width: '100%', marginBottom: '16px' }}>
            <label className="range-slider-label" style={{ display: 'block', width: '100%', marginBottom: '8px' }}>{label}</label>
            <div className="range-slider-inputs" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px', width: '100%' }}>
                <input
                    type="number"
                    className="range-slider-input"
                    placeholder={`Min (${min})`}
                    value={minValue ?? ''}
                    onChange={handleMinChange}
                    min={min}
                    max={max}
                    step={step}
                />
                <span className="range-slider-separator">-</span>
                <input
                    type="number"
                    className="range-slider-input"
                    placeholder={`Max (${max})`}
                    value={maxValue ?? ''}
                    onChange={handleMaxChange}
                    min={min}
                    max={max}
                    step={step}
                />
                {unit && <span className="range-slider-unit">{unit}</span>}
            </div>
        </div>
    );
};

export default RangeSlider;
