import { fabric } from "fabric";
import { Canvas } from "../types/canvas";
import { Options } from "../types/options";

export const createCanvas = (options: Options): fabric.Canvas => {
  const canvasEle = document.getElementById(options.id);
  const parentEle = canvasEle?.parentElement;
  let height =
    parentEle != undefined &&
    options.height > parentEle.clientHeight &&
    options.boundToParentSize
      ? parentEle.clientHeight
      : options.height;
  let width =
    parentEle != undefined &&
    options.width > parentEle.clientWidth &&
    options.boundToParentSize
      ? parentEle.clientWidth
      : options.width;
  return new fabric.Canvas(options.id, {
    width: width,
    height: height,
    hoverCursor: "pointer",
    selection: false,
    allowTouchScrolling: true,
    enableRetinaScaling: false,
    isDrawingMode: false,
  });
};

export const setupCanvas = (canvas: fabric.Canvas) => {
  // Setup zoom
  // Set maximum zoom as 2000% and minimum as 10%
  function mouseZoom(this: Canvas, opt: fabric.IEvent) {
    const evt = opt.e as WheelEvent;
    const delta = evt.deltaY;
    let zoom = this.getZoom();
    zoom *= 0.999 ** delta;
    if (zoom > 20) {
      zoom = 20;
    }
    if (zoom < 0.1) {
      zoom = 0.1;
    }
    this.zoomToPoint({ x: evt.offsetX, y: evt.offsetY }, zoom);
    opt.e.preventDefault();
    opt.e.stopPropagation();
  }

  function touchZoom(this: Canvas, opt: any) {
    const evt = opt.e as TouchEvent;
    // Handle zoom only if 2 fingers are touching the screen
    if (evt.touches && evt.touches.length == 2) {
      this.isDragging = false;
      let point1 = new fabric.Point(
        evt.touches[0].clientX,
        evt.touches[0].clientY
      );
      let point2 = new fabric.Point(
        evt.touches[1].clientX,
        evt.touches[1].clientY
      );
      let midPoint = point1.midPointFrom(point2);
      if (opt.self.state == "start") {
        this.zoomStartScale = this.getZoom();
      }
      let delta = this.zoomStartScale * opt.self.scale;
      this.zoomToPoint(midPoint, delta);
      this.isDragging = true;
    }
  }

  function resetCanvas(this: Canvas) {
    var vpt = this.viewportTransform as number[];
    vpt[4] = this.getCenter().left - 200; // Using a constant here
    vpt[5] = 200; // Using a constant here
    this.setViewportTransform(vpt);
    this.setZoom(1);
    this.requestRenderAll();
  }

  canvas.on("mouse:wheel", mouseZoom);
  canvas.on("touch:gesture", touchZoom);
  canvas.on("touch:longpress", resetCanvas);
  canvas.on("mouse:dblclick", resetCanvas);

  // Setup pan by dragging on mouse press and hold
  canvas.on("mouse:down", function (this: Canvas, opt) {
    if (opt.target) {
      return;
    }
    var evt = opt.e as MouseEvent | TouchEvent;
    let isTouch =
      evt.type === "touchstart" && (evt as TouchEvent).touches.length === 1;
    this.isDragging = true;
    this.setCursor("grabbing");
    this.lastPosX = isTouch
      ? (evt as TouchEvent).touches[0].clientX
      : (evt as MouseEvent).clientX;
    this.lastPosY = isTouch
      ? (evt as TouchEvent).touches[0].clientY
      : (evt as MouseEvent).clientY;
  });

  canvas.on("mouse:move", function (this: Canvas, opt) {
    if (this.isDragging) {
      let isTouch = opt.e.type === "touchmove";
      var evt = opt.e as MouseEvent | TouchEvent;
      let clientX = isTouch
        ? (evt as TouchEvent).touches[0].clientX
        : (evt as MouseEvent).clientX;
      let clientY = isTouch
        ? (evt as TouchEvent).touches[0].clientY
        : (evt as MouseEvent).clientY;
      const zoom = this.getZoom();
      var vpt = this.viewportTransform as number[];
      vpt[4] += clientX - this.lastPosX;
      vpt[5] += clientY - this.lastPosY;

      // prevent infinite pan
      if (vpt[4] > this.getWidth()) {
        vpt[4] = this.getWidth();
      }
      if (vpt[4] < -(this.getWidth() * zoom)) {
        vpt[4] = -(this.getWidth() * zoom);
      }
      if (vpt[5] > this.getHeight()) {
        vpt[5] = this.getHeight();
      }
      if (vpt[5] < -(this.getHeight() * zoom)) {
        vpt[5] = -(this.getHeight() * zoom);
      }
      this.requestRenderAll();
      this.lastPosX = clientX;
      this.lastPosY = clientY;
    }
  });

  canvas.on("mouse:up", function (this: Canvas) {
    this.setViewportTransform(this.viewportTransform as number[]);
    this.isDragging = false;
  });
};
