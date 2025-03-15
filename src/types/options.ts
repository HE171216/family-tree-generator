export interface Options {
  id: string;
  width: number;
  height: number;
  boundToParentSize?: boolean;
}

export interface NodeGroupOptions extends fabric.IGroupOptions {
  isNode: boolean;
  nodeData?: any;
}
