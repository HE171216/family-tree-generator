import { fabric } from "fabric";
import { NodeGroupOptions } from "../types/options";

export class NodeGroup extends fabric.Group {
  declare isNode: boolean;
  declare nodeData?: any;

  constructor(objects: fabric.Object[], options: NodeGroupOptions) {
    super(objects, options);
    this.isNode = options.isNode;
    this.nodeData = options.nodeData;
  }
}
