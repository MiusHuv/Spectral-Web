/**
 * Scientific color mapping for asteroid taxonomic classifications
 * Based on standard spectral type color schemes used in astronomy
 */

// Bus-DeMeo classification colors
export const busDeMeoColors: Record<string, string> = {
  // Silicate-rich (S-complex) - Red/Orange tones
  'S': '#FF6B35',   // Bright orange-red
  'Sa': '#FF8C42',  // Orange
  'Sq': '#FF9F1C',  // Golden orange
  'Sqw': '#FFB627', // Golden yellow
  'Sr': '#FF7F51',  // Coral
  'Srw': '#FF9A8B', // Light coral
  'Sv': '#FF6B6B', // Red-orange
  'Svw': '#FF8E8E', // Light red
  'Sw': '#FFA07A',  // Light salmon
  'Sl': '#FF7256',  // Tomato
  'SK': '#FF4500',  // Orange red
  
  // Carbonaceous (C-complex) - Blue/Gray tones
  'C': '#4A90E2',   // Blue
  'Cb': '#5BA3F5',  // Light blue
  'Cg': '#6BB6FF',  // Sky blue
  'Cgh': '#7EC8E3', // Light sky blue
  'Ch': '#91D5FF',  // Pale blue
  'B': '#2E5BBA',   // Dark blue
  
  // Primitive/Organic - Dark tones
  'D': '#2C3E50',   // Dark blue-gray
  'T': '#34495E',   // Dark gray
  'P': '#455A64',   // Blue-gray
  
  // Metallic (X-complex) - Gray/Silver tones
  'X': '#95A5A6',   // Gray
  'Xc': '#BDC3C7',  // Light gray
  'Xe': '#D5DBDB',  // Very light gray
  'Xk': '#85929E',  // Dark gray
  'Xn': '#AEB6BF',  // Medium gray
  
  // Rare types - Distinctive colors
  'A': '#E74C3C',   // Red (high albedo)
  'E': '#F39C12',   // Orange (enstatite)
  'K': '#8E44AD',   // Purple
  'L': '#27AE60',   // Green
  'Ld': '#2ECC71',  // Light green
  'O': '#E67E22',   // Dark orange
  'Q': '#F1C40F',   // Yellow
  'Qw': '#F4D03F',  // Light yellow
  'R': '#C0392B',   // Dark red
  'U': '#16A085',   // Teal
  'V': '#9B59B6',   // Violet (basaltic)
  'Vw': '#BB8FCE', // Light violet
  
  // Complex types
  'TCG': '#48C9B0', // Turquoise
};

// Tholen classification colors
export const tholenColors: Record<string, string> = {
  // Main types
  'S': '#FF6B35',   // Orange-red (silicate)
  'C': '#4A90E2',   // Blue (carbonaceous)
  'M': '#95A5A6',   // Gray (metallic)
  'X': '#85929E',   // Dark gray
  'P': '#455A64',   // Blue-gray (primitive)
  'D': '#2C3E50',   // Dark blue-gray
  'T': '#34495E',   // Dark gray
  'B': '#2E5BBA',   // Dark blue
  'F': '#3498DB',   // Light blue
  'G': '#1ABC9C',   // Turquoise
  'A': '#E74C3C',   // Red
  'E': '#F39C12',   // Orange
  'Q': '#F1C40F',   // Yellow
  'R': '#C0392B',   // Dark red
  'V': '#9B59B6',   // Violet
  'I': '#E91E63',   // Pink
  'Z': '#607D8B',   // Blue-gray
  
  // Compound types (combinations)
  'AS': '#FF8C42',  // Orange blend
  'BC': '#3F7CAC',  // Blue blend
  'BCF': '#4A8BC2', // Blue blend
  'BCU': '#5499C7', // Blue blend
  'BFC': '#5DADE2', // Light blue blend
  'BU': '#6BB6FF',  // Light blue
  'CD': '#3A5998',  // Dark blue blend
  'CF': '#52A3CC',  // Blue blend
  'CG': '#48C9B0',  // Turquoise blend
  'CP': '#4682B4',  // Steel blue
  'CPF': '#5F9EA0', // Cadet blue
  'CSU': '#6495ED', // Cornflower blue
  'CU': '#7B68EE',  // Medium slate blue
  'CX': '#778899',  // Light slate gray
  'DCX': '#2F4F4F', // Dark slate gray
  'DU': '#36454F',  // Charcoal
  'FC': '#20B2AA',  // Light sea green
  'FCB': '#40E0D0', // Turquoise
  'FP': '#00CED1',  // Dark turquoise
  'FX': '#5F9EA0',  // Cadet blue
  'GC': '#008B8B',  // Dark cyan
  'GU': '#2E8B57',  // Sea green
  'MU': '#696969',  // Dim gray
  'PC': '#483D8B',  // Dark slate blue
  'PCD': '#4B0082', // Indigo
  'PD': '#663399',  // Rebecca purple
  'PU': '#800080',  // Purple
  'QRS': '#DAA520', // Goldenrod
  'QSV': '#B8860B', // Dark goldenrod
  'QU': '#FFD700',  // Gold
  'SCTU': '#FF7F50', // Coral
  'SG': '#FF6347',  // Tomato
  'SQ': '#FF4500',  // Orange red
  'SR': '#DC143C',  // Crimson
  'ST': '#B22222',  // Fire brick
  'STGD': '#8B0000', // Dark red
  'STU': '#A0522D', // Sienna
  'SU': '#CD853F',  // Peru
  'XB': '#708090',  // Slate gray
  'XC': '#778899',  // Light slate gray
  'XD': '#2F4F4F',  // Dark slate gray
  'XDC': '#36454F', // Charcoal
  'XF': '#4682B4',  // Steel blue
  'XFCU': '#5F9EA0', // Cadet blue
  'XFU': '#6495ED', // Cornflower blue
  'XSCU': '#4169E1', // Royal blue
  
  // Uncertain classifications (with colons)
  'C:': '#87CEEB',  // Sky blue (uncertain C)
  'F:': '#87CEFA',  // Light sky blue (uncertain F)
  'GC:': '#20B2AA', // Light sea green (uncertain GC)
  'XB:': '#B0C4DE', // Light steel blue (uncertain XB)
  'XC:': '#D3D3D3', // Light gray (uncertain XC)
  'XD:': '#A9A9A9', // Dark gray (uncertain XD)
  'CDX:': '#6A5ACD', // Slate blue (uncertain CDX)
  'DCX:': '#483D8B', // Dark slate blue (uncertain DCX)
  'DU:': '#2F4F4F',  // Dark slate gray (uncertain DU)
  'AU:': '#FA8072',  // Salmon (uncertain A)
  'CPU:': '#9370DB', // Medium purple (uncertain CPU)
  'FXU:': '#8A2BE2', // Blue violet (uncertain FXU)
  'TCG:': '#00FA9A', // Medium spring green (uncertain TCG)
  'TSD': '#228B22', // Forest green
  'TDG': '#32CD32', // Lime green
  'TS': '#ADFF2F',  // Green yellow
  'FBCU::': '#40E0D0', // Turquoise (very uncertain)
  'BFU::': '#48D1CC',  // Medium turquoise (very uncertain)
};

/**
 * Get color for a classification based on the system
 */
export function getClassificationColor(classification: string, system: 'bus_demeo' | 'tholen'): string {
  const colors = system === 'bus_demeo' ? busDeMeoColors : tholenColors;
  return colors[classification] || '#6C757D'; // Default gray for unknown classifications
}

/**
 * Get a lighter version of the classification color for backgrounds
 */
export function getClassificationBackgroundColor(classification: string, system: 'bus_demeo' | 'tholen', opacity: number = 0.1): string {
  const color = getClassificationColor(classification, system);
  // Convert hex to rgba with opacity
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Get contrasting text color (black or white) for a given background color
 */
export function getContrastingTextColor(backgroundColor: string): string {
  // Convert hex to RGB
  const r = parseInt(backgroundColor.slice(1, 3), 16);
  const g = parseInt(backgroundColor.slice(3, 5), 16);
  const b = parseInt(backgroundColor.slice(5, 7), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black for light backgrounds, white for dark backgrounds
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * Get all available colors for a classification system
 */
export function getAllClassificationColors(system: 'bus_demeo' | 'tholen'): Record<string, string> {
  return system === 'bus_demeo' ? { ...busDeMeoColors } : { ...tholenColors };
}

/**
 * Generate a color palette for spectral chart lines
 */
export function getSpectralLineColors(): string[] {
  return [
    '#FF6B35', // Orange-red
    '#4A90E2', // Blue
    '#27AE60', // Green
    '#9B59B6', // Purple
    '#F39C12', // Orange
    '#E74C3C', // Red
    '#1ABC9C', // Turquoise
    '#F1C40F', // Yellow
    '#95A5A6', // Gray
    '#34495E', // Dark gray
  ];
}