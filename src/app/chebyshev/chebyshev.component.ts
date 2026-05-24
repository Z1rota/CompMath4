import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface IterationRow {
  index: number;
  tau: number;
  residualNorm: number;
  x: number[];
}

@Component({
  selector: 'app-chebyshev',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chebyshev.component.html',
  styleUrls: ['./chebyshev.component.css']
})
export class ChebyshevComponent {
  size = 3;
  epsilon = 0.0001;
  maxIterations = 100;

  matrix: number[][] = [
    [10, 1, 2],
    [1, 8, -1],
    [2, -1, 9]
  ];
  vector: number[] = [7, 4, 6];

  solution: number[] = [];
  iterations: IterationRow[] = [];
  errorMessage = '';
  infoMessage = '';

  onSizeChange(): void {
    const nextSize = this.clamp(Math.round(this.size), 2, 6);
    this.size = nextSize;
    this.matrix = Array.from({ length: nextSize }, (_, i) =>
      Array.from({ length: nextSize }, (_, j) => this.matrix[i]?.[j] ?? (i === j ? 5 : 0))
    );
    this.vector = Array.from({ length: nextSize }, (_, i) => this.vector[i] ?? 1);
    this.clearResult();
  }

  fillRandom(): void {
    const n = this.size;
    const random = () => Math.floor(Math.random() * 9) - 4;
    const nextMatrix = Array.from({ length: n }, () => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      let rowSum = 0;
      for (let j = i + 1; j < n; j++) {
        const value = random();
        nextMatrix[i][j] = value;
        nextMatrix[j][i] = value;
        rowSum += Math.abs(value);
      }
      for (let j = 0; j < i; j++) {
        rowSum += Math.abs(nextMatrix[i][j]);
      }
      nextMatrix[i][i] = rowSum + Math.floor(Math.random() * 7) + 6;
    }

    this.matrix = nextMatrix;
    this.vector = Array.from({ length: n }, () => Math.floor(Math.random() * 21) - 10);
    this.clearResult();
  }

  solve(): void {
    this.clearResult();

    try {
      this.validateInput();

      const lambdaMin = this.estimateLambdaMin();
      const lambdaMax = this.estimateLambdaMax();
      if (lambdaMin <= 0 || lambdaMax <= lambdaMin) {
        throw new Error('Матрица должна быть симметричной и положительно определенной');
      }

      const taus = this.buildChebyshevParameters(lambdaMin, lambdaMax, this.size);
      let x = Array(this.size).fill(0);

      for (let iteration = 1; iteration <= this.maxIterations; iteration++) {
        const residual = this.subtract(this.vector, this.multiplyMatrixVector(this.matrix, x));
        const residualNorm = this.norm(residual);

        this.iterations.push({
          index: iteration,
          tau: taus[(iteration - 1) % taus.length],
          residualNorm: Number(residualNorm.toFixed(4)),
          x: x.map(v => Number(v.toFixed(5)))
        });

        if (residualNorm <= this.epsilon) {
          this.solution = x;
          this.infoMessage = `Метод сошелся за ${iteration - 1} итераций`;
          return;
        }

        const tau = taus[(iteration - 1) % taus.length];
        x = x.map((value, i) => value + tau * residual[i]);
      }

      this.solution = x;
      this.infoMessage = 'Достигнут лимит итераций, проверьте невязку';
    } catch (error: any) {
      this.errorMessage = error.message || 'Не удалось решить систему';
    }
  }

  formatNumber(value: number): string {
    return Number.isFinite(value) ? value.toFixed(6) : '';
  }

  trackByIndex(index: number): number {
    return index;
  }

  clearResult(): void {
    this.solution = [];
    this.iterations = [];
    this.errorMessage = '';
    this.infoMessage = '';
  }

  private validateInput(): void {
    if (this.epsilon <= 0) {
      throw new Error('Точность должна быть больше нуля');
    }
    if (this.maxIterations < 1) {
      throw new Error('Количество итераций должно быть больше нуля');
    }
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        const value = Number(this.matrix[i][j]);
        if (!Number.isFinite(value)) {
          throw new Error('В матрице есть некорректные значения');
        }
        this.matrix[i][j] = value;
      }

      const bValue = Number(this.vector[i]);
      if (!Number.isFinite(bValue)) {
        throw new Error('В векторе b есть некорректные значения');
      }
      this.vector[i] = bValue;
    }

    for (let i = 0; i < this.size; i++) {
      for (let j = i + 1; j < this.size; j++) {
        if (Math.abs(this.matrix[i][j] - this.matrix[j][i]) > 0.000001) {
          throw new Error('Для метода Чебышева нужна симметричная матрица');
        }
      }
    }
  }

  private estimateLambdaMin(): number {
    let result = Number.POSITIVE_INFINITY;
    for (let i = 0; i < this.size; i++) {
      const radius = this.matrix[i].reduce((sum, value, j) => i === j ? sum : sum + Math.abs(value), 0);
      result = Math.min(result, this.matrix[i][i] - radius);
    }
    return result;
  }

  private estimateLambdaMax(): number {
    let result = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < this.size; i++) {
      const radius = this.matrix[i].reduce((sum, value, j) => i === j ? sum : sum + Math.abs(value), 0);
      result = Math.max(result, this.matrix[i][i] + radius);
    }
    return result;
  }

  private buildChebyshevParameters(lambdaMin: number, lambdaMax: number, count: number): number[] {
    const center = (lambdaMax + lambdaMin) / 2;
    const radius = (lambdaMax - lambdaMin) / 2;

    return Array.from({ length: count }, (_, i) => {
      const angle = ((2 * (i + 1) - 1) * Math.PI) / (2 * count);
      return 1 / (center - radius * Math.cos(angle));
    });
  }

  private multiplyMatrixVector(matrix: number[][], vector: number[]): number[] {
    return matrix.map(row => row.reduce((sum, value, i) => sum + value * vector[i], 0));
  }

  private subtract(a: number[], b: number[]): number[] {
    return a.map((value, i) => value - b[i]);
  }

  private norm(vector: number[]): number {
    return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
