import {
  JOURNEY_LAYOUT_CONSTANTS,
  type JourneyEdgeData,
} from "../journey.ts";

export type JourneyHandlePosition = "bottom" | "left" | "right" | "top";

export interface JourneyEdgeRouteInput {
  data: JourneyEdgeData;
  sourcePosition: JourneyHandlePosition;
  sourceX: number;
  sourceY: number;
  targetPosition: JourneyHandlePosition;
  targetX: number;
  targetY: number;
}

export interface JourneyRoutePoint {
  x: number;
  y: number;
}

export interface JourneyEdgeRouteResult {
  end: JourneyRoutePoint;
  path: string;
  start: JourneyRoutePoint;
  strategy: "adjacent-advance" | "same-lane-rework" | "top-channel";
  waypoints: JourneyRoutePoint[];
}

const EDGE_SOURCE_OUTSET = 8;
const EDGE_TARGET_INSET = 14;
const HORIZONTAL_APPROACH_OFFSET = 18;
const REWORK_SLOT_STEP_X = 8;
const REWORK_SLOT_STEP_Y = 4;
const MIN_TOP_CHANNEL_Y = 10;

export function buildJourneyEdgeRoute(input: JourneyEdgeRouteInput): JourneyEdgeRouteResult {
  const start = offsetHandlePoint(input.sourceX, input.sourceY, input.sourcePosition, EDGE_SOURCE_OUTSET);
  const end = offsetHandlePoint(input.targetX, input.targetY, input.targetPosition, EDGE_TARGET_INSET);
  const laneDelta = input.data.targetLaneIndex - input.data.sourceLaneIndex;

  if (input.data.class === "rework" && laneDelta === 0) {
    return buildSameLaneReworkRoute(input.data, start, end);
  }

  if (input.data.class === "advance" && laneDelta === 1) {
    return buildAdjacentAdvanceRoute(start, end, input.data);
  }

  return buildTopChannelRoute(start, end, input.data);
}

function buildAdjacentAdvanceRoute(
  start: JourneyRoutePoint,
  end: JourneyRoutePoint,
  data: JourneyEdgeData,
): JourneyEdgeRouteResult {
  const gutterX = data.sourceLaneX + data.sourceLaneWidth + JOURNEY_LAYOUT_CONSTANTS.laneGapX / 2;
  const points = simplifyPoints([
    start,
    { x: gutterX, y: start.y },
    { x: gutterX, y: end.y },
    end,
  ]);

  return {
    end,
    path: buildRoundedPolylinePath(points, 24),
    start,
    strategy: "adjacent-advance",
    waypoints: points,
  };
}

function buildSameLaneReworkRoute(
  data: JourneyEdgeData,
  start: JourneyRoutePoint,
  end: JourneyRoutePoint,
): JourneyEdgeRouteResult {
  const sourceLaneRight = data.sourceLaneX + data.sourceLaneWidth;
  const rightCorridorX = sourceLaneRight + JOURNEY_LAYOUT_CONSTANTS.laneGapX / 2
    + data.routeSlot * REWORK_SLOT_STEP_X;
  const topChannelY = resolveTopChannelY(data.routeSlot);
  const leftApproachX = clamp(
    end.x - HORIZONTAL_APPROACH_OFFSET - data.routeSlot * (REWORK_SLOT_STEP_X / 2),
    data.targetLaneX + 8,
    end.x - 8,
  );
  const points = simplifyPoints([
    start,
    { x: rightCorridorX, y: start.y },
    { x: rightCorridorX, y: topChannelY },
    { x: leftApproachX, y: topChannelY },
    { x: leftApproachX, y: end.y },
    end,
  ]);

  return {
    end,
    path: buildRoundedPolylinePath(points, 16),
    start,
    strategy: "same-lane-rework",
    waypoints: points,
  };
}

function buildTopChannelRoute(
  start: JourneyRoutePoint,
  end: JourneyRoutePoint,
  data: JourneyEdgeData,
): JourneyEdgeRouteResult {
  const sourceLaneRight = data.sourceLaneX + data.sourceLaneWidth;
  const reworkOffset = data.class === "rework" ? data.routeSlot * REWORK_SLOT_STEP_X : 0;
  const sourceCorridorX = sourceLaneRight + JOURNEY_LAYOUT_CONSTANTS.laneGapX / 2 + reworkOffset;
  const targetApproachX = clamp(
    end.x - HORIZONTAL_APPROACH_OFFSET - (data.class === "rework" ? data.routeSlot * (REWORK_SLOT_STEP_X / 2) : 0),
    data.targetLaneX + 8,
    end.x - 8,
  );
  const topChannelY = resolveTopChannelY(data.class === "rework" ? data.routeSlot : 0);
  const points = simplifyPoints([
    start,
    { x: sourceCorridorX, y: start.y },
    { x: sourceCorridorX, y: topChannelY },
    { x: targetApproachX, y: topChannelY },
    { x: targetApproachX, y: end.y },
    end,
  ]);
  const radius = data.class === "exit" ? 12 : data.class === "rework" ? 14 : 18;

  return {
    end,
    path: buildRoundedPolylinePath(points, radius),
    start,
    strategy: "top-channel",
    waypoints: points,
  };
}

function offsetHandlePoint(
  x: number,
  y: number,
  position: JourneyHandlePosition,
  distance: number,
): JourneyRoutePoint {
  switch (position) {
    case "left":
      return { x: x - distance, y };
    case "right":
      return { x: x + distance, y };
    case "top":
      return { x, y: y - distance };
    case "bottom":
      return { x, y: y + distance };
  }
}

function resolveTopChannelY(routeSlot: number): number {
  return Math.max(
    MIN_TOP_CHANNEL_Y,
    JOURNEY_LAYOUT_CONSTANTS.canvasPaddingTop - 8 - routeSlot * REWORK_SLOT_STEP_Y,
  );
}

function buildRoundedPolylinePath(
  points: JourneyRoutePoint[],
  preferredRadius: number,
): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${formatNumber(points[0]!.x)} ${formatNumber(points[0]!.y)}`;

  let path = `M ${formatNumber(points[0]!.x)} ${formatNumber(points[0]!.y)}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    const next = points[index + 1]!;

    if (isCollinear(previous, current, next)) {
      path += ` L ${formatNumber(current.x)} ${formatNumber(current.y)}`;
      continue;
    }

    const radius = Math.min(
      preferredRadius,
      distanceBetween(previous, current) / 2,
      distanceBetween(current, next) / 2,
    );
    const before = movePointTowards(current, previous, radius);
    const after = movePointTowards(current, next, radius);

    path += ` L ${formatNumber(before.x)} ${formatNumber(before.y)}`;
    path += ` Q ${formatNumber(current.x)} ${formatNumber(current.y)} ${formatNumber(after.x)} ${formatNumber(after.y)}`;
  }

  const last = points[points.length - 1]!;
  path += ` L ${formatNumber(last.x)} ${formatNumber(last.y)}`;

  return path;
}

function simplifyPoints(points: JourneyRoutePoint[]): JourneyRoutePoint[] {
  const simplified: JourneyRoutePoint[] = [];

  for (const point of points) {
    const previous = simplified.at(-1);
    if (previous && approximatelyEqual(previous.x, point.x) && approximatelyEqual(previous.y, point.y)) {
      continue;
    }

    simplified.push(point);

    while (simplified.length >= 3) {
      const last = simplified[simplified.length - 1]!;
      const middle = simplified[simplified.length - 2]!;
      const first = simplified[simplified.length - 3]!;
      if (!isCollinear(first, middle, last)) break;
      simplified.splice(simplified.length - 2, 1);
    }
  }

  return simplified;
}

function movePointTowards(
  origin: JourneyRoutePoint,
  target: JourneyRoutePoint,
  distance: number,
): JourneyRoutePoint {
  const totalDistance = distanceBetween(origin, target);
  if (totalDistance === 0) return origin;
  const ratio = distance / totalDistance;

  return {
    x: origin.x + (target.x - origin.x) * ratio,
    y: origin.y + (target.y - origin.y) * ratio,
  };
}

function distanceBetween(first: JourneyRoutePoint, second: JourneyRoutePoint): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function isCollinear(
  first: JourneyRoutePoint,
  second: JourneyRoutePoint,
  third: JourneyRoutePoint,
): boolean {
  return (
    (approximatelyEqual(first.x, second.x) && approximatelyEqual(second.x, third.x))
    || (approximatelyEqual(first.y, second.y) && approximatelyEqual(second.y, third.y))
  );
}

function approximatelyEqual(first: number, second: number): boolean {
  return Math.abs(first - second) < 0.001;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value: number): string {
  return Number(value.toFixed(2)).toString();
}
