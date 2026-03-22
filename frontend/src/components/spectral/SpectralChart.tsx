import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import * as d3 from 'd3';
import { SpectralData, Asteroid, useAppContext } from '../../context/AppContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import './SpectralChart.css';

export interface SpectralChartProps {
  selectedAsteroids: number[];
  asteroidData: Record<number, Asteroid>;
  width?: number;
  height?: number;
  className?: string;
}

interface ChartDimensions {
  width: number;
  height: number;
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

interface ProcessedSpectralData extends SpectralData {
  color: string;
  asteroidName: string;
}

interface ZoomTransform {
  k: number;
  x: number;
  y: number;
}

const SpectralChart: React.FC<SpectralChartProps> = memo(({
  selectedAsteroids,
  asteroidData,
  width = 800,
  height = 500,
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<ChartDimensions>({
    width,
    height,
    margin: { top: 20, right: 120, bottom: 60, left: 80 },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomTransform, setZoomTransform] = useState<ZoomTransform>({ k: 1, x: 0, y: 0 });
  const [hoveredSpectrum, setHoveredSpectrum] = useState<number | null>(null);
  const [spectralData, setSpectralData] = useState<SpectralData[]>([]);

  const { state } = useAppContext();

  // Color scale for different spectra
  const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

  // Load spectral data when selected asteroids change
  useEffect(() => {
    if (selectedAsteroids.length === 0) {
      setSpectralData([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Get spectral data from context
    const loadedData: SpectralData[] = selectedAsteroids
      .map(id => state.spectralData[id])
      .filter(Boolean);

    // Debug: Log spectral data loading
    console.log('SpectralChart: Loading spectral data', {
      selectedAsteroids,
      availableSpectralData: Object.keys(state.spectralData),
      loadedDataCount: loadedData.length,
      loadedData: loadedData.map(d => ({
        asteroid_id: d.asteroid_id,
        wavelength_count: d.wavelengths?.length || 0,
        reflectance_count: d.reflectances?.length || 0,
        sample_wavelengths: d.wavelengths?.slice(0, 3) || [],
        sample_reflectances: d.reflectances?.slice(0, 3) || []
      }))
    });

    setSpectralData(loadedData);
    setIsLoading(false);
  }, [selectedAsteroids, state.spectralData]);

  // Process spectral data with colors and names
  const processedData: ProcessedSpectralData[] = spectralData.map((spectrum, index) => {
    const asteroid = asteroidData[spectrum.asteroid_id];
    const asteroidName = asteroid?.identifiers?.proper_name ||
      asteroid?.identifiers?.official_number?.toString() ||
      asteroid?.identifiers?.provisional_designation ||
      `Asteroid ${spectrum.asteroid_id}`;

    return {
      ...spectrum,
      color: colorScale(index.toString()),
      asteroidName,
    };
  });

  // Get wavelength and reflectance domains
  const getWavelengthDomain = useCallback((): [number, number] => {
    if (processedData.length === 0) return [0.45, 2.45]; // Default range

    const allWavelengths = processedData.flatMap(d => d.wavelengths);
    return d3.extent(allWavelengths) as [number, number];
  }, [processedData]);

  const getReflectanceDomain = useCallback((): [number, number] => {
    if (processedData.length === 0) return [0, 1];

    const allReflectances = processedData.flatMap(d => d.reflectances);
    const extent = d3.extent(allReflectances) as [number, number];

    // Add some padding to the domain
    const padding = (extent[1] - extent[0]) * 0.1;
    return [extent[0] - padding, extent[1] + padding];
  }, [processedData]);

  // Handle container resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        setDimensions(prev => ({
          ...prev,
          width: Math.max(400, containerWidth - 40), // Min width with padding
        }));
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reset zoom function
  const resetZoom = useCallback(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>();

    svg.transition()
      .duration(750)
      .call(zoomBehavior.transform, d3.zoomIdentity);

    setZoomTransform({ k: 1, x: 0, y: 0 });
  }, []);

  // Handle missing spectral data
  const validateSpectralData = useCallback((data: SpectralData[]): { valid: SpectralData[], invalid: SpectralData[] } => {
    const valid: SpectralData[] = [];
    const invalid: SpectralData[] = [];

    data.forEach(spectrum => {
      if (!spectrum.wavelengths || !spectrum.reflectances ||
        spectrum.wavelengths.length === 0 || spectrum.reflectances.length === 0 ||
        spectrum.wavelengths.length !== spectrum.reflectances.length) {
        invalid.push(spectrum);
      } else {
        valid.push(spectrum);
      }
    });

    return { valid, invalid };
  }, []);

  // Main chart rendering effect
  useEffect(() => {
    if (!svgRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      // Validate spectral data
      const { valid: validData, invalid: invalidData } = validateSpectralData(spectralData);

      if (validData.length === 0) {
        if (invalidData.length > 0) {
          setError(`No valid spectral data available for ${invalidData.length} asteroid${invalidData.length !== 1 ? 's' : ''}. Data may be missing or corrupted.`);
        }
        setIsLoading(false);
        return;
      }

      // Process only valid data
      const validProcessedData: ProcessedSpectralData[] = validData.map((spectrum, index) => {
        const asteroid = asteroidData[spectrum.asteroid_id];
        const asteroidName = asteroid?.identifiers?.proper_name ||
          asteroid?.identifiers?.official_number?.toString() ||
          asteroid?.identifiers?.provisional_designation ||
          `Asteroid ${spectrum.asteroid_id}`;

        return {
          ...spectrum,
          color: colorScale(index.toString()),
          asteroidName,
        };
      });

      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove(); // Clear previous content

      const { width: chartWidth, height: chartHeight, margin } = dimensions;
      const innerWidth = chartWidth - margin.left - margin.right;
      const innerHeight = chartHeight - margin.top - margin.bottom;

      // Create main group
      const g = svg
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      // Create clip path for zooming
      const clipPath = svg
        .append('defs')
        .append('clipPath')
        .attr('id', 'chart-clip')
        .append('rect')
        .attr('width', innerWidth)
        .attr('height', innerHeight);

      // Set up scales
      const xScale = d3
        .scaleLinear()
        .domain(getWavelengthDomain())
        .range([0, innerWidth]);

      const yScale = d3
        .scaleLinear()
        .domain(getReflectanceDomain())
        .range([innerHeight, 0]);

      // Create line generator
      const line = d3
        .line<[number, number]>()
        .x(d => xScale(d[0]))
        .y(d => yScale(d[1]))
        .curve(d3.curveLinear);

      // Create zoom behavior
      const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 10])
        .extent([[0, 0], [chartWidth, chartHeight]])
        .on('zoom', (event) => {
          const { transform } = event;
          setZoomTransform({ k: transform.k, x: transform.x, y: transform.y });

          // Update scales with zoom transform
          const newXScale = transform.rescaleX(xScale);
          const newYScale = transform.rescaleY(yScale);

          // Update axes
          g.select('.x-axis')
            .call(d3.axisBottom(newXScale).tickFormat(d => `${d}μm`).ticks(8));
          g.select('.y-axis')
            .call(d3.axisLeft(newYScale).tickFormat(d3.format('.2f')).ticks(6));

          // Update grid
          g.select('.x-grid')
            .call(d3.axisBottom(newXScale)
              .tickSize(-innerHeight)
              .tickFormat(() => '')
            );
          g.select('.y-grid')
            .call(d3.axisLeft(newYScale)
              .tickSize(-innerWidth)
              .tickFormat(() => '')
            );

          // Update spectral lines
          const newLine = d3
            .line<[number, number]>()
            .x(d => newXScale(d[0]))
            .y(d => newYScale(d[1]))
            .curve(d3.curveLinear);

          g.selectAll('.spectral-line')
            .attr('d', newLine);

          g.selectAll('.spectral-line-overlay')
            .attr('d', newLine);
        });

      // Apply zoom behavior to SVG
      svg.call(zoomBehavior);

      // Add axes
      const xAxis = d3.axisBottom(xScale)
        .tickFormat(d => `${d}μm`)
        .ticks(8);

      const yAxis = d3.axisLeft(yScale)
        .tickFormat(d3.format('.2f'))
        .ticks(6);

      g.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(xAxis);

      g.append('g')
        .attr('class', 'y-axis')
        .call(yAxis);

      // Add axis labels
      g.append('text')
        .attr('class', 'x-axis-label')
        .attr('text-anchor', 'middle')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + 45)
        .text('Wavelength (μm)');

      g.append('text')
        .attr('class', 'y-axis-label')
        .attr('text-anchor', 'middle')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerHeight / 2)
        .attr('y', -50)
        .text('Reflectance');

      // Add grid lines
      g.append('g')
        .attr('class', 'grid x-grid')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale)
          .tickSize(-innerHeight)
          .tickFormat(() => '')
        );

      g.append('g')
        .attr('class', 'grid y-grid')
        .call(d3.axisLeft(yScale)
          .tickSize(-innerWidth)
          .tickFormat(() => '')
        );

      // Create tooltip
      const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'spectral-tooltip')
        .style('opacity', 0)
        .style('position', 'absolute')
        .style('background', 'rgba(0, 0, 0, 0.9)')
        .style('color', 'white')
        .style('padding', '12px')
        .style('border-radius', '6px')
        .style('font-size', '12px')
        .style('pointer-events', 'none')
        .style('z-index', '1000')
        .style('box-shadow', '0 4px 12px rgba(0, 0, 0, 0.3)')
        .style('line-height', '1.4')
        .style('max-width', '250px');

      // Create chart area group with clipping
      const chartArea = g.append('g')
        .attr('clip-path', 'url(#chart-clip)');

      // Draw spectral lines
      validProcessedData.forEach((spectrum, spectrumIndex) => {
        const data: [number, number][] = spectrum.wavelengths.map((wavelength, i) => [
          wavelength,
          spectrum.reflectances[i],
        ]);

        // Add the line path
        const path = chartArea
          .append('path')
          .datum(data)
          .attr('class', 'spectral-line')
          .attr('fill', 'none')
          .attr('stroke', spectrum.color)
          .attr('stroke-width', hoveredSpectrum === spectrumIndex ? 3 : 2)
          .attr('d', line)
          .style('opacity', hoveredSpectrum !== null && hoveredSpectrum !== spectrumIndex ? 0.3 : 1);

        // Add invisible overlay for hover detection
        chartArea.append('path')
          .datum(data)
          .attr('class', 'spectral-line-overlay')
          .attr('fill', 'none')
          .attr('stroke', 'transparent')
          .attr('stroke-width', 15)
          .attr('d', line)
          .style('cursor', 'crosshair')
          .on('mouseover', function (event) {
            setHoveredSpectrum(spectrumIndex);

            // Highlight the corresponding line
            path.attr('stroke-width', 3);

            // Dim other lines
            chartArea.selectAll('.spectral-line')
              .style('opacity', (_, i) => i === spectrumIndex ? 1 : 0.3);

            tooltip
              .style('opacity', 1)
              .html(`<strong>${spectrum.asteroidName}</strong><br/>
                     Asteroid ID: ${spectrum.asteroid_id}<br/>
                     Normalized: ${spectrum.normalized ? 'Yes' : 'No'}<br/>
                     Data points: ${spectrum.wavelengths.length}`);
          })
          .on('mousemove', function (event) {
            const [mouseX] = d3.pointer(event, this);
            const currentXScale = zoomTransform.k !== 1 ?
              d3.zoomTransform(svg.node()!).rescaleX(xScale) : xScale;
            const wavelength = currentXScale.invert(mouseX);

            // Find closest data point using binary search for better performance
            let closestIndex = 0;
            let left = 0;
            let right = spectrum.wavelengths.length - 1;

            while (left <= right) {
              const mid = Math.floor((left + right) / 2);
              if (spectrum.wavelengths[mid] < wavelength) {
                left = mid + 1;
              } else {
                right = mid - 1;
              }
            }

            // Check which of the two closest points is actually closer
            if (left < spectrum.wavelengths.length) {
              if (left > 0) {
                const leftDist = Math.abs(spectrum.wavelengths[left - 1] - wavelength);
                const rightDist = Math.abs(spectrum.wavelengths[left] - wavelength);
                closestIndex = leftDist < rightDist ? left - 1 : left;
              } else {
                closestIndex = left;
              }
            } else {
              closestIndex = spectrum.wavelengths.length - 1;
            }

            const closestWavelength = spectrum.wavelengths[closestIndex];
            const closestReflectance = spectrum.reflectances[closestIndex];

            tooltip
              .style('left', (event.pageX + 15) + 'px')
              .style('top', (event.pageY - 10) + 'px')
              .html(`<strong>${spectrum.asteroidName}</strong><br/>
                     <strong>Wavelength:</strong> ${closestWavelength.toFixed(3)}μm<br/>
                     <strong>Reflectance:</strong> ${closestReflectance.toFixed(4)}<br/>
                     <strong>Normalized:</strong> ${spectrum.normalized ? 'Yes' : 'No'}<br/>
                     <strong>Point:</strong> ${closestIndex + 1} of ${spectrum.wavelengths.length}`);
          })
          .on('mouseout', function () {
            setHoveredSpectrum(null);
            path.attr('stroke-width', 2);

            // Restore opacity for all lines
            chartArea.selectAll('.spectral-line')
              .style('opacity', 1);

            tooltip.style('opacity', 0);
          });
      });

      // Add legend
      const legend = g
        .append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${innerWidth + 20}, 20)`);

      const legendItems = legend
        .selectAll('.legend-item')
        .data(validProcessedData)
        .enter()
        .append('g')
        .attr('class', 'legend-item')
        .attr('transform', (_, i) => `translate(0, ${i * 30})`)
        .style('cursor', 'pointer');

      legendItems
        .append('line')
        .attr('x1', 0)
        .attr('x2', 20)
        .attr('y1', 0)
        .attr('y2', 0)
        .attr('stroke', d => d.color)
        .attr('stroke-width', 2);

      legendItems
        .append('text')
        .attr('x', 25)
        .attr('y', 0)
        .attr('dy', '0.35em')
        .attr('class', 'legend-text')
        .text(d => d.asteroidName.length > 15 ?
          d.asteroidName.substring(0, 15) + '...' :
          d.asteroidName);

      // Add legend interactions
      legendItems
        .on('mouseover', function (_, d) {
          const spectrumIndex = validProcessedData.findIndex(s => s.asteroid_id === d.asteroid_id);
          setHoveredSpectrum(spectrumIndex);

          // Highlight corresponding line
          chartArea.selectAll('.spectral-line')
            .style('opacity', (_, i) => i === spectrumIndex ? 1 : 0.3)
            .attr('stroke-width', (_, i) => i === spectrumIndex ? 3 : 2);

          // Highlight legend item
          d3.select(this).select('text')
            .style('font-weight', 'bold');
        })
        .on('mouseout', function () {
          setHoveredSpectrum(null);

          // Restore all lines
          chartArea.selectAll('.spectral-line')
            .style('opacity', 1)
            .attr('stroke-width', 2);

          // Restore legend text
          d3.select(this).select('text')
            .style('font-weight', 'normal');
        });

      // Add zoom controls
      const zoomControls = g
        .append('g')
        .attr('class', 'zoom-controls')
        .attr('transform', `translate(${innerWidth - 100}, 10)`);

      // Reset zoom button
      const resetButton = zoomControls
        .append('g')
        .attr('class', 'reset-zoom-btn')
        .style('cursor', 'pointer')
        .on('click', resetZoom);

      resetButton
        .append('rect')
        .attr('width', 80)
        .attr('height', 25)
        .attr('rx', 3)
        .attr('fill', '#f0f0f0')
        .attr('stroke', '#ccc')
        .attr('stroke-width', 1);

      resetButton
        .append('text')
        .attr('x', 40)
        .attr('y', 17)
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('fill', '#333')
        .text('Reset Zoom');

      // Show warning for invalid data
      if (invalidData.length > 0) {
        console.warn(`${invalidData.length} asteroid(s) have invalid spectral data and were excluded from visualization`);
      }

      // Cleanup tooltip on component unmount
      return () => {
        d3.selectAll('.spectral-tooltip').remove();
      };

    } catch (err) {
      console.error('Error rendering spectral chart:', err);
      setError('Failed to render spectral chart. Please try refreshing the page.');
    } finally {
      setIsLoading(false);
    }
  }, [spectralData, asteroidData, dimensions, getWavelengthDomain, getReflectanceDomain, colorScale, hoveredSpectrum, zoomTransform, resetZoom, validateSpectralData]);

  // Validate and process data for display
  const { valid: validData, invalid: invalidData } = validateSpectralData(spectralData);
  const validProcessedData: ProcessedSpectralData[] = validData.map((spectrum, index) => {
    const asteroid = asteroidData[spectrum.asteroid_id];
    const asteroidName = asteroid?.identifiers?.proper_name ||
      asteroid?.identifiers?.official_number?.toString() ||
      asteroid?.identifiers?.provisional_designation ||
      `Asteroid ${spectrum.asteroid_id}`;

    return {
      ...spectrum,
      color: colorScale(index.toString()),
      asteroidName,
    };
  });

  // Handle empty or invalid data
  if (selectedAsteroids.length === 0) {
    return (
      <div className={`spectral-chart-container ${className}`} ref={containerRef}>
        <div className="spectral-chart-empty">
          <p>No spectral data available</p>
          <p className="spectral-chart-empty-subtitle">
            Select asteroids from the taxonomy tree to view their spectral curves
          </p>
        </div>
      </div>
    );
  }

  if (isLoading && spectralData.length === 0) {
    return (
      <div className={`spectral-chart-container ${className}`} ref={containerRef}>
        <LoadingSpinner message="Loading spectral data..." />
      </div>
    );
  }

  if (validData.length === 0 && invalidData.length > 0) {
    return (
      <div className={`spectral-chart-container ${className}`} ref={containerRef}>
        <div className="spectral-chart-empty">
          <p>No valid spectral data available</p>
          <p className="spectral-chart-empty-subtitle">
            {invalidData.length} asteroid{invalidData.length !== 1 ? 's have' : ' has'} missing or corrupted spectral data
          </p>
          <p className="spectral-chart-empty-subtitle">
            Try selecting different asteroids or contact support if this issue persists
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`spectral-chart-container ${className}`} ref={containerRef}>
      {error && <ErrorMessage message={error} />}
      {isLoading && <LoadingSpinner />}

      <div className="spectral-chart-header">
        <h3>Spectral Data Visualization</h3>
        <div className="spectral-chart-info">
          <p className="spectral-chart-subtitle">
            {validProcessedData.length} asteroid{validProcessedData.length !== 1 ? 's' : ''} displayed
            {invalidData.length > 0 && (
              <span className="spectral-chart-warning">
                {' '}({invalidData.length} excluded due to invalid data)
              </span>
            )}
          </p>
          <p className="spectral-chart-instructions">
            Drag to pan • Scroll to zoom • Hover for details • Click "Reset Zoom" to restore view
          </p>
        </div>
      </div>

      <div className="spectral-chart-wrapper">
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="spectral-chart-svg"
        />
      </div>

      <div ref={tooltipRef} className="spectral-tooltip-container" />
    </div>
  );
});

SpectralChart.displayName = 'SpectralChart';

export default SpectralChart;