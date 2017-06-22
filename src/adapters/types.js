// @flow
import type { Element } from 'react';

// Strings and Numbers are rendered as literals.
export type LiteralValue = string | number;

// A "node" in an RST is either a LiteralValue, or an RSTNode
export type Node = LiteralValue | RSTNode; // eslint-disable-line no-use-before-define

// if node.type
export type RenderedNode = RSTNode | [Node]; // eslint-disable-line no-use-before-define

export type SourceLocation = {|
  fileName: string;
  lineNumber: number;
|};

export type NodeType = 'class' | 'function' | 'host';

export type ComponentInstance = any;
export type Props = { [key: string]: any }; // TODO(lmr): should this just be any?

// An RSTNode has this specific shape
export type RSTNode = {|
  // Either a string or a function. A string is considered a "host" node, and
  // a function would be a composite component. It would be the component constructor or
  // an SFC in the case of a function.
  type: string | Function;

  // This node's type
  nodeType: NodeType;

  // The props object passed to the node, which will include `children` in its raw form,
  // exactly as it was passed to the component.
  props: Props;

  // The backing instance to the node. Can be null in the case of "host" nodes and SFCs.
  // Enzyme will expect instances to have the _public interface_ of a React Component, as would
  // be expected in the corresponding React release returned by `getTargetVersion` of the
  // renderer. Alternative React libraries can choose to provide an object here that implements
  // the same interface, and Enzyme functionality that uses this will continue to work (An example
  // of this would be the `setState()` prototype method).
  instance: ?ComponentInstance;

  // For a given node, this corresponds roughly to the result of the `render` function with the
  // provided props, but transformed into an RST. For "host" nodes, this will always be `null` or
  // an Array. For "composite" nodes, this will always be `null` or an `RSTNode`.
  rendered: ?RenderedNode;

  // an optional property with source information (useful in debug messages) that would be provided
  // by this babel transform: https://babeljs.io/docs/plugins/transform-react-jsx-source/
  __source?: SourceLocation;
|};

export type EnzymeRenderer = {
  // both initial render and updates for the renderer.
  render(el: Element<*>): void;

  // unmounts the renderer
  unmount(): void;

  // retrieve a frozen-in-time copy of the RST.
  getNode(): ?RSTNode;
};

export type RendererOptions = {|
  mode: 'mount' | 'shallow' | 'mixed',
  context?: any,
  attachTo?: any,
|};
