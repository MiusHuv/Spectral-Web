import React, { useEffect, useRef } from 'react';
import './SpectrumChart.css';

interface SpectrumData {
    id: string;
    name: string;
    wavelengths: number[];
    reflectances: (number | null)[];
    color?: string;
    type?: 'asteroid' | 'meteorite';
}

interface SpectrumChartProps {
    spectra: SpectrumData[];
    title?: string;
    height?: number;
    showLegend?: boolean;
    showGrid?: boolean;
    xLabel?: string;
    yLabel?: string;
}

const SpectrumChart: React.FC<SpectrumChartProps> = ({
    spectra,
    title = 'Spectral Reflectance',
    height = 400,
    showLegend = true,
    showGrid = true,
    xLabel = 'Wavelength (μm)',
    yLabel = 'Normalized Reflectance'
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!canvasRef.current || spectra.length === 0) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        const container = containerRef.current;
        if (container) {
            canvas.width = container.clientWidth;
            canvas.height = height;
        }

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Margins
        const margin = { top: 40, right: 20, bottom: 60, left: 60 };
        const width = canvas.width - margin.left - margin.right;
        const chartHeight = canvas.height - margin.top - margin.bottom;

        // Preprocess spectra: sort by wavelength and filter invalid values
        const processedSpectra = spectra.map(spectrum => {
            if (!spectrum.wavelengths || spectrum.wavelengths.length === 0) {
                return { ...spectrum, wavelengths: [], reflectances: [] };
            }
            
            // Create paired data
            const pairedData: Array<{wavelength: number, reflectance: number}> = [];
            for (let i = 0; i < spectrum.wavelengths.length; i++) {
                const wl = spectrum.wavelengths[i];
                const refl = spectrum.reflectances[i];
                
                // Filter out NaN, null, undefined, zero/negative wavelengths, negative reflectances, and non-finite values
                if (wl != null && refl != null && 
                    !isNaN(wl) && !isNaN(refl) && 
                    isFinite(wl) && isFinite(refl) &&
                    wl > 0 && refl >= 0) {
                    pairedData.push({ wavelength: wl, reflectance: refl });
                }
            }
            
            // Sort by wavelength
            pairedData.sort((a, b) => a.wavelength - b.wavelength);
            
            return {
                ...spectrum,
                wavelengths: pairedData.map(d => d.wavelength),
                reflectances: pairedData.map(d => d.reflectance)
            };
        });
        
        // Find data ranges
        let minWavelength = Infinity;
        let maxWavelength = -Infinity;
        let minReflectance = Infinity;
        let maxReflectance = -Infinity;

        processedSpectra.forEach(spectrum => {
            spectrum.wavelengths.forEach((wl, i) => {
                const refl = spectrum.reflectances[i];
                if (refl !== null && refl !== undefined) {
                    minWavelength = Math.min(minWavelength, wl);
                    maxWavelength = Math.max(maxWavelength, wl);
                    minReflectance = Math.min(minReflectance, refl);
                    maxReflectance = Math.max(maxReflectance, refl);
                }
            });
        });

        // Check if we have valid data
        if (!isFinite(minWavelength) || !isFinite(maxWavelength) || 
            !isFinite(minReflectance) || !isFinite(maxReflectance)) {
            ctx.fillStyle = '#991b1b';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No valid spectral data to display', canvas.width / 2, canvas.height / 2);
            return;
        }

        // Add padding to y-axis
        const yPadding = (maxReflectance - minReflectance) * 0.1;
        minReflectance -= yPadding;
        maxReflectance += yPadding;

        // Scale functions
        const xScale = (wl: number) => margin.left + ((wl - minWavelength) / (maxWavelength - minWavelength)) * width;
        const yScale = (refl: number) => margin.top + chartHeight - ((refl - minReflectance) / (maxReflectance - minReflectance)) * chartHeight;

        // Draw grid
        if (showGrid) {
            ctx.strokeStyle = '#e5e7eb';
            ctx.lineWidth = 1;

            // Vertical grid lines
            for (let i = 0; i <= 10; i++) {
                const x = margin.left + (width / 10) * i;
                ctx.beginPath();
                ctx.moveTo(x, margin.top);
                ctx.lineTo(x, margin.top + chartHeight);
                ctx.stroke();
            }

            // Horizontal grid lines
            for (let i = 0; i <= 10; i++) {
                const y = margin.top + (chartHeight / 10) * i;
                ctx.beginPath();
                ctx.moveTo(margin.left, y);
                ctx.lineTo(margin.left + width, y);
                ctx.stroke();
            }
        }

        // Draw axes
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(margin.left, margin.top);
        ctx.lineTo(margin.left, margin.top + chartHeight);
        ctx.lineTo(margin.left + width, margin.top + chartHeight);
        ctx.stroke();

        // Draw axis labels
        ctx.fillStyle = '#374151';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(xLabel, margin.left + width / 2, canvas.height - 10);

        ctx.save();
        ctx.translate(15, margin.top + chartHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(yLabel, 0, 0);
        ctx.restore();

        // Draw title
        if (title) {
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText(title, canvas.width / 2, 25);
        }

        // Draw tick labels
        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#6b7280';

        // X-axis ticks
        for (let i = 0; i <= 5; i++) {
            const wl = minWavelength + ((maxWavelength - minWavelength) / 5) * i;
            const x = xScale(wl);
            ctx.textAlign = 'center';
            ctx.fillText(wl.toFixed(2), x, margin.top + chartHeight + 20);
        }

        // Y-axis ticks
        for (let i = 0; i <= 5; i++) {
            const refl = minReflectance + ((maxReflectance - minReflectance) / 5) * i;
            const y = yScale(refl);
            ctx.textAlign = 'right';
            ctx.fillText(refl.toFixed(2), margin.left - 10, y + 4);
        }

        // Default colors
        const defaultColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

        // Draw spectra (use processed data)
        processedSpectra.forEach((spectrum, index) => {
            if (spectrum.wavelengths.length === 0) return;
            
            const color = spectrum.color || defaultColors[index % defaultColors.length];
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;

            ctx.beginPath();
            let started = false;

            spectrum.wavelengths.forEach((wl, i) => {
                const refl = spectrum.reflectances[i];
                if (refl !== null && refl !== undefined) {
                    const x = xScale(wl);
                    const y = yScale(refl);

                    if (!started) {
                        ctx.moveTo(x, y);
                        started = true;
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
            });

            ctx.stroke();
        });

        // Draw legend (use original spectra for names)
        if (showLegend && spectra.length > 1) {
            const legendX = margin.left + width - 150;
            const legendY = margin.top + 10;
            const lineHeight = 25;

            spectra.forEach((spectrum, index) => {
                const color = spectrum.color || defaultColors[index % defaultColors.length];
                const y = legendY + index * lineHeight;

                // Draw line
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(legendX, y);
                ctx.lineTo(legendX + 30, y);
                ctx.stroke();

                // Draw text
                ctx.fillStyle = '#374151';
                ctx.font = '12px sans-serif';
                ctx.textAlign = 'left';
                const label = spectrum.name.length > 20 ? spectrum.name.substring(0, 20) + '...' : spectrum.name;
                ctx.fillText(label, legendX + 40, y + 4);
            });
        }

    }, [spectra, height, title, showLegend, showGrid, xLabel, yLabel]);

    return (
        <div ref={containerRef} className="spectrum-chart-container">
            <canvas ref={canvasRef} className="spectrum-chart-canvas" />
        </div>
    );
};

export default SpectrumChart;
