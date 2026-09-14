export function analyzeInteractiveSource(
  source: string,
  fileName: string,
  options?: { exceptionMarkers?: readonly string[] },
): string[];

export function analyzeChartColorSource(source: string, fileName: string): string[];
