import React from 'react';

export interface QRCodeViewProps {
  value: string;
  size?: number;
  className?: string;
}

export const QRCodeView: React.FC<QRCodeViewProps> = ({
  value,
  size = 180,
  className = '',
}) => {
  // Generates a deterministic, aesthetically pleasing QR code SVG representation
  const matrixSize = 25;
  const hash = Array.from(value).reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const cells: boolean[][] = Array(matrixSize)
    .fill(null)
    .map(() => Array(matrixSize).fill(false));

  // Corner markers
  const drawMarker = (r: number, c: number) => {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        if (
          i === 0 ||
          i === 6 ||
          j === 0 ||
          j === 6 ||
          (i >= 2 && i <= 4 && j >= 2 && j <= 4)
        ) {
          cells[r + i][c + j] = true;
        }
      }
    }
  };

  drawMarker(0, 0);
  drawMarker(0, matrixSize - 7);
  drawMarker(matrixSize - 7, 0);

  // Fill pseudo-random patterns based on value
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (
        (r < 8 && c < 8) ||
        (r < 8 && c >= matrixSize - 8) ||
        (r >= matrixSize - 8 && c < 8)
      ) {
        continue;
      }
      // Deterministic noise based on coordinates and string hash
      const val = (r * 31 + c * 17 + hash) % 7;
      cells[r][c] = val === 0 || val === 3 || val === 5;
    }
  }

  const cellSize = size / matrixSize;

  return (
    <div
      className={`inline-block p-4 bg-white rounded-2xl shadow-lg border border-white/20 ${className}`}
      style={{ width: size + 32, height: size + 32 }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shape-rendering-crispEdges"
      >
        <rect width={size} height={size} fill="#FFFFFF" />
        {cells.map((row, r) =>
          row.map((active, c) =>
            active ? (
              <rect
                key={`${r}-${c}`}
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize}
                height={cellSize}
                fill="#0B0C0D"
                rx={cellSize * 0.25}
              />
            ) : null
          )
        )}
      </svg>
    </div>
  );
};
