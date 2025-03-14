import { fabric } from "fabric";
import imgUrl from "./assets/images/profile_img.png";

const fontSize = 18;
const minimumDistanceBetweenNodes = 200; // Tăng lên từ 150 để các node cách xa nhau hơn
const verticalDistanceBetweenNodes = 200;
const nodeRadius = 64;

// Highlight colors
const highlightColor = "#3498db"; // Màu xanh dương khi highlight
const defaultStrokeColor = "black"; // Màu mặc định của đường nối

export interface Relation {
  partner: Node | undefined;
  isMarried: boolean | undefined;
  children: Node[];
  _relation?: fabric.Line;
  _parentLine?: fabric.Line;
  isPrimaryRelationship?: boolean; // Thêm thuộc tính để đánh dấu đây là mối quan hệ chính hay phụ
}

export interface Node {
  id: string | number;
  name: string;
  image?: string;
  generation?: number;
  relationships: Relation[];
  onClick?: (node: Node) => void;
  _object?: fabric.Group;
  _childLine: fabric.Group;
  parent?: Node; // Thêm tham chiếu đến node cha
  parentRelation?: Relation; // Thêm tham chiếu đến mối quan hệ cha mẹ
}

interface Canvas extends fabric.Canvas {
  isDragging: boolean;
  lastPosX: number;
  lastPosY: number;
  zoomStartScale: number;
}

interface NodeGroupOptions extends fabric.IGroupOptions {
  isNode: boolean;
  nodeData?: Node; // Lưu trữ dữ liệu node
}

class NodeGroup extends fabric.Group {
  declare isNode: boolean;
  declare nodeData?: Node;

  constructor(objects: fabric.Object[], options: NodeGroupOptions) {
    super(objects, options);
    this.isNode = options.isNode;
    this.nodeData = options.nodeData;
  }
}

interface Options {
  id: string;
  width: number;
  height: number;
  boundToParentSize?: boolean;
}

const lineStyles = {
  stroke: defaultStrokeColor,
  strokeWidth: 3,
  selectable: false,
  evented: false,
};

export default class FamilyTree {
  private declare root: Node;
  declare canvas: fabric.Canvas;
  private highlightedNodes: fabric.Object[] = []; // Lưu trữ các node đang được highlight
  private highlightedLines: fabric.Object[] = []; // Lưu trữ các đường nối đang được highlight

  constructor(root: Node, options: Options) {
    this.root = root;
    this.canvas = this._createCanvas(options);
    this._setupCanvas();
  }

  private _createCanvas = (options: Options) => {
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

  private _setupCanvas = () => {
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
        console.log(midPoint);
        this.zoomToPoint(midPoint, delta);
        this.isDragging = true;
      }
    }
    function resetCanvas(this: Canvas) {
      var vpt = this.viewportTransform as number[];
      vpt[4] = this.getCenter().left - minimumDistanceBetweenNodes;
      vpt[5] = minimumDistanceBetweenNodes;
      this.setViewportTransform(vpt);
      this.setZoom(1);
      this.requestRenderAll();
    }

    this.canvas.on("mouse:wheel", mouseZoom);
    this.canvas.on("touch:gesture", touchZoom);
    this.canvas.on("touch:longpress", resetCanvas);
    this.canvas.on("mouse:dblclick", resetCanvas);

    // Setup pan by dragging on mouse press and hold
    this.canvas.on("mouse:down", function (this: Canvas, opt) {
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
    this.canvas.on("mouse:move", function (this: Canvas, opt) {
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
    this.canvas.on("mouse:up", function (this: Canvas) {
      // on mouse up we want to recalculate new interaction
      // for all objects, so we call setViewportTransform
      this.setViewportTransform(this.viewportTransform as number[]);
      this.isDragging = false;
    });
  };

  private _setImageSrc = async (
    imageObject: fabric.Image,
    imageUrl: string
  ): Promise<fabric.Image> => {
    return new Promise((resolve, reject) => {
      imageObject.setSrc(
        imageUrl,
        function (img: fabric.Image) {
          img.set({
            originX: "center",
            originY: "center",
          });
          if (imageObject) {
            resolve(imageObject);
          } else {
            reject("image src not set");
          }
        },
        { crossOrigin: "anonymous" }
      );
    });
  };

  private _createNode = async (
    text: string,
    imageUrl: string | undefined,
    node: Node
  ) => {
    imageUrl = imageUrl || (imgUrl as string);
    let imageObject = new fabric.Image(imageUrl, {
      lockScalingFlip: true,
      crossOrigin: "Anonymous",
    });
    imageObject = await this._setImageSrc(imageObject, imageUrl);
    imageObject.scale((nodeRadius * 2) / (imageObject.width as number));

    // Clip image to circle
    const clipPath = new fabric.Circle({
      radius: nodeRadius,
      originX: "center",
      originY: "center",
      // Image scaling is applied to the clip path, so we need to invert it
      scaleX: 1 / (imageObject.scaleX as number),
      scaleY: 1 / (imageObject.scaleY as number),
    });

    imageObject.set({
      clipPath: clipPath,
    });

    const textObject = new fabric.Text(text, {
      fontSize: fontSize,
      originX: "center",
      originY: "center",
      fontWeight: "bold",
      top: imageObject.getScaledHeight() / 2 + fontSize,
    });

    const group = new NodeGroup([imageObject, textObject], {
      originX: "center",
      originY: "center",
      selectable: false,
      isNode: true,
      nodeData: node, // Lưu trữ tham chiếu đến node
    });

    return group;
  };

  private _drawPartnerLine = (
    node1: fabric.Group,
    node2: fabric.Group,
    isMarried: boolean,
    isPrimaryRelationship: boolean = true
  ) => {
    const node1Center = node1.getCenterPoint();
    const node2Center = node2.getCenterPoint();
    const line = new fabric.Line(
      [
        node1Center.x + nodeRadius,
        node1Center.y - nodeRadius / 2,
        node2Center.x - nodeRadius,
        node2Center.y - nodeRadius / 2,
      ],
      {
        ...lineStyles,
        strokeDashArray: isMarried && isPrimaryRelationship ? [] : [5, 5],
      }
    );
    return line;
  };

  private _drawParentLine = (
    parent: fabric.Line | Node,
    isPrimaryRelationship: boolean = true
  ) => {
    let parentLineOrigin: fabric.Point;
    if (parent instanceof fabric.Line) {
      parentLineOrigin = parent.getCenterPoint();
      if (!isPrimaryRelationship) {
        parentLineOrigin = parentLineOrigin.add(
          new fabric.Point(
            ((parent.x2 as number) - (parent.x1 as number)) / 2 - nodeRadius,
            0
          )
        );
      }
    } else {
      parentLineOrigin = parent._object?.getCenterPoint() as fabric.Point;
    }
    const line = new fabric.Line(
      [
        parentLineOrigin.x,
        parentLineOrigin.y,
        parentLineOrigin.x,
        parentLineOrigin.y + verticalDistanceBetweenNodes,
      ],
      {
        ...lineStyles,
        strokeDashArray:
          parent instanceof fabric.Line && isPrimaryRelationship ? [] : [5, 5],
      }
    );
    return line;
  };

  private _drawChildLine = (
    child: Node,
    parentLine: fabric.Line,
    isPrimaryRelationship: boolean = true
  ) => {
    const childObject = child._object as fabric.Group;
    const childCenter = childObject.getCenterPoint();
    const strokeWidth = parentLine.strokeWidth ? parentLine.strokeWidth : 0;

    // Sử dụng kiểu đường dựa trên mối quan hệ chính/phụ
    const lineStyle = {
      ...lineStyles,
      strokeDashArray: isPrimaryRelationship ? [] : [5, 5],
    };

    const horizontalLine = new fabric.Line(
      [
        (parentLine.x2 as number) +
          ((parentLine.x2 as number) > childCenter.x ? strokeWidth : 0),
        parentLine.y2 as number,
        childCenter.x,
        parentLine.y2 as number,
      ],
      lineStyle
    );

    const verticalLine = new fabric.Line(
      [
        horizontalLine.x2 as number,
        horizontalLine.y2 as number,
        childCenter.x,
        childCenter.y - nodeRadius - fontSize,
      ],
      lineStyle
    );

    child._childLine = new fabric.Group([horizontalLine, verticalLine], {
      selectable: false,
    });
    this.canvas.add(child._childLine);
  };

  private _drawNode = async (
    node: Node,
    parentNode?: Node,
    parentRelation?: Relation
  ) => {
    const canvasCenter = this.canvas.getCenter();

    // Lưu trữ tham chiếu đến node cha và mối quan hệ cha mẹ
    if (parentNode) {
      node.parent = parentNode;
      node.parentRelation = parentRelation;
    }

    // Create node
    const nodeObject = await this._createNode(node.name, node.image, node);

    // Set up highlighting when node is clicked
    nodeObject.on("mousedown", () => {
      this._handleNodeClick(node);
      node.onClick && node.onClick(node);
    });

    node._object = nodeObject;
    const relationships = node.relationships;

    let left = canvasCenter.left;
    const top =
      minimumDistanceBetweenNodes * ((node.generation as number) + 1) +
      (node.generation as number) * verticalDistanceBetweenNodes;
    nodeObject.set({ left, top });
    this.canvas.add(nodeObject);

    // Create partners
    if (relationships && relationships.length > 0) {
      // bring partners that married to the front
      relationships.sort((a, b) => {
        if (a.isMarried && !b.isMarried) {
          return -1;
        } else if (!a.isMarried && b.isMarried) {
          return 1;
        } else {
          return 0;
        }
      });

      // Đánh dấu mối quan hệ đầu tiên là chính
      if (relationships.length > 0 && relationships[0].partner) {
        relationships[0].isPrimaryRelationship = true;
      }

      for (const relationship of node.relationships) {
        if (relationship.partner) {
          const partnerNode = await this._createNode(
            relationship.partner.name,
            relationship.partner.image,
            relationship.partner
          );

          // Lưu trữ thông tin về partner's partner (tức là node hiện tại)
          if (!relationship.partner.relationships) {
            relationship.partner.relationships = [];
          }
          // Thêm node hiện tại làm partner của node partner
          relationship.partner.parent = node;
          relationship.partner.parentRelation = relationship;

          // Set up highlighting when partner node is clicked
          partnerNode.on("mousedown", () => {
            this._handleNodeClick(relationship.partner as Node);
            relationship.partner?.onClick &&
              relationship.partner.onClick(relationship.partner);
          });

          relationship.partner._object = partnerNode;
          partnerNode.set({ left, top });
          this.canvas.add(partnerNode);
        }

        // Create children
        if (relationship.children && relationship.children.length > 0) {
          for (const child of relationship.children) {
            await this._drawNode(child, node, relationship);
          }
        }
      }
    }
  };

  private _groupNodes = (generations: [fabric.Group][], node: Node) => {
    if (generations[node.generation as number]) {
      generations[node.generation as number].push(node._object as fabric.Group);
    } else {
      generations[node.generation as number] = [node._object as fabric.Group];
    }
    node.relationships &&
      generations[node.generation as number].push(
        ...node.relationships
          .map(
            (relationship: Relation) =>
              relationship.partner?._object as fabric.Group
          )
          .filter(Boolean) // Lọc bỏ các giá trị undefined
      );
    node.relationships &&
      node.relationships.forEach((relationship: Relation) => {
        relationship.children &&
          relationship.children.forEach((child: Node) => {
            this._groupNodes(generations, child);
          });
      });
  };

  private _positionNodes = () => {
    let generations: [fabric.Group][] = [];
    this._groupNodes(generations, this.root);
    const canvasCenter = this.canvas.getCenter();

    generations.forEach((generation: fabric.Group[]) => {
      // Loại bỏ các phần tử undefined từ mảng
      const filteredGeneration = generation.filter((node) => node);

      if (filteredGeneration.length === 0) return;

      const generationWidth =
        filteredGeneration.length *
          filteredGeneration[0].getBoundingRect().width +
        (filteredGeneration.length - 1) * minimumDistanceBetweenNodes;
      let left = canvasCenter.left - generationWidth / 2;

      filteredGeneration.forEach((node: fabric.Group) => {
        node && node.set({ left });
        left +=
          (node ? node.getBoundingRect().width : 0) +
          minimumDistanceBetweenNodes;
      });
    });
  };

  private _drawPartnerRelations = (node: Node) => {
    const relationships = node.relationships;
    if (relationships && relationships.length > 0) {
      // Đánh dấu mối quan hệ đầu tiên là chính
      if (relationships.length > 0 && relationships[0].partner) {
        relationships[0].isPrimaryRelationship = true;
      }

      for (let i = 0; i < relationships.length; i++) {
        const relationship = relationships[i];
        const isPrimaryRelationship = i === 0; // Chỉ quan hệ đầu tiên là chính

        if (relationship.partner) {
          relationship._relation = this._drawPartnerLine(
            node._object as fabric.Group,
            relationship.partner._object as fabric.Group,
            relationship.isMarried as boolean,
            isPrimaryRelationship
          );
          this.canvas.add(relationship._relation);
        }
        if (relationship.children && relationship.children.length > 0) {
          for (const child of relationship.children) {
            this._drawPartnerRelations(child);
          }
        }
      }
    }
  };

  private _drawChildRelations = (node: Node) => {
    const relationships = node.relationships;
    if (relationships && relationships.length > 0) {
      for (let i = 0; i < relationships.length; i++) {
        const relationship = relationships[i];
        const isPrimaryRelationship = i === 0; // Chỉ quan hệ đầu tiên là chính

        if (relationship.children && relationship.children.length > 0) {
          relationship._parentLine = this._drawParentLine(
            relationship._relation ? relationship._relation : node,
            isPrimaryRelationship
          );
          this.canvas.add(relationship._parentLine);

          for (const child of relationship.children) {
            this._drawChildRelations(child);
            this._drawChildLine(
              child as Node,
              relationship._parentLine as fabric.Line,
              isPrimaryRelationship
            );
          }
        }
      }
    }
  };

  private _bringNodesToFront = () => {
    this.canvas.getObjects().forEach((object: fabric.Object) => {
      if (object instanceof NodeGroup) {
        object.bringToFront();
      }
    });
  };

  // Reset hiện tại highlight để chuẩn bị cho highlight mới
  private _resetHighlight = () => {
    // Khôi phục màu sắc cho tất cả các node đã highlight
    this.highlightedNodes.forEach((node) => {
      if (node instanceof fabric.Group) {
        node.set({
          shadow: undefined,
        });
      }
    });

    // Khôi phục màu sắc cho tất cả các đường nối đã highlight
    this.highlightedLines.forEach((line) => {
      if (line instanceof fabric.Line) {
        line.set({
          stroke: defaultStrokeColor,
        });
      } else if (line instanceof fabric.Group) {
        (line.getObjects() as fabric.Object[]).forEach((obj) => {
          if (obj instanceof fabric.Line) {
            obj.set({
              stroke: defaultStrokeColor,
            });
          }
        });
      }
    });

    this.highlightedNodes = [];
    this.highlightedLines = [];
    this.canvas.requestRenderAll();
  };

  // Highlight một node cụ thể
  private _highlightNode = (node: Node) => {
    if (node._object) {
      node._object.set({
        shadow: new fabric.Shadow({
          color: highlightColor,
          blur: 10,
          offsetX: 0,
          offsetY: 0,
        }),
      });
      this.highlightedNodes.push(node._object);
    }
  };

  // Highlight một đường nối
  private _highlightLine = (line: fabric.Line | fabric.Group) => {
    if (line instanceof fabric.Line) {
      line.set({
        stroke: highlightColor,
      });
      this.highlightedLines.push(line);
    } else if (line instanceof fabric.Group) {
      (line.getObjects() as fabric.Object[]).forEach((obj) => {
        if (obj instanceof fabric.Line) {
          obj.set({
            stroke: highlightColor,
          });
        }
      });
      this.highlightedLines.push(line);
    }
  };

  // Xử lý khi node được click
  private _handleNodeClick = (clickedNode: Node) => {
    this._resetHighlight();

    // Nếu là node cha (không có cha mẹ, hoặc là node gốc)
    if (!clickedNode.parent) {
      // Highlight node cha
      this._highlightNode(clickedNode);

      // Highlight tất cả node con và đường nối với chúng
      clickedNode.relationships.forEach((relation) => {
        if (relation.children && relation.children.length > 0) {
          relation.children.forEach((child) => {
            this._highlightNode(child);

            // Highlight đường nối với mỗi con
            if (child._childLine) {
              this._highlightLine(child._childLine);
            }
          });

          // Highlight đường nối từ cha đến các con
          if (relation._parentLine) {
            this._highlightLine(relation._parentLine);
          }
        }
      });
    }
    // Nếu là node mẹ (có partner, không có cha mẹ riêng)
    else if (
      clickedNode.parent &&
      !clickedNode.parentRelation?.children?.includes(clickedNode)
    ) {
      // Highlight node mẹ
      this._highlightNode(clickedNode);

      // Highlight node cha
      this._highlightNode(clickedNode.parent);

      // Highlight đường nối giữa cha mẹ
      if (clickedNode.parentRelation?._relation) {
        this._highlightLine(clickedNode.parentRelation._relation);
      }

      // Highlight tất cả node con và đường nối với chúng
      const relation = clickedNode.parentRelation;
      if (relation && relation.children && relation.children.length > 0) {
        relation.children.forEach((child) => {
          this._highlightNode(child);

          // Highlight đường nối với mỗi con
          if (child._childLine) {
            this._highlightLine(child._childLine);
          }
        });

        // Highlight đường nối từ cha mẹ đến các con
        if (relation._parentLine) {
          this._highlightLine(relation._parentLine);
        }
      }
    }
    // Nếu là node con
    else {
      // Highlight node con
      this._highlightNode(clickedNode);

      // Highlight node cha
      if (clickedNode.parent) {
        this._highlightNode(clickedNode.parent);

        // Highlight node mẹ nếu có
        if (clickedNode.parentRelation?.partner) {
          this._highlightNode(clickedNode.parentRelation.partner);

          // Highlight đường nối giữa cha mẹ
          if (clickedNode.parentRelation._relation) {
            this._highlightLine(clickedNode.parentRelation._relation);
          }
        }

        // Highlight đường nối với cha mẹ
        if (clickedNode._childLine) {
          this._highlightLine(clickedNode._childLine);
        }

        // Highlight đường dọc từ cha mẹ đến con
        if (clickedNode.parentRelation?._parentLine) {
          this._highlightLine(clickedNode.parentRelation._parentLine);
        }
      }
    }

    this.canvas.requestRenderAll();
  };

  drawTree = async () => {
    // Recursively draw nodes
    await this._drawNode(this.root);

    // Position nodes
    this._positionNodes();

    // Draw partner relations
    this._drawPartnerRelations(this.root);

    // Draw child relations
    this._drawChildRelations(this.root);

    this._bringNodesToFront();

    this.canvas.renderAll();
  };
}
