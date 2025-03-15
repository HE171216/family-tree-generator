import { fabric } from "fabric";
import { Node, Relation } from "../types/node";
import { Options } from "../types/options";
import { createCanvas, setupCanvas } from "../utils/canvasUtils";
import {
  createNode,
  drawPartnerLine,
  drawParentLine,
  drawChildLine,
  positionNodes,
  bringNodesToFront, // This is now used and not redundant
} from "../utils/drawingUtils";
import { HighlightManager } from "../utils/highlightUtils";
import {
  minimumDistanceBetweenNodes,
  verticalDistanceBetweenNodes,
} from "../constants/styles";

export default class FamilyTree {
  private declare root: Node;
  declare canvas: fabric.Canvas;
  private highlightManager: HighlightManager;

  constructor(root: Node, options: Options) {
    this.root = root;
    this.canvas = createCanvas(options);
    setupCanvas(this.canvas);
    this.highlightManager = new HighlightManager(this.canvas);
  }

  private _drawNode = async (
    node: Node,
    parentNode?: Node,
    parentRelation?: Relation
  ) => {
    // Method body unchanged
    const canvasCenter = this.canvas.getCenter();

    if (parentNode) {
      node.parent = parentNode;
      node.parentRelation = parentRelation;
    }

    const nodeObject = await createNode(node.name, node.image, node);

    nodeObject.on("mousedown", () => {
      this.highlightManager.handleNodeClick(node);
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

    if (relationships && relationships.length > 0) {
      relationships.sort((a, b) => {
        if (a.isMarried && !b.isMarried) {
          return -1;
        } else if (!a.isMarried && b.isMarried) {
          return 1;
        } else {
          return 0;
        }
      });

      if (relationships.length > 0 && relationships[0].partner) {
        relationships[0].isPrimaryRelationship = true;
      }

      for (const relationship of node.relationships) {
        if (relationship.partner) {
          const partnerNode = await createNode(
            relationship.partner.name,
            relationship.partner.image,
            relationship.partner
          );

          if (!relationship.partner.relationships) {
            relationship.partner.relationships = [];
          }
          relationship.partner.parent = node;
          relationship.partner.parentRelation = relationship;

          partnerNode.on("mousedown", () => {
            this.highlightManager.handleNodeClick(relationship.partner as Node);
            relationship.partner?.onClick &&
              relationship.partner.onClick(relationship.partner);
          });

          relationship.partner._object = partnerNode;
          partnerNode.set({ left, top });
          this.canvas.add(partnerNode);
        }

        if (relationship.children && relationship.children.length > 0) {
          for (const child of relationship.children) {
            await this._drawNode(child, node, relationship);
          }
        }
      }
    }
  };

  private _drawPartnerRelations = (node: Node) => {
    // Method body unchanged
    const relationships = node.relationships;
    if (relationships && relationships.length > 0) {
      if (relationships.length > 0 && relationships[0].partner) {
        relationships[0].isPrimaryRelationship = true;
      }

      for (let i = 0; i < relationships.length; i++) {
        const relationship = relationships[i];
        const isPrimaryRelationship = i === 0;

        if (relationship.partner) {
          relationship._relation = drawPartnerLine(
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
    // Method body unchanged
    const relationships = node.relationships;
    if (relationships && relationships.length > 0) {
      for (let i = 0; i < relationships.length; i++) {
        const relationship = relationships[i];
        const isPrimaryRelationship = i === 0;

        if (relationship.children && relationship.children.length > 0) {
          relationship._parentLine = drawParentLine(
            relationship._relation ? relationship._relation : node,
            isPrimaryRelationship
          );
          this.canvas.add(relationship._parentLine);

          for (const child of relationship.children) {
            this._drawChildRelations(child);
            child._childLine = drawChildLine(
              child as Node,
              relationship._parentLine as fabric.Line,
              isPrimaryRelationship
            );
            this.canvas.add(child._childLine);
          }
        }
      }
    }
  };

  drawTree = async () => {
    // Recursively draw nodes
    await this._drawNode(this.root);

    // Position nodes
    positionNodes(this.canvas, this.root);

    // Draw partner relations
    this._drawPartnerRelations(this.root);

    // Draw child relations
    this._drawChildRelations(this.root);

    // Fix overlapping lines issue
    this.highlightManager.fixLineOverlapping();

    // Use the imported utility function to ensure nodes are on top
    bringNodesToFront(this.canvas);

    this.canvas.renderAll();
  };
}
