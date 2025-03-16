import { fabric } from "fabric";
import { Node } from "../types/node";
import { highlightColor, defaultStrokeColor } from "../constants/styles";

export class HighlightManager {
  private highlightedNodes: fabric.Object[] = [];
  private highlightedLines: fabric.Object[] = [];
  private clickedNode: Node | null = null;
  private canvas: fabric.Canvas;

  constructor(canvas: fabric.Canvas) {
    this.canvas = canvas;
    this.setupHoverEvents();
  }

  setupHoverEvents() {
    // Add hover event handlers
    this.canvas.on("mouse:over", (options) => {
      const hoveredObject = options.target;
      if (hoveredObject && (hoveredObject as any).isNode) {
        const nodeData = (hoveredObject as any).nodeData;
        if (nodeData) {
          this.handleNodeHover(nodeData);
        }
      }
    });

    this.canvas.on("mouse:out", () => {
      // Only reset highlights if there's no clicked node
      if (!this.clickedNode) {
        this.resetHighlight();
      }
    });

    this.canvas.on("mouse:down", (options) => {
      const clickedObject = options.target;
      if (clickedObject && (clickedObject as any).isNode) {
        const nodeData = (clickedObject as any).nodeData;
        if (nodeData) {
          this.handleNodeClick(nodeData);
        }
      } else {
        // Reset when clicking on empty space
        this.clickedNode = null;
        this.resetHighlight();
      }
    });
  }

  resetHighlight = () => {
    // Restore color for all highlighted nodes
    this.highlightedNodes.forEach((node) => {
      if (node instanceof fabric.Group) {
        node.set({
          shadow: undefined,
        });
      }
    });

    // Restore color for all highlighted lines
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
      // Only apply hover highlight (no border effect on image)
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

  // Handle node hover - similar to click but doesn't set clickedNode
  handleNodeHover = (hoveredNode: Node) => {
    // Skip hover handling if a node is already clicked
    if (this.clickedNode) return;

    // Apply enhanced ancestry highlighting
    this.highlightAncestryChain(hoveredNode);
  };

  // Handle node click - apply box shadow effect and highlight ancestry
  handleNodeClick = (clickedNode: Node) => {
    // Reset previous highlights
    this.resetHighlight();

    // Set as clicked node
    this.clickedNode = clickedNode;

    // Apply the same ancestry highlighting as hover
    this.highlightAncestryChain(clickedNode);

    // Add special box shadow effect for clicked node
    if (clickedNode._object) {
      const objects = clickedNode._object.getObjects();
      const cardBackground = objects[0]; // Assuming first object is the card background
      if (cardBackground) {
        cardBackground.set({
          shadow: new fabric.Shadow({
            color: "rgba(0,0,0,0.5)",
            blur: 15,
            offsetX: 0,
            offsetY: 5,
          }),
        });
      }
    }

    this.canvas.requestRenderAll();
  };

  // Method to highlight the entire ancestry chain
  highlightAncestryChain(node: Node) {
    this.resetHighlight();

    // Highlight the current node itself
    this.highlightNode(node);

    // Highlight relationships based on node position
    if (!node.parent) {
      // Root node: highlight children and partners
      this.highlightDirectDescendants(node);
    } else {
      // Non-root node: highlight entire ancestry chain and immediate family
      this.highlightAncestors(node);

      // Also highlight siblings and partner if any
      if (node.parentRelation) {
        this.highlightSiblingsAndPartner(node);
      }
    }

    this._ensureNodesOnTop();
    this.canvas.requestRenderAll();
  }

  // Helper method to highlight ancestors all the way up
  highlightAncestors(node: Node) {
    let currentNode = node;

    while (currentNode.parent) {
      // Highlight parent
      this.highlightNode(currentNode.parent);

      // Highlight parent's partner if exists
      if (currentNode.parentRelation?.partner) {
        this.highlightNode(currentNode.parentRelation.partner);

        // Highlight the relationship line between parents
        if (currentNode.parentRelation._relation) {
          this.highlightLine(currentNode.parentRelation._relation);
        }
      }

      // Highlight the connection line to parent
      if (currentNode._childLine) {
        this.highlightLine(currentNode._childLine);
      }

      // Highlight vertical parent line if exists
      if (currentNode.parentRelation?._parentLine) {
        this.highlightLine(currentNode.parentRelation._parentLine);
      }

      // Move up to the next generation
      currentNode = currentNode.parent;
    }
  }

  // Helper method to highlight siblings and partner
  highlightSiblingsAndPartner(node: Node) {
    const relation = node.parentRelation;

    if (relation && relation.children && relation.children.length > 0) {
      // Highlight all siblings
      relation.children.forEach((child) => {
        if (child !== node) {
          // Skip the current node
          this.highlightNode(child);
        }

        // Highlight the child connection line
        if (child._childLine) {
          this.highlightLine(child._childLine);
        }
      });
    }

    // Highlight node's own partners and children if any
    node.relationships?.forEach((rel) => {
      if (rel.partner) {
        this.highlightNode(rel.partner);
        if (rel._relation) {
          this.highlightLine(rel._relation);
        }
      }

      if (rel._parentLine) {
        this.highlightLine(rel._parentLine);
      }

      rel.children?.forEach((child) => {
        this.highlightNode(child);
        if (child._childLine) {
          this.highlightLine(child._childLine);
        }
      });
    });
  }

  // Helper method to highlight direct descendants for root node
  highlightDirectDescendants(node: Node) {
    node.relationships.forEach((relation) => {
      if (relation.partner) {
        this.highlightNode(relation.partner);

        if (relation._relation) {
          this.highlightLine(relation._relation);
        }
      }

      if (relation.children && relation.children.length > 0) {
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
    });
  }
}
