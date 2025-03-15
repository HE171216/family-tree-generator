import { fabric } from "fabric";

export interface Canvas extends fabric.Canvas {
  isDragging: boolean;
  lastPosX: number;
  lastPosY: number;
  zoomStartScale: number;
}
