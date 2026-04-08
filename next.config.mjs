/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['10.119.198.26', 'localhost:3000'],
  // Fix for Next.js 16 Turbopack/Webpack compatibility
  turbopack: {
    resolveAlias: {
      fs: "",
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
};

export default nextConfig;
