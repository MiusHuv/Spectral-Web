export class TestPerformanceMeasurer {
  private measurements: Map<string, number[]> = new Map();

  measure(name: string, fn: () => void): number {
    const start = performance.now();
    fn();
    const end = performance.now();
    const duration = end - start;

    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(duration);

    return duration;
  }

  async measureAsync(name: string, fn: () => Promise<unknown>): Promise<number> {
    const start = performance.now();
    await fn();
    const end = performance.now();
    const duration = end - start;

    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(duration);

    return duration;
  }

  getStats(name: string) {
    const measurements = this.measurements.get(name) || [];
    if (measurements.length === 0) return null;

    const sorted = [...measurements].sort((a, b) => a - b);
    return {
      count: measurements.length,
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      avg: measurements.reduce((a, b) => a + b, 0) / measurements.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
    };
  }

  clear() {
    this.measurements.clear();
  }

  getAllStats() {
    return Array.from(this.measurements.keys()).reduce<Record<string, ReturnType<TestPerformanceMeasurer['getStats']>>>((acc, key) => {
      acc[key] = this.getStats(key);
      return acc;
    }, {});
  }
}

export const generateLargeAsteroidDataset = (count: number) => {
  const classifications = ['C', 'S', 'X', 'M', 'P', 'D', 'T', 'B', 'F', 'G', 'L', 'O', 'Q', 'R', 'V'];

  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    official_number: i + 1,
    proper_name: `Asteroid ${i + 1}`,
    provisional_designation: `2023 A${String(i + 1).padStart(4, '0')}`,
    bus_demeo_class: classifications[i % classifications.length],
    tholen_class: classifications[i % classifications.length],
    has_spectral_data: Math.random() > 0.3,
    orbital_elements: {
      semi_major_axis: 2.0 + Math.random() * 3.0,
      eccentricity: Math.random() * 0.3,
      inclination: Math.random() * 30,
    },
    physical_properties: {
      diameter: Math.random() * 1000,
      albedo: Math.random() * 0.5,
    },
  }));
};

export const generatePaginatedResponse = (asteroids: any[], page: number, pageSize: number) => {
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pageAsteroids = asteroids.slice(startIndex, endIndex);

  return {
    asteroids: pageAsteroids,
    pagination: {
      page,
      pageSize,
      total: asteroids.length,
      totalPages: Math.ceil(asteroids.length / pageSize),
      hasMore: endIndex < asteroids.length,
      hasPrevious: page > 1,
    },
    cacheKey: `test-${page}-${pageSize}`,
  };
};
