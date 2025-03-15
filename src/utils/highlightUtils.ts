import { fabric } from "fabric";
import { Node } from "../types/node";
import { highlightColor, defaultStrokeColor } from "../constants/styles";

export class HighlightManager {
  private highlightedNodes: fabric.Object[] = [];
  private highlightedLines: fabric.Object[] = [];
  private canvas: fabric.Canvas;

  constructor(canvas: fabric.Canvas) {
    this.canvas = canvas;
  }

  resetHighlight = () => {
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
          strokeWidth: 3, // Reset to default stroke width
        });
      } else if (line instanceof fabric.Group) {
        (line.getObjects() as fabric.Object[]).forEach((obj) => {
          if (obj instanceof fabric.Line) {
            obj.set({
              stroke: defaultStrokeColor,
              strokeWidth: 3, // Reset to default stroke width
            });
          }
        });
      }
    });

    this.highlightedNodes = [];
    this.highlightedLines = [];

    // Make sure nodes stay on top after unhighlighting
    this._ensureNodesOnTop();

    this.canvas.requestRenderAll();
  };

  // Private method to ensure nodes are always on top
  private _ensureNodesOnTop = () => {
    // First, get all lines and send them to back
    const allLines = this.canvas
      .getObjects()
      .filter(
        (object) =>
          object instanceof fabric.Line ||
          (object instanceof fabric.Group && !(object as any).isNode)
      );

    // Sort lines by z-index
    allLines.sort((a, b) => {
      // Keep highlighted lines on top of non-highlighted lines
      const aIsHighlighted = this.highlightedLines.includes(a);
      const bIsHighlighted = this.highlightedLines.includes(b);

      if (aIsHighlighted && !bIsHighlighted) return 1;
      if (!aIsHighlighted && bIsHighlighted) return -1;
      return 0;
    });

    // Send lines to back in order (non-highlighted first, then highlighted)
    allLines.forEach((line) => line.sendToBack());

    // Then explicitly bring all nodes to front
    this.canvas.getObjects().forEach((object: fabric.Object) => {
      if ((object as any).isNode) {
        object.bringToFront();
      }
    });
  };

  highlightNode = (node: Node) => {
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

  highlightLine = (line: fabric.Line | fabric.Group) => {
    if (line instanceof fabric.Line) {
      line.set({
        stroke: highlightColor,
        strokeWidth: 5,
      });

      this.highlightedLines.push(line);
    } else if (line instanceof fabric.Group) {
      (line.getObjects() as fabric.Object[]).forEach((obj) => {
        if (obj instanceof fabric.Line) {
          obj.set({
            stroke: highlightColor,
            strokeWidth: 5,
          });
        }
      });

      this.highlightedLines.push(line);
    }
  };

  fixLineOverlapping = () => {
    const allLines = this.canvas
      .getObjects()
      .filter(
        (obj) =>
          obj instanceof fabric.Line ||
          (obj instanceof fabric.Group &&
            obj
              .getObjects()
              .some((groupObj) => groupObj instanceof fabric.Line))
      );

    allLines.forEach((lineObj) => {
      if (lineObj instanceof fabric.Line) {
        lineObj.set({
          opacity: 0.8,
        });
      } else if (lineObj instanceof fabric.Group) {
        (lineObj.getObjects() as fabric.Object[]).forEach((groupObj) => {
          if (groupObj instanceof fabric.Line) {
            groupObj.set({
              opacity: 0.8,
            });
          }
        });
      }
    });

    this._ensureNodesOnTop();

    this.canvas.requestRenderAll();
  };

  handleNodeClick = (clickedNode: Node) => {
    this.resetHighlight();

    if (!clickedNode.parent) {
      // Highlight the root node
      this.highlightNode(clickedNode);

      clickedNode.relationships.forEach((relation) => {
        if (relation.children && relation.children.length > 0) {
          relation.children.forEach((child) => {
            this.highlightNode(child);

            // Highlight the child connection line
            if (child._childLine) {
              this.highlightLine(child._childLine);
            }
          });

          // Highlight vertical parent line
          if (relation._parentLine) {
            this.highlightLine(relation._parentLine);
          }

          // Fix for issue 2: Highlight the horizontal partner line for root node
          if (relation._relation) {
            this.highlightLine(relation._relation);
          }
        }
      });
    } else if (
      clickedNode.parent &&
      !clickedNode.parentRelation?.children?.includes(clickedNode)
    ) {
      this.highlightNode(clickedNode);
      this.highlightNode(clickedNode.parent);

      if (clickedNode.parentRelation?._relation) {
        this.highlightLine(clickedNode.parentRelation._relation);
      }

      const relation = clickedNode.parentRelation;
      if (relation && relation.children && relation.children.length > 0) {
        relation.children.forEach((child) => {
          this.highlightNode(child);

          if (child._childLine) {
            this.highlightLine(child._childLine);
          }
        });

        if (relation._parentLine) {
          this.highlightLine(relation._parentLine);
        }
      }
    } else {
      this.highlightNode(clickedNode);

      if (clickedNode.parent) {
        this.highlightNode(clickedNode.parent);

        if (clickedNode.parentRelation?.partner) {
          this.highlightNode(clickedNode.parentRelation.partner);

          if (clickedNode.parentRelation._relation) {
            this.highlightLine(clickedNode.parentRelation._relation);
          }
        }

        if (clickedNode._childLine) {
          this.highlightLine(clickedNode._childLine);
        }

        if (clickedNode.parentRelation?._parentLine) {
          this.highlightLine(clickedNode.parentRelation._parentLine);
        }
      }
    }

    // Apply proper z-ordering for highlighted lines
    this._ensureNodesOnTop();

    this.canvas.requestRenderAll();
  };
}
