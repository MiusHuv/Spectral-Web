import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { useAppContext } from '../../context/AppContext';
import './SpectralChart.css';

interface SimpleSpectralChartProps {
  selectedAsteroids: number[];
  asteroidData: Record<number, any>;
}

type ChartSeries = {
  id: number;
  name: string;
  color: string;
  data: [number, number][];
};

const getAsteroidDisplayName = (asteroid: any, fallbackId: number): string => {
  if (asteroid?.proper_name) {
    return asteroid.proper_name;
  }
  if (asteroid?.official_number) {
    return `(${asteroid.official_number})`;
  }
  if (asteroid?.provisional_designation) {
    return asteroid.provisional_designation;
  }
  if (asteroid?.display_name) {
    return asteroid.display_name;
  }
  return `Asteroid ${fallbackId}`;
};

const SimpleSpectralChart: React.FC<SimpleSpectralChartProps> = ({
  selectedAsteroids,
  asteroidData
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const { state, dispatch } = useAppContext();
  const [isRendering, setIsRendering] = useState(false);
  const [renderTimeout, setRenderTimeout] = useState<NodeJS.Timeout | null>(null);

  // Throttled chart rendering with batch processing
  useEffect(() => {
    // Clear existing timeout
    if (renderTimeout) {
      clearTimeout(renderTimeout);
    }

    // Set rendering state
    setIsRendering(true);

    // Create new timeout for throttled rendering
    const timeout = setTimeout(() => {
      if (svgRef.current) {
        renderChart(svgRef.current);
      }
      setIsRendering(false);
    }, 150); // 150ms throttle

    setRenderTimeout(timeout);

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [selectedAsteroids, asteroidData, state.spectralData, state.asteroidData, state.focusedAsteroidId]);

  // Chart rendering function
  const renderChart = useCallback((svgElement: SVGSVGElement) => {
    const svgRoot = d3.select(svgElement);

    if (selectedAsteroids.length === 0) {
      svgRoot.selectAll('*').remove();
      if (state.focusedAsteroidId !== null) {
        dispatch({ type: 'SET_FOCUSED_ASTEROID', payload: null });
      }
      return;
    }

    const spectralData = selectedAsteroids
      .map((id) => state.spectralData[id])
      .filter(Boolean);

    svgRoot.selectAll('*').remove();

    const margin = { top: 20, right: 180, bottom: 60, left: 80 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    svgRoot.attr(
      'viewBox',
      `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`
    );

    const g = svgRoot
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    if (spectralData.length === 0) {
      g.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#1d1d1f')
        .style('font-size', '16px')
        .text('No spectral data loaded for the selected asteroids yet.');
      return;
    }

    // Data validation and processing
    const isFiniteNumber = (value: unknown): value is number =>
      typeof value === 'number' && Number.isFinite(value);

    const isNumericArray = (value: unknown): value is number[] =>
      Array.isArray(value) && value.length > 0 && value.every(isFiniteNumber);

    const isNumericOrNullArray = (
      value: unknown
    ): value is Array<number | null | undefined> =>
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((item) => item == null || isFiniteNumber(item));

    const hasFiniteValue = (value: unknown): boolean =>
      Array.isArray(value) && value.some(isFiniteNumber);

    const diagnostics = spectralData.map((d) => ({
      asteroid_id: d.asteroid_id,
      wavelengthsLength: Array.isArray(d.wavelengths) ? d.wavelengths.length : 0,
      wavelengthsNumeric: isNumericArray(d.wavelengths),
      reflectancesLength: Array.isArray(d.reflectances) ? d.reflectances.length : 0,
      reflectancesNumeric: isNumericOrNullArray(d.reflectances),
      reflectancesHasData: hasFiniteValue(d.reflectances),
      lengthMatch:
        Array.isArray(d.wavelengths) &&
        Array.isArray(d.reflectances) &&
        d.wavelengths.length === d.reflectances.length,
      normalized: d.normalized ?? false
    }));

    const validSpectra = spectralData.filter((spectrum) => {
      const issues: string[] = [];

      if (!Array.isArray(spectrum.wavelengths) || spectrum.wavelengths.length === 0) {
        issues.push('wavelengths missing');
      } else if (!isNumericArray(spectrum.wavelengths)) {
        issues.push('wavelengths non-numeric');
      }

      if (!Array.isArray(spectrum.reflectances) || !hasFiniteValue(spectrum.reflectances)) {
        issues.push('reflectances missing');
      } else if (!isNumericOrNullArray(spectrum.reflectances)) {
        issues.push('reflectances invalid');
      }

      if (
        Array.isArray(spectrum.wavelengths) &&
        Array.isArray(spectrum.reflectances) &&
        spectrum.wavelengths.length !== spectrum.reflectances.length
      ) {
        issues.push('length mismatch');
      }

      if (issues.length > 0) {
        console.warn(`Invalid spectrum for asteroid ${spectrum.asteroid_id}:`, issues);
        return false;
      }

      return true;
    });

    console.groupCollapsed('[SimpleSpectralChart] diagnostics');
    console.log('selectedAsteroids', selectedAsteroids);
    console.table(diagnostics);
    console.groupEnd();

    if (validSpectra.length === 0) {
      g.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#1d1d1f')
        .style('font-size', '16px')
        .text('No valid spectral data available.');
      return;
    }

    const allWavelengths = validSpectra.flatMap((d) => d.wavelengths || []);
    const allReflectances = validSpectra.flatMap((d) => d.reflectances || []);

    const xDomain =
      allWavelengths.length > 0
        ? [Math.min(...allWavelengths), Math.max(...allWavelengths)]
        : [0.45, 2.45];

    const yDomain =
      allReflectances.length > 0
        ? [0, Math.max(...allReflectances) * 1.1]
        : [0, 0.5];

    const xScale = d3.scaleLinear().domain(xDomain).range([0, width]);
    const yScale = d3.scaleLinear().domain(yDomain).range([height, 0]);

    const palette = d3.schemeTableau10;
    const series: ChartSeries[] = [];

    validSpectra.forEach((spectrum, index) => {
      const points: [number, number][] = [];
      const wavelengths = spectrum.wavelengths ?? [];
      const reflectances = spectrum.reflectances ?? [];

      for (let i = 0; i < wavelengths.length; i += 1) {
        const wavelength = wavelengths[i];
        const reflectance = reflectances[i];

        if (
          typeof wavelength === 'number' &&
          typeof reflectance === 'number' &&
          Number.isFinite(wavelength) &&
          Number.isFinite(reflectance)
        ) {
          points.push([wavelength, reflectance]);
        }
      }

      if (points.length === 0) {
        console.warn(`No valid data points for asteroid ${spectrum.asteroid_id}`);
        return;
      }

      const asteroid =
        asteroidData[spectrum.asteroid_id] ?? state.asteroidData[spectrum.asteroid_id];

      series.push({
        id: spectrum.asteroid_id,
        name: getAsteroidDisplayName(asteroid, spectrum.asteroid_id),
        color: palette[index % palette.length],
        data: points
      });
    });

    if (series.length === 0) {
      g.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#1d1d1f')
        .style('font-size', '16px')
        .text('No valid spectral samples found.');
      return;
    }

    // Render axes
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickFormat((d) => `${d} μm`)
          .tickSize(-height)
          .tickPadding(10)
      )
      .selectAll('text')
      .style('fill', '#86868b')
      .style('font-size', '12px');

    g.append('g')
      .call(
        d3
          .axisLeft(yScale)
          .tickSize(-width)
          .tickPadding(10)
      )
      .selectAll('text')
      .style('fill', '#86868b')
      .style('font-size', '12px');

    g.selectAll('.tick line').style('stroke', '#f0f0f0').style('stroke-width', '1px');
    g.selectAll('.domain').style('display', 'none');

    // Add axis labels
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left + 15)
      .attr('x', 0 - height / 2)
      .style('text-anchor', 'middle')
      .style('fill', '#86868b')
      .style('font-size', '13px')
      .text('Reflectance');

    g.append('text')
      .attr('transform', `translate(${width / 2}, ${height + margin.bottom - 5})`)
      .style('text-anchor', 'middle')
      .style('fill', '#86868b')
      .style('font-size', '13px')
      .text('Wavelength (μm)');

    // Render spectral lines
    const lineGenerator = d3
      .line<[number, number]>()
      .x((d) => xScale(d[0]))
      .y((d) => yScale(d[1]))
      .curve(d3.curveLinear);

    const linesGroup = g.append('g').attr('class', 'spectral-lines');

    linesGroup
      .selectAll<SVGPathElement, ChartSeries>('.spectral-line')
      .data(series)
      .enter()
      .append('path')
      .attr('class', 'spectral-line')
      .attr('d', (d) => lineGenerator(d.data) ?? '')
      .attr('stroke', (d) => d.color)
      .attr('fill', 'none')
      .attr('stroke-width', 2.5)
      .attr('stroke-linecap', 'round');

    // Add interactive hit areas
    linesGroup
      .selectAll<SVGPathElement, ChartSeries>('.spectral-line-hit')
      .data(series)
      .enter()
      .append('path')
      .attr('class', 'spectral-line-hit')
      .attr('d', (d) => lineGenerator(d.data) ?? '')
      .attr('fill', 'none')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 12)
      .style('pointer-events', 'stroke')
      .style('cursor', 'pointer');

    // Render legend
    const legend = svgRoot
      .append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${margin.left + width + 20}, ${margin.top})`);

    const legendItems = legend
      .selectAll<SVGGElement, ChartSeries>('.legend-item')
      .data(series)
      .enter()
      .append('g')
      .attr('class', 'legend-item')
      .attr('transform', (_d, i) => `translate(0, ${i * 28})`);

    legendItems
      .append('line')
      .attr('x1', 0)
      .attr('x2', 24)
      .attr('y1', 10)
      .attr('y2', 10)
      .attr('stroke', (d) => d.color)
      .attr('stroke-width', 3);

    legendItems
      .append('text')
      .attr('x', 30)
      .attr('y', 10)
      .attr('dy', '0.35em')
      .style('fill', '#1d1d1f')
      .style('font-size', '13px')
      .text((d) => d.name);

    // Set up interactions
    let currentFocusedId: number | null = state.focusedAsteroidId ?? null;

    const applyHighlight = (activeId: number | null) => {
      linesGroup
        .selectAll('.spectral-line')
        .attr('stroke-width', (d: any) => (activeId === null || d.id === activeId ? 3.5 : 2))
        .attr('opacity', (d: any) => (activeId === null || d.id === activeId ? 1 : 0.2));

      legendItems
        .style('opacity', (d: any) => (activeId === null || d.id === activeId ? 1 : 0.6))
        .classed('legend-item-active', (d: any) => activeId !== null && d.id === activeId);
    };

    const focusSeries = (id: number) => {
      currentFocusedId = id;
      applyHighlight(id);
      dispatch({ type: 'SET_FOCUSED_ASTEROID', payload: id });
    };

    // Add event listeners
    linesGroup
      .selectAll('.spectral-line-hit')
      .on('mouseenter', function(_event, d: any) {
        focusSeries(d.id);
      })
      .on('mouseleave', function() {
        applyHighlight(currentFocusedId);
      });

    legendItems
      .style('cursor', 'pointer')
      .on('mouseenter', function(_event, d: any) {
        focusSeries(d.id);
      })
      .on('mouseleave', function() {
        applyHighlight(currentFocusedId);
      })
      .on('click', function(_event, d: any) {
        focusSeries(d.id);
      });

    // Set initial focus
    if (currentFocusedId === null || !series.some((s) => s.id === currentFocusedId)) {
      currentFocusedId = series[0]?.id ?? null;
      if (currentFocusedId !== null) {
        dispatch({ type: 'SET_FOCUSED_ASTEROID', payload: currentFocusedId });
      }
    }

    applyHighlight(currentFocusedId);
  }, [selectedAsteroids, asteroidData, state.spectralData, state.asteroidData, state.focusedAsteroidId, dispatch]);

  if (selectedAsteroids.length === 0) {
    return (
      <div className="spectral-chart-container">
        <div className="spectral-chart-empty">
          <h3>Spectral Analysis</h3>
          <p>Select asteroids to visualize their spectral curves.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="spectral-chart-container">
      <div className="chart-header">
        <h3>Spectral Analysis</h3>
        <p>
          {selectedAsteroids.length} asteroid
          {selectedAsteroids.length !== 1 ? 's' : ''} selected
          {isRendering && <span className="rendering-indicator">⟳</span>}
        </p>
      </div>
      <svg
        ref={svgRef}
        width="100%"
        height={450}
        className="spectral-chart-svg"
        style={{ background: '#ffffff', borderRadius: '8px' }}
      />
    </div>
  );
};

export default SimpleSpectralChart;
