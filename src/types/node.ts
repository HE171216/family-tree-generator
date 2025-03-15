import { fabric } from "fabric";

export interface Node {
  id: string | number;
  name: string;
  image?: string;
  gender?: "female" | "male";
  generation?: number;
  relationships: Relation[];
  onClick?: (node: Node) => void;
  _object?: fabric.Group;
  _childLine: fabric.Group;
  parent?: Node;
  parentRelation?: Relation;
}

export interface Relation {
  partner: Node | undefined;
  isMarried: boolean | undefined;
  children: Node[];
  _relation?: fabric.Line;
  _parentLine?: fabric.Line;
  isPrimaryRelationship?: boolean;
}
