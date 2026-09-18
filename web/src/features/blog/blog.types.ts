export interface BlogPostMetadata {
  title: string;
  date: string;
  description?: string;
}

export interface BlogRouteProps {
  params: Promise<{
    mdxPath: string[];
  }>;
}
