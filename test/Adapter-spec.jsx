import React from 'react';
import ReactFifteenAdapter from '../src/adapters/ReactFifteenAdapter';
import { expect } from 'chai';
import prettyFormat from 'pretty-format';

// Kind of hacky, but we nullify all the instances to test the tree structure
// with jasmine's deep equality function, and test the instances separate. We
// also delete children props because testing them is more annoying and not
// really important to verify.
function cleanNode(node) {
  if (!node) {
    return;
  }
  if (node && node.instance) {
    node.instance = null;
  }
  if (node && node.props && node.props.children) {
    // eslint-disable-next-line no-unused-vars
    const { children, ...props } = node.props;
    node.props = props;
  }
  if (Array.isArray(node.rendered)) {
    node.rendered.forEach(cleanNode);
  } else if (typeof node.rendered === 'object') {
    cleanNode(node.rendered);
  }
}

describe('Adapter', () => {
  it('renders simple components returning host components', () => {
    const adapter = new ReactFifteenAdapter();
    const options = { mode: 'mount' };
    const renderer = adapter.createRenderer(options);

    const Qoo = () => <span className="Qoo">Hello World!</span>;

    renderer.render(<Qoo />);

    const node = renderer.getNode();

    cleanNode(node);

    expect(prettyFormat(node)).to.equal(prettyFormat({
      nodeType: 'function',
      type: Qoo,
      props: {},
      instance: null,
      rendered: {
        nodeType: 'host',
        type: 'span',
        props: { className: 'Qoo' },
        instance: null,
        rendered: ['Hello World!'],
      },
    }));
  });

  it('handles null rendering components', () => {
    const adapter = new ReactFifteenAdapter();
    const options = { mode: 'mount' };
    const renderer = adapter.createRenderer(options);

    class Foo extends React.Component {
      render() {
        return null;
      }
    }

    renderer.render(<Foo />);

    const node = renderer.getNode();

    expect(node.instance).to.be.instanceof(Foo);

    cleanNode(node);

    expect(prettyFormat(node)).to.equal(prettyFormat({
      nodeType: 'class',
      type: Foo,
      props: {},
      instance: null,
      rendered: null,
    }));
  });


  it('renders complicated trees of composites and hosts', () => {
    // SFC returning host. no children props.
    const Qoo = () => <span className="Qoo">Hello World!</span>;

    // SFC returning host. passes through children.
    const Foo = ({ className, children }) => (
      <div className={`Foo ${className}`}>
        <span className="Foo2">Literal</span>
        {children}
      </div>
    );

    // class composite returning composite. passes through children.
    class Bar extends React.Component {
      render() {
        const { special, children } = this.props;
        return (
          <Foo className={special ? 'special' : 'normal'}>
            {children}
          </Foo>
        );
      }
    }

    // class composite return composite. no children props.
    class Bam extends React.Component {
      render() {
        return (
          <Bar special>
            <Qoo />
          </Bar>
        );
      }
    }

    const adapter = new ReactFifteenAdapter();
    const options = { mode: 'mount' };
    const renderer = adapter.createRenderer(options);

    renderer.render(<Bam />);

    const tree = renderer.getNode();

    // we test for the presence of instances before nulling them out
    expect(tree.instance).to.be.instanceof(Bam);
    expect(tree.rendered.instance).to.be.instanceof(Bar);

    cleanNode(tree);

    expect(prettyFormat(tree)).to.equal(
      prettyFormat({
        nodeType: 'class',
        type: Bam,
        props: {},
        instance: null,
        rendered: {
          nodeType: 'class',
          type: Bar,
          props: { special: true },
          instance: null,
          rendered: {
            nodeType: 'function',
            type: Foo,
            props: { className: 'special' },
            instance: null,
            rendered: {
              nodeType: 'host',
              type: 'div',
              props: { className: 'Foo special' },
              instance: null,
              rendered: [
                {
                  nodeType: 'host',
                  type: 'span',
                  props: { className: 'Foo2' },
                  instance: null,
                  rendered: ['Literal'],
                },
                {
                  nodeType: 'function',
                  type: Qoo,
                  props: {},
                  instance: null,
                  rendered: {
                    nodeType: 'host',
                    type: 'span',
                    props: { className: 'Qoo' },
                    instance: null,
                    rendered: ['Hello World!'],
                  },
                },
              ],
            },
          },
        },
      }),
    );
  });

  it('renders basic shallow as well', () => {
    class Bar extends React.Component {
      constructor(props) {
        super(props);
        throw new Error('Bar constructor should not be called');
      }
      render() {
        throw new Error('Bar render method should not be called');
      }
    }

    const Foo = () => {
      throw new Error('Foo render method should not be called');
    };

    // class composite return composite. no children props.
    class Bam extends React.Component {
      render() {
        return (
          <Bar>
            <Foo />
            <Foo />
            <Foo />
          </Bar>
        );
      }
    }

    const adapter = new ReactFifteenAdapter();
    const options = { mode: 'shallow' };
    const renderer = adapter.createRenderer(options);

    renderer.render(<Bam />);

    const tree = renderer.getNode();

    cleanNode(tree);

    expect(prettyFormat(tree)).to.equal(
      prettyFormat({
        nodeType: 'class',
        type: Bam,
        props: {},
        instance: null,
        rendered: {
          nodeType: 'class',
          type: Bar,
          props: {},
          instance: null,
          rendered: [
            {
              nodeType: 'class',
              type: Foo,
              props: {},
              instance: null,
              rendered: null,
            },
            {
              nodeType: 'class',
              type: Foo,
              props: {},
              instance: null,
              rendered: null,
            },
            {
              nodeType: 'class',
              type: Foo,
              props: {},
              instance: null,
              rendered: null,
            },
          ],
        },
      }),
    );
  });

});
