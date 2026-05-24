import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common'; 
import { FormsModule } from '@angular/forms';   
import { Chart, registerables } from 'chart.js';
import { LeastSquaresMath, Point, ApproximationResult } from './math.component';
import { ChebyshevComponent } from './chebyshev/chebyshev.component';

Chart.register(...registerables);

@Component({
  selector: 'app-root',
  standalone: true, 
  imports: [CommonModule, FormsModule, ChebyshevComponent], 
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  currentMode: 'approximation' | 'slae' = 'approximation';

  rawInput: string = '';
  errorMessage: string = '';
  logMessage: string = '';
  
  results: ApproximationResult[] = [];
  bestResult: ApproximationResult | null = null;
  points: Point[] = [];

  @ViewChild('chartCanvas') chartCanvas!: ElementRef;
  chartInstance: Chart | null = null;

  loadVariant1() {
    let inputStr = '';
    for (let x = 0; x <= 2.01; x += 0.2) {
      const y = (12 * x) / (Math.pow(x, 4) + 1);
      inputStr += `${x.toFixed(2)}\t${y.toFixed(4)}\n`;
    }
    this.rawInput = inputStr.trim();
    this.clearResults();
  }

  clearResults() {
    this.results = [];
    this.bestResult = null;
    this.errorMessage = '';
    this.logMessage = '';
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  }

  calculate() {
    this.clearResults();
    try {
      this.parseInput();
      if (this.points.length < 8 || this.points.length > 12) {
        this.logMessage = `Введено ${this.points.length} точек, но лучше от 8 до 12`;
      }

      this.results = LeastSquaresMath.calculateAll(this.points);
      
      this.bestResult = this.results.reduce((min, curr) => curr.S < min.S ? curr : min);

      this.drawChart();
    } catch (e: any) {
      this.errorMessage = e.message || 'Ошибка при вычислении, проверьте формат данных';
    }
  }

  exportResultsToFile() {
    if (!this.results.length) {
      return;
    }

    const lines: string[] = [];
    lines.push('Результаты аппроксимации');
    lines.push('');
    lines.push('Исходные данные:');
    lines.push('i\txi\tyi');
    this.points.forEach((point, index) => {
      lines.push(`${index + 1}\t${this.formatNumber(point.x)}\t${this.formatNumber(point.y)}`);
    });

    if (this.bestResult) {
      lines.push('');
      lines.push(`Наилучшая аппроксимация: ${this.bestResult.name}`);
      lines.push(`Уравнение: ${this.bestResult.equation}`);
    }

    this.results.forEach(result => {
      lines.push('');
      lines.push('----------------------------------------');
      lines.push(`Функция: ${result.name}`);
      lines.push(`Уравнение: ${result.equation}`);
      lines.push(`Коэффициенты: ${result.coefficients.map(value => this.formatNumber(value)).join('; ')}`);
      lines.push(`Среднеквадратичное отклонение: ${this.formatNumber(result.rmse)}`);
      lines.push(`Мера отклонения S: ${this.formatNumber(result.S)}`);
      lines.push('');
      lines.push('i\t\txi\t\tyi\t\tphi(xi)\t\teps_i');
      this.points.forEach((point, index) => {
        lines.push([
          index + 1,
          this.formatNumber(point.x),
          this.formatNumber(point.y),
          this.formatNumber(result.phi[index]),
          this.formatNumber(result.eps[index])
        ].join('\t'));
      });
    });

    const report = '\ufeff' + lines.join('\r\n');
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'approximation-results.txt';
    link.click();
    URL.revokeObjectURL(url);
  }

  private formatNumber(value: number): string {
    return Number.isFinite(value) ? value.toFixed(6) : String(value);
  }

  private parseInput() {
    this.points = [];
    const lines = this.rawInput.trim().split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/[\s\t,;]+/);
      if (parts.length >= 2) {
        const x = parseFloat(parts[0].replace(',', '.'));
        const y = parseFloat(parts[1].replace(',', '.'));
        if (!isNaN(x) && !isNaN(y)) {
          this.points.push({ x, y });
        }
      }
    }
    if (this.points.length < 2) {
      throw new Error('Введите минимум 2 точки.');
    }
    this.points.sort((a, b) => a.x - b.x);
  }

  private drawChart() {
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    const minX = this.points[0].x;
    const maxX = this.points[this.points.length - 1].x;
    const margin = (maxX - minX) * 0.1;
    const startX = minX - margin;
    const endX = maxX + margin;

    const lineData = [];
    const step = (endX - startX) / 100;
    for (let x = startX; x <= endX; x += step) {
      lineData.push({ x: x, y: this.bestResult!.func(x) });
    }

    const scatterData = this.points.map(p => ({ x: p.x, y: p.y }));

    this.chartInstance = new Chart(this.chartCanvas.nativeElement, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Исходные точки',
            data: scatterData,
            backgroundColor: 'red',
            pointRadius: 5
          },
          {
            type: 'line',
            label: `Лучшая аппроксимация: ${this.bestResult!.name}`,
            data: lineData,
            borderColor: 'blue',
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          x: { type: 'linear', position: 'bottom' }
        }
      }
    });
  }
}
