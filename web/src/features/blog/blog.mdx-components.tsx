import {
  useMDXComponents as getNextraComponents,
  type MDXComponents,
} from 'nextra/mdx-components';

const defaultComponents = getNextraComponents({
  wrapper({ children }) {
    return <>{children}</>;
  },
});

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...defaultComponents,
    ...components,
  };
}
