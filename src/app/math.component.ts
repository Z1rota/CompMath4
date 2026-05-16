export interface Point {
  x: number;
  y: number;
}

export interface ApproximationResult {
  name: string;
  type: string;
  equation: string;
  coefficients: number[];
  func: (x: number) => number;
  S: number; 
  rmse: number; 
  r2: number; 
  r2Message: string;
  pearson?: number; 
  phi: number[]; 
  eps: number[]; 
  isValid: boolean; 
}

export class LeastSquaresMath {
  
  private static solveGauss(matrix: number[][], vector: number[]): number[] {
    const n = vector.length;
    const a = matrix.map((row, i) => [...row, vector[i]]);

    for (let i = 0; i < n; i++) {
      let maxEl = Math.abs(a[i][i]);
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(a[k][i]) > maxEl) {
          maxEl = Math.abs(a[k][i]);
          maxRow = k;
        }
      }

      for (let k = i; k < n + 1; k++) {
        const tmp = a[maxRow][k];
        a[maxRow][k] = a[i][k];
        a[i][k] = tmp;
      }

      for (let k = i + 1; k < n; k++) {
        const c = -a[k][i] / a[i][i];
        for (let j = i; j < n + 1; j++) {
          if (i === j) {
            a[k][j] = 0;
          } else {
            a[k][j] += c * a[i][j];
          }
        }
      }
    }

    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = a[i][n] / a[i][i];
      for (let k = i - 1; k >= 0; k--) {
        a[k][n] -= a[k][i] * x[i];
      }
    }
    return x;
  }

  private static polyApproximation(points: Point[], m: number): number[] {
    const n = m + 1;
    const matrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
    const vector: number[] = Array(n).fill(0);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        matrix[i][j] = points.reduce((sum, p) => sum + Math.pow(p.x, i + j), 0);
      }
      vector[i] = points.reduce((sum, p) => sum + p.y * Math.pow(p.x, i), 0);
    }

    return this.solveGauss(matrix, vector);
  }

  private static calculateStats(points: Point[], func: (x: number) => number): any {
    let S = 0;
    let sumY = 0;
    const n = points.length;
    
    const phi: number[] = [];
    const eps: number[] = [];

    points.forEach(p => {
      const yCalc = func(p.x);
      const e = yCalc - p.y;
      phi.push(yCalc);
      eps.push(e);
      S += e * e;
      sumY += p.y;
    });

    const meanY = sumY / n;
    const rmse = Math.sqrt(S / n);
    
    let ssTot = 0;
    points.forEach(p => {
      ssTot += Math.pow(p.y - meanY, 2);
    });

    const r2 = 1 - (S / ssTot);
    
    let r2Message = "";
    if (r2 >= 0.95) r2Message = "Высокая точность аппроксимации";
    else if (r2 >= 0.75) r2Message = "Удовлетворительная аппроксимация";
    else if (r2 >= 0.5) r2Message = "Слабая аппроксимация";
    else r2Message = "Недостаточная точность";

    return { S, rmse, r2, r2Message, phi, eps };
  }

  public static calculateAll(points: Point[]): ApproximationResult[] {
    const results: ApproximationResult[] = [];
    const n = points.length;

    const linCoeffs = this.polyApproximation(points, 1);
    const linFunc = (x: number) => linCoeffs[1] * x + linCoeffs[0];
    const linStats = this.calculateStats(points, linFunc);
    
    const meanX = points.reduce((s, p) => s + p.x, 0) / n;
    const meanY = points.reduce((s, p) => s + p.y, 0) / n;
    let num = 0, den1 = 0, den2 = 0;
    points.forEach(p => {
      num += (p.x - meanX) * (p.y - meanY);
      den1 += Math.pow(p.x - meanX, 2);
      den2 += Math.pow(p.y - meanY, 2);
    });
    const pearson = num / Math.sqrt(den1 * den2);

    results.push({
      name: 'Линейная', type: 'lin', equation: `y = ${linCoeffs[1].toFixed(4)}x + ${linCoeffs[0].toFixed(4)}`,
      coefficients: linCoeffs, func: linFunc, pearson, isValid: true, ...linStats
    });

    const quadCoeffs = this.polyApproximation(points, 2);
    const quadFunc = (x: number) => quadCoeffs[2] * x * x + quadCoeffs[1] * x + quadCoeffs[0];
    results.push({
      name: 'Квадратичная', type: 'quad', equation: `y = ${quadCoeffs[2].toFixed(4)}x² + 
      ${quadCoeffs[1].toFixed(4)}x + ${quadCoeffs[0].toFixed(4)}`,
      coefficients: quadCoeffs, func: quadFunc, isValid: true, ...this.calculateStats(points, quadFunc)
    });

    const cubCoeffs = this.polyApproximation(points, 3);
    const cubFunc = (x: number) => cubCoeffs[3] * Math.pow(x, 3) + cubCoeffs[2] * x * x + cubCoeffs[1] * x + cubCoeffs[0];
    results.push({
      name: 'Кубическая', type: 'cube', equation: `y = ${cubCoeffs[3].toFixed(4)}x³ + 
      ${cubCoeffs[2].toFixed(4)}x² + ${cubCoeffs[1].toFixed(4)}x + ${cubCoeffs[0].toFixed(4)}`,
      coefficients: cubCoeffs, func: cubFunc, isValid: true, ...this.calculateStats(points, cubFunc)
    });

    if (points.every(p => p.y > 0)) {
      const expPoints = points.map(p => ({ x: p.x, y: Math.log(p.y) }));
      const expCoeffs = this.polyApproximation(expPoints, 1);
      const a = Math.exp(expCoeffs[0]);
      const b = expCoeffs[1];
      const expFunc = (x: number) => a * Math.exp(b * x);
      results.push({
        name: 'Экспоненциальная', type: 'exp', equation: `y = ${a.toFixed(4)} * e^(${b.toFixed(4)}x)`,
        coefficients: [a, b], func: expFunc, isValid: true, ...this.calculateStats(points, expFunc)
      });
    }

    if (points.every(p => p.x > 0)) {
      const logPoints = points.map(p => ({ x: Math.log(p.x), y: p.y }));
      const logCoeffs = this.polyApproximation(logPoints, 1);
      const a = logCoeffs[1];
      const b = logCoeffs[0];
      const logFunc = (x: number) => a * Math.log(x) + b;
      results.push({
        name: 'Логарифмическая', type: 'log', equation: `y = ${a.toFixed(4)}*ln(x) + ${b.toFixed(4)}`,
        coefficients: [a, b], func: logFunc, isValid: true, ...this.calculateStats(points, logFunc)
      });
    }

    if (points.every(p => p.x > 0 && p.y > 0)) {
      const powPoints = points.map(p => ({ x: Math.log(p.x), y: Math.log(p.y) }));
      const powCoeffs = this.polyApproximation(powPoints, 1);
      const a = Math.exp(powCoeffs[0]);
      const b = powCoeffs[1];
      const powFunc = (x: number) => a * Math.pow(x, b);
      results.push({
        name: 'Степенная', type: 'pow', equation: `y = ${a.toFixed(4)} * x^(${b.toFixed(4)})`,
        coefficients: [a, b], func: powFunc, isValid: true, ...this.calculateStats(points, powFunc)
      });
    }

    return results;
  }
}
