export type TableShapeKind = "square" | "rectangle" | "round";

export type TableShapeProps = {
  /** Seats drawn around the table; not stored anywhere, only derived from capacity. */
  capacity: number;
  className?: string;
  /** The table's footprint in grid cells, already turned when rotated. */
  footprint: { height: number; width: number };
  shape: TableShapeKind;
};

/** SVG units per grid cell. */
const CELL = 40;
/** Room left around the table for the chairs. */
const MARGIN = 11;
const CHAIR_DEPTH = 7;
const CHAIR_WIDTH = 13;
/** More chairs than this would only blur together. */
const MAX_CHAIRS = 16;

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type Side = "bottom" | "left" | "right" | "top";

/** Gives each chair to the side with the most room left per chair, long sides first. */
function chairsPerSide(count: number, width: number, height: number) {
  const sides: Array<{ length: number; side: Side }> = [
    { length: width, side: "top" },
    { length: width, side: "bottom" },
    { length: height, side: "left" },
    { length: height, side: "right" },
  ];
  const counts: Record<Side, number> = { bottom: 0, left: 0, right: 0, top: 0 };
  for (let chair = 0; chair < count; chair += 1) {
    const best = sides.reduce((most, item) =>
      item.length / (counts[item.side] + 1) > most.length / (counts[most.side] + 1) ? item : most,
    );
    counts[best.side] += 1;
  }
  return counts;
}

/**
 * A table seen from above with its chairs around it. Purely visual: it
 * carries no text and is hidden from assistive technology, so the tile that
 * holds it names the table. Colors come from the tokens through CSS.
 */
export function TableShape({ capacity, className, footprint, shape }: TableShapeProps) {
  const width = footprint.width * CELL;
  const height = footprint.height * CELL;
  const table = {
    height: height - MARGIN * 2,
    width: width - MARGIN * 2,
    x: MARGIN,
    y: MARGIN,
  };
  const count = Math.max(0, Math.min(MAX_CHAIRS, Math.floor(capacity)));
  const chairs: Array<{ angle: number; x: number; y: number }> = [];

  if (shape === "round") {
    const radiusX = table.width / 2 + CHAIR_DEPTH / 2 + 2;
    const radiusY = table.height / 2 + CHAIR_DEPTH / 2 + 2;
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
      chairs.push({
        angle: (angle * 180) / Math.PI + 90,
        x: width / 2 + Math.cos(angle) * radiusX,
        y: height / 2 + Math.sin(angle) * radiusY,
      });
    }
  } else {
    const perSide = chairsPerSide(count, table.width, table.height);
    const along = (length: number, total: number, index: number) =>
      (length / total) * (index + 0.5);
    const offset = MARGIN - CHAIR_DEPTH / 2 - 2;
    for (let index = 0; index < perSide.top; index += 1) {
      chairs.push({ angle: 0, x: table.x + along(table.width, perSide.top, index), y: offset });
    }
    for (let index = 0; index < perSide.bottom; index += 1) {
      chairs.push({
        angle: 0,
        x: table.x + along(table.width, perSide.bottom, index),
        y: height - offset,
      });
    }
    for (let index = 0; index < perSide.left; index += 1) {
      chairs.push({ angle: 90, x: offset, y: table.y + along(table.height, perSide.left, index) });
    }
    for (let index = 0; index < perSide.right; index += 1) {
      chairs.push({
        angle: 90,
        x: width - offset,
        y: table.y + along(table.height, perSide.right, index),
      });
    }
  }

  return (
    <svg
      aria-hidden="true"
      className={classes("ui-table-shape", `ui-table-shape--${shape}`, className)}
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
      viewBox={`0 0 ${width} ${height}`}
    >
      {chairs.map((chair, index) => (
        <rect
          className="ui-table-shape__chair"
          height={CHAIR_DEPTH}
          key={index}
          rx={2.5}
          transform={`rotate(${chair.angle} ${chair.x} ${chair.y})`}
          width={CHAIR_WIDTH}
          x={chair.x - CHAIR_WIDTH / 2}
          y={chair.y - CHAIR_DEPTH / 2}
        />
      ))}
      {shape === "round" ? (
        <ellipse
          className="ui-table-shape__table"
          cx={width / 2}
          cy={height / 2}
          rx={table.width / 2}
          ry={table.height / 2}
        />
      ) : (
        <rect
          className="ui-table-shape__table"
          height={table.height}
          rx={shape === "square" ? 6 : 8}
          width={table.width}
          x={table.x}
          y={table.y}
        />
      )}
    </svg>
  );
}
