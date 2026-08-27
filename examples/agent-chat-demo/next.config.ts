import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@sofcom/docx-editor-react', '@sofcom/docx-editor-core'],
};

export default nextConfig;
