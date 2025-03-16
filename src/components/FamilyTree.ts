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
  bringNodesToFront,
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
      // Modified sorting logic - prioritize relationships without partners (just children)
      relationships.sort((a, b) => {
        // Prioritize relationships with no partner (just children)
        if (!a.partner && b.partner) {
          return -1; // a comes first (no partner)
        } else if (a.partner && !b.partner) {
          return 1; // b comes first (no partner)
        }
        // Then sort by marriage status for relationships with partners
        else if (a.isMarried && !b.isMarried) {
          return -1;
        } else if (!a.isMarried && b.isMarried) {
          return 1;
        } else {
          return 0;
        }
      });

      // Mark primary relationships - both for relationships with only children
      // and for the first relationship with a partner
      let foundPartnerRelationship = false;

      relationships.forEach((relationship) => {
        // Set all relationships with only children as primary
        if (!relationship.partner && relationship.children?.length > 0) {
          relationship.isPrimaryRelationship = true;
        }
        // Set the first relationship with a partner as primary
        else if (relationship.partner && !foundPartnerRelationship) {
          relationship.isPrimaryRelationship = true;
          foundPartnerRelationship = true;
        } else {
          relationship.isPrimaryRelationship = false;
        }
      });

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
    const relationships = node.relationships;
    if (relationships && relationships.length > 0) {
      for (let i = 0; i < relationships.length; i++) {
        const relationship = relationships[i];

        if (relationship.partner) {
          relationship._relation = drawPartnerLine(
            node._object as fabric.Group,
            relationship.partner._object as fabric.Group,
            relationship.isMarried as boolean,
            relationship.isPrimaryRelationship === true
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
        // Use the isPrimaryRelationship flag directly from the relationship
        const isPrimaryRelationship =
          relationship.isPrimaryRelationship === true;

        if (relationship.children && relationship.children.length > 0) {
          // For relationships without a partner, use the node itself
          // For relationships with a partner, use the relationship line
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
